import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  ClipboardList,
  Loader2,
  Sparkles,
  Target,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { AiFeatureHeader } from "@/app/components/common/AiFeatureHeader";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { Calendar as DatePickerCalendar } from "@/app/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import { cn } from "@/app/components/ui/utils";
import {
  ApiError,
  projectRepository,
  type WeeklyScrumReportResponse,
  type WeeklyScrumSubmissionItem,
  type WeeklyScrumWorkflowStatus,
} from "@/app/api/projectRepository";
import type { ProjectSummary } from "@/app/data/demoData";
import { ScrumReviewPanel, type OwnerOption } from "./ScrumReviewPanel";

/* ==================================================================== */
/* 주차(Week) 계산                                                       */
/* ==================================================================== */

function startOfWeek(base: Date): Date {
  const date = new Date(base);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addWeeks(base: Date, weeks: number): Date {
  const date = new Date(base);
  date.setDate(date.getDate() + weeks * 7);
  return date;
}

function weekOfMonth(date: Date): number {
  return Math.ceil(date.getDate() / 7);
}

function weekLabel(offset: number): string {
  const monday = addWeeks(startOfWeek(new Date()), offset);
  return `${monday.getFullYear()}년 ${monday.getMonth() + 1}월 ${weekOfMonth(monday)}주차`;
}

function weekRangeLabel(offset: number): string {
  const monday = addWeeks(startOfWeek(new Date()), offset);
  const sunday = addWeeks(monday, 1);
  sunday.setDate(sunday.getDate() - 1);
  const fmt = (d: Date) => `${d.getMonth() + 1}.${d.getDate()}`;
  return `${fmt(monday)} ~ ${fmt(sunday)}`;
}

/** week_start(ISO) — 로컬 타임존 기준 YYYY-MM-DD */
function weekStartKey(offset: number): string {
  const monday = addWeeks(startOfWeek(new Date()), offset);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const d = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function weeksBetweenMondays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function weekDaysOf(offset: number): Date[] {
  const monday = addWeeks(startOfWeek(new Date()), offset);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(day.getDate() + i);
    return day;
  });
}

function parseDueDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 줄바꿈 텍스트를 항목 리스트로 (앞의 "- " 제거) */
function linesOf(text: string | null | undefined): string[] {
  return (text ?? "")
    .split("\n")
    .map((s) => s.replace(/^[-*·]\s*/, "").trim())
    .filter(Boolean);
}

interface MemberRow {
  employeeNumber: string;
  name: string;
  role: string;
  submission: WeeklyScrumSubmissionItem | null;
}

/* 백엔드 WorkflowStatus → 화면 표기 */
function statusMeta(status: WeeklyScrumWorkflowStatus): {
  label: string;
  className: string;
  processing: boolean;
} {
  switch (status) {
    case "ACTIONS_RECOMMENDED":
    case "PM_REVIEWING":
      return {
        label: "PM 검토 필요",
        className: "border-amber-200 bg-amber-50 text-amber-700",
        processing: false,
      };
    case "FINALIZED":
      return {
        label: "확정됨",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
        processing: false,
      };
    case "FAILED":
      return {
        label: "실패",
        className: "border-red-200 bg-red-50 text-red-700",
        processing: false,
      };
    default:
      return {
        label: "분석 중",
        className: "border-blue-200 bg-blue-50 text-blue-700",
        processing: true,
      };
  }
}

/* ==================================================================== */
/* 메인 컴포넌트                                                         */
/* ==================================================================== */

export function WeeklyScrum({ project }: { project: ProjectSummary }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = useMemo(() => weekStartKey(weekOffset), [weekOffset]);

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [subsError, setSubsError] = useState("");
  const [selectedEmp, setSelectedEmp] = useState<string>("");
  const [requestedEmployees, setRequestedEmployees] = useState<Set<string>>(
    () => new Set(),
  );

  const [analysis, setAnalysis] = useState<WeeklyScrumReportResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  // PM 검토 액션 담당자 지정용 활성 프로젝트 구성원
  const [memberOptions, setMemberOptions] = useState<OwnerOption[]>([]);

  // 주차 선택 달력용 값
  const thisMonday = useMemo(() => startOfWeek(new Date()), []);
  const selectedMonday = useMemo(
    () => addWeeks(thisMonday, weekOffset),
    [thisMonday, weekOffset],
  );
  const weekDays = useMemo(() => weekDaysOf(weekOffset), [weekOffset]);
  const dueDate = useMemo(() => parseDueDate(project.dueDate), [project.dueDate]);
  const [calendarMonth, setCalendarMonth] = useState<Date>(selectedMonday);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // 상단 "대상 프로젝트" 바 안에 있는 슬롯(App.tsx가 렌더링)을 찾아서 주차 선택 UI를 그 안에 그려 넣는다.
  const [navSlotEl, setNavSlotEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setNavSlotEl(document.getElementById("weekly-scrum-week-nav-slot"));
  }, []);
  useEffect(() => {
    setCalendarMonth(selectedMonday);
  }, [selectedMonday]);

  // 제출 현황 + 팀원 이름 로드
  useEffect(() => {
    let cancelled = false;
    setLoadingSubs(true);
    setSubsError("");
    Promise.all([
      projectRepository.getWeeklyScrums(project.id, weekStart),
      projectRepository.getAllTeamMembers(),
      projectRepository
        .getMissingWeeklyScrumMembers(project.id, weekStart)
        .catch(() => null),
      projectRepository.getScrumRequests(project.id).catch(() => []),
    ])
      .then(([subs, allMembers, missing, requests]) => {
        if (cancelled) return;
        const nameMap = new Map(allMembers.map((m) => [m.employeeNumber, m]));
        const subByEmp = new Map(subs.map((s) => [s.employeeNumber, s]));
        const empNumbers = new Set<string>([
          ...subs.map((s) => s.employeeNumber),
          ...(missing?.missingEmployeeNumbers ?? []),
        ]);
        const rows: MemberRow[] = [...empNumbers].map((emp) => {
          const info = nameMap.get(emp);
          return {
            employeeNumber: emp,
            name: info?.name ?? emp,
            role: info?.roles?.[0] ?? "",
            submission: subByEmp.get(emp) ?? null,
          };
        });
        const requestedForWeek = new Set(
          requests
            .filter(
              (request) =>
                request.type === "SCRUM_REQUEST" &&
                request.targetWeekStart === weekStart &&
                request.recipientEmployeeNumber,
            )
            .map((request) => request.recipientEmployeeNumber as string),
        );
        setRequestedEmployees(requestedForWeek);

        rows.sort((a, b) => a.name.localeCompare(b.name));
        setMembers(rows);
        setSelectedEmp((prev) =>
          prev && rows.some((r) => r.employeeNumber === prev)
            ? prev
            : rows[0]?.employeeNumber ?? "",
        );
      })
      .catch((caught) => {
        if (!cancelled) {
          setSubsError(
            caught instanceof ApiError
              ? caught.message
              : "제출 현황을 불러오지 못했습니다.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSubs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project.id, weekStart]);

  // 프로젝트 활성 구성원 로드 (액션 담당자 지정 옵션)
  useEffect(() => {
    let cancelled = false;
    projectRepository
      .getProjectMembers(project.id)
      .then((rows) => {
        if (cancelled) return;
        setMemberOptions(
          rows.map((m) => ({ employeeNumber: m.employeeNumber, name: m.name })),
        );
      })
      .catch(() => {
        if (!cancelled) setMemberOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  // 기존 분석 결과 로드 (주차 변경 시)
  useEffect(() => {
    let cancelled = false;
    setAnalysisError("");
    projectRepository
      .getWeeklyScrumAnalysis(project.id, weekStart)
      .then((res) => {
        if (!cancelled) setAnalysis(res);
      })
      .catch((caught) => {
        if (cancelled) return;
        if (caught instanceof ApiError && caught.status === 404) {
          setAnalysis(null);
        } else {
          setAnalysisError(
            caught instanceof Error ? caught.message : "분석을 불러오지 못했습니다.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [project.id, weekStart]);

  const submittedCount = members.filter((m) => m.submission).length;
  const selected = members.find((m) => m.employeeNumber === selectedEmp) ?? null;

  const changeWeek = (nextOffset: number) => {
    setWeekOffset(nextOffset);
    setAnalysis(null);
  };

  const pickDate = (day: Date | undefined) => {
    if (!day) return;
    changeWeek(weeksBetweenMondays(thisMonday, startOfWeek(day)));
  };

  const [requestingFor, setRequestingFor] = useState<string | null>(null);
  const handleRequestSubmission = async (employeeNumber: string, name: string) => {
    if (requestingFor || requestedEmployees.has(employeeNumber)) return;

    setRequestingFor(employeeNumber);
    try {
      await projectRepository.createScrumRequests(project.id, {
        weekStartDate: weekStart,
        recipientEmployeeNumbers: [employeeNumber],
      });
      setRequestedEmployees((current) => {
        const next = new Set(current);
        next.add(employeeNumber);
        return next;
      });
      toast.success(`${name}님에게 제출 요청을 보냈어요.`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "제출 요청에 실패했습니다.");
    } finally {
      setRequestingFor(null);
    }
  };

  const runAnalyze = async () => {
    if (generating) return;
    if (submittedCount === 0) {
      toast.error("제출된 스크럼이 없어 AI 분석을 실행할 수 없습니다.");
      return;
    }
    setGenerating(true);
    setAnalysisError("");
    try {
      const res = await projectRepository.analyzeWeeklyScrum(project.id, weekStart, {
        enableLlm: true,
      });
      setAnalysis(res);
      toast.success("AI 주간 분석을 생성했습니다.");
    } catch (caught) {
      const msg =
        caught instanceof ApiError ? caught.message : "AI 분석 생성에 실패했습니다.";
      setAnalysisError(msg);
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const meta = analysis ? statusMeta(analysis.status) : null;

  return (
    <div className="space-y-4">
      {(() => {
        const nav = (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="이전 주"
              onClick={() => changeWeek(weekOffset - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>

            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="min-w-44 rounded-md border border-teal-200 !bg-white px-3.5 py-2 text-center shadow-sm transition-all hover:border-teal-300 hover:shadow-md dark:border-violet-800/70 dark:!bg-zinc-950 dark:hover:bg-violet-950/45"
                >
                  <div className="text-[0.94rem] font-semibold text-teal-950 dark:text-violet-50">{weekLabel(weekOffset)}</div>
                  <div className="text-[0.78rem] text-teal-700/70 dark:text-violet-300/70">
                    {weekRangeLabel(weekOffset)}
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="center">
                <div className="flex flex-col gap-3">
                  <DatePickerCalendar
                    mode="single"
                    selected={selectedMonday}
                    month={calendarMonth}
                    onMonthChange={setCalendarMonth}
                    onSelect={(date) => {
                      pickDate(date);
                      setCalendarOpen(false);
                    }}
                    modifiers={{
                      week: weekDays,
                      ...(dueDate ? { due: dueDate } : {}),
                    }}
                    modifiersClassNames={{
                      week: "bg-primary/10",
                      due: "!rounded-full !bg-rose-500/20 !text-rose-700 font-semibold hover:!bg-rose-500/30 dark:!bg-rose-400/20 dark:!text-rose-200",
                    }}
                    className="rounded-lg border border-border"
                  />
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block size-2.5 rounded-sm bg-primary/20" />
                      선택 주간
                    </span>
                    {dueDate && (
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block size-2.5 rounded-full bg-rose-500/25 dark:bg-rose-400/30" />
                        프로젝트 마감일 · {project.dueDate}
                      </span>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              size="icon"
              aria-label="다음 주"
              onClick={() => changeWeek(weekOffset + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        );

        // 상단 "대상 프로젝트" 바에 있는 슬롯에 이 주차 선택 UI를 그대로 꽂아 넣는다.
        // 슬롯이 아직 안 잡혔으면(마운트 타이밍 등) 예전처럼 카드로 인라인 표시한다.
        if (navSlotEl) {
          return createPortal(nav, navSlotEl);
        }
        return (
          <Card>
            <CardContent className="flex items-center justify-center py-3">{nav}</CardContent>
          </Card>
        );
      })()}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* 좌측: 팀원 제출 목록 + 상세 */}
        <div className="space-y-4">
          <SubmissionSummaryBar total={members.length} submitted={submittedCount} />

          <div className="space-y-2">
            {loadingSubs ? (
              <Card>
                <CardContent className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-sm">
                  <Loader2 className="size-4 animate-spin" /> 제출 현황 불러오는 중…
                </CardContent>
              </Card>
            ) : subsError ? (
              <Card>
                <CardContent className="flex items-center gap-2 py-8 text-muted-foreground text-sm">
                  <AlertCircle className="size-4 text-red-500" /> {subsError}
                </CardContent>
              </Card>
            ) : members.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground text-sm">
                  이 프로젝트에 배정된 팀원이 없습니다.
                </CardContent>
              </Card>
            ) : (
              members.map((member) => {
                const active = member.employeeNumber === selected?.employeeNumber;
                const sub = member.submission;
                return (
                  <button
                    key={member.employeeNumber}
                    type="button"
                    onClick={() => setSelectedEmp(member.employeeNumber)}
                    className={cn(
                      "w-full rounded-xl border bg-card p-3 text-left transition-all",
                      active
                        ? "border-primary ring-1 ring-primary/30"
                        : "border-border hover:shadow-sm",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="size-9">
                        <AvatarFallback className="text-xs">
                          {member.name.slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-foreground text-sm">
                            {member.name}
                          </span>
                          {member.role && (
                            <span className="text-muted-foreground text-xs">
                              {member.role}
                            </span>
                          )}
                        </div>
                        {sub ? (
                          <span className="text-muted-foreground text-xs">
                            완료 {linesOf(sub.completedWork).length} · 블로커{" "}
                            {linesOf(sub.blockers).length}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            아직 제출하지 않았습니다.
                          </span>
                        )}
                      </div>
                      {sub ? (
                        <Badge className="shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700">
                          <CheckCircle2 className="size-3.5" /> 제출 완료
                        </Badge>
                      ) : (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={cn(
                              "h-8 rounded-[4px] px-3 text-[0.82rem] font-semibold",
                              requestingFor === member.employeeNumber ||
                              requestedEmployees.has(member.employeeNumber)
                                ? "cursor-not-allowed !border-slate-200 !bg-slate-100 !text-slate-400 shadow-none hover:!bg-slate-100 hover:!text-slate-400 dark:!border-zinc-800 dark:!bg-zinc-900 dark:!text-zinc-500"
                                : "!border-teal-300 !bg-white !text-teal-700 hover:!border-teal-400 hover:!bg-teal-50 hover:!text-teal-800 dark:!border-violet-700 dark:!bg-black/30 dark:!text-violet-200 dark:hover:!bg-violet-950/55",
                            )}
                            disabled={
                              requestingFor === member.employeeNumber ||
                              requestedEmployees.has(member.employeeNumber)
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleRequestSubmission(member.employeeNumber, member.name);
                            }}
                          >
                            {requestingFor === member.employeeNumber
                              ? "요청 중…"
                              : requestedEmployees.has(member.employeeNumber)
                                ? "요청 완료"
                                : "제출 요청"}
                          </Button>
                          <span className="inline-flex shrink-0 items-center gap-1 text-[0.82rem] font-medium text-rose-500 dark:text-rose-300">
                            <CircleDashed className="size-3.5" /> 미제출
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {selected && (
            <Card>
              <CardContent className="space-y-4 pt-5">
                <div className="flex items-center gap-2">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">
                      {selected.name.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="leading-tight">
                    <div className="text-foreground text-sm">{selected.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {selected.role} · {weekLabel(weekOffset)}
                    </div>
                  </div>
                </div>

                {selected.submission ? (
                  <div className="space-y-3">
                    <ScrumSection
                      icon={<CheckCircle2 className="size-4 text-emerald-600" />}
                      title="Done (완료)"
                      items={linesOf(selected.submission.completedWork)}
                      tone="emerald"
                    />
                    <ScrumSection
                      icon={<Target className="size-4 text-blue-600" />}
                      title="Todo (예정)"
                      items={linesOf(selected.submission.plannedWork)}
                      tone="blue"
                    />
                    <ScrumSection
                      icon={<TriangleAlert className="size-4 text-red-600" />}
                      title="Blockers (장애 요소)"
                      items={linesOf(selected.submission.blockers)}
                      tone="red"
                      emptyText="보고된 블로커가 없습니다."
                    />
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border py-8 text-center text-muted-foreground text-sm">
                    이 팀원은 {weekLabel(weekOffset)} 스크럼을 아직 제출하지 않았습니다.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* 우측: 주차별 AI 종합 분석 */}
        <div>
          <Card className="xl:sticky xl:top-4">
            <CardContent className="space-y-4 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <AiFeatureHeader
                  icon={Bot}
                  compact
                  title="AI 주간 종합 분석"
                  description={`${weekLabel(weekOffset)} · 팀원 ${submittedCount}/${members.length}명 제출`}
                  meta={
                    meta ? (
                      <Badge
                        variant="outline"
                        className={cn("font-normal", meta.className)}
                      >
                        {meta.label}
                      </Badge>
                    ) : null
                  }
                />

                <Button size="sm" onClick={() => void runAnalyze()} disabled={generating}>
                  {generating ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> 분석 중…
                    </>
                  ) : analysis ? (
                    <>
                      <Sparkles className="size-3.5" /> AI 분석 다시 실행
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5" /> AI 주간 분석 생성
                    </>
                  )}
                </Button>
              </div>

              {generating ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-14 text-center">
                  <Loader2 className="size-6 animate-spin text-teal-600 dark:text-violet-300" />
                  <p className="text-foreground text-sm">AI가 주간 스크럼을 분석하고 있습니다…</p>
                  <p className="text-muted-foreground text-xs">
                    요약 → 검토 → 다음 액션 추천 순으로 처리됩니다.
                  </p>
                </div>
              ) : analysisError ? (
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-4 text-muted-foreground text-sm">
                  <AlertCircle className="size-4 text-red-500" /> {analysisError}
                </div>
              ) : analysis ? (
                <div className="space-y-3">
                  {analysis.status === "FAILED" && analysis.failure && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-red-700 text-sm">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <div>
                        <div className="font-medium">분석 실패</div>
                        <div className="text-xs">{analysis.failure.message}</div>
                      </div>
                    </div>
                  )}

                  {analysis.llmStatuses &&
                    [
                      analysis.llmStatuses.summarize,
                      analysis.llmStatuses.review,
                      analysis.llmStatuses.recommend,
                    ].some((s) => s === "FALLBACK") && (
                      <p className="text-amber-600 text-xs">
                        일부 단계가 규칙 기반(FALLBACK)으로 처리되었습니다.
                      </p>
                    )}

                  {analysis.status === "FINALIZED" && analysis.finalReport ? (
                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                      <div className="mb-2 text-muted-foreground text-xs">최종 확정 보고서</div>
                      <p className="whitespace-pre-line text-foreground text-sm leading-relaxed">
                        {analysis.finalReport}
                      </p>
                    </div>
                  ) : analysis.status === "ACTIONS_RECOMMENDED" ||
                    analysis.status === "PM_REVIEWING" ? (
                    <ScrumReviewPanel
                      projectId={project.id}
                      weekStart={weekStart}
                      analysis={analysis}
                      ownerOptions={memberOptions}
                      onUpdated={setAnalysis}
                    />
                  ) : (
                    <div className="rounded-lg border border-border p-4 text-sm">
                      <p className="text-foreground">AI 분석을 처리하고 있습니다.</p>
                      <p className="mt-1 text-muted-foreground text-xs">
                        요약 → 검토 → 다음 액션 추천 순으로 진행됩니다. 잠시 후 다시
                        확인해 주세요.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-teal-200/80 bg-gradient-to-br from-white via-cyan-50/45 to-teal-50/70 px-6 py-12 text-center dark:border-violet-800/70 dark:from-zinc-950 dark:via-violet-950/25 dark:to-purple-950/35">
                  <div className="mx-auto flex size-11 items-center justify-center rounded-xl border border-teal-200 bg-teal-50 text-teal-700 dark:border-violet-800 dark:bg-violet-950/55 dark:text-violet-200">
                    <Bot className="size-5" />
                  </div>
                  <p className="mt-4 text-[0.96rem] font-semibold text-foreground">
                    이번 주 스크럼을 한 번에 정리해 보세요.
                  </p>
                  <p className="mx-auto mt-2 max-w-sm text-[0.84rem] leading-6 text-muted-foreground">
                    팀원이 제출한 내용을 바탕으로 핵심 성과, 주요 이슈와 다음 액션을 AI가 요약합니다.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ==================================================================== */
/* 하위 컴포넌트                                                         */
/* ==================================================================== */

function SubmissionSummaryBar({ total, submitted }: { total: number; submitted: number }) {
  const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2 text-sm">
        <ClipboardList className="size-4 text-muted-foreground" />
        <span className="text-foreground">제출 현황</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground text-xs">
          {submitted} / {total}명 제출
        </span>
        <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-foreground text-sm tabular-nums">{pct}%</span>
      </div>
    </div>
  );
}

function ScrumSection({
  icon,
  title,
  items,
  tone,
  emptyText = "내용이 없습니다.",
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  tone: "emerald" | "blue" | "red";
  emptyText?: string;
}) {
  const toneClass = {
    emerald: "bg-emerald-50/60",
    blue: "bg-blue-50/60",
    red: "bg-red-50/60",
  }[tone];

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center gap-1.5 text-sm text-foreground">
        {icon}
        {title}
      </div>
      {items.length > 0 ? (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li
              key={i}
              className={cn("rounded-md px-2.5 py-1.5 text-sm text-foreground", toneClass)}
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">{emptyText}</p>
      )}
    </div>
  );
}