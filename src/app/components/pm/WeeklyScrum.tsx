import { useEffect, useMemo, useState } from "react";
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

import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { Calendar as DatePickerCalendar } from "@/app/components/ui/calendar";
import { cn } from "@/app/components/ui/utils";
import {
  ApiError,
  projectRepository,
  type WeeklyScrumReportResponse,
  type WeeklyScrumSubmissionItem,
  type WeeklyScrumWorkflowStatus,
} from "@/app/api/projectRepository";
import type { ProjectSummary } from "@/app/data/demoData";

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

  const [analysis, setAnalysis] = useState<WeeklyScrumReportResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  // 주차 선택 달력용 값
  const thisMonday = useMemo(() => startOfWeek(new Date()), []);
  const selectedMonday = useMemo(
    () => addWeeks(thisMonday, weekOffset),
    [thisMonday, weekOffset],
  );
  const weekDays = useMemo(() => weekDaysOf(weekOffset), [weekOffset]);
  const dueDate = useMemo(() => parseDueDate(project.dueDate), [project.dueDate]);
  const [calendarMonth, setCalendarMonth] = useState<Date>(selectedMonday);
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
    ])
      .then(([subs, allMembers, missing]) => {
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
      {/* 헤더: 주차 선택 (항상 펼쳐진 달력) */}
      <Card>
        <CardContent className="space-y-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ClipboardList className="size-5" />
              </div>
              <div className="leading-tight">
                <h2 className="text-foreground text-lg">위클리 스크럼</h2>
                <p className="text-muted-foreground text-sm">
                  팀원 제출 스크럼을 모아보고 주차별 AI 종합 분석을 생성·관리합니다.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="이전 주"
                onClick={() => changeWeek(weekOffset - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="min-w-44 rounded-lg border border-border px-3 py-1.5 text-center">
                <div className="text-foreground text-sm">{weekLabel(weekOffset)}</div>
                <div className="text-muted-foreground text-xs">
                  {weekRangeLabel(weekOffset)}
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                aria-label="다음 주"
                onClick={() => changeWeek(weekOffset + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t pt-3 sm:flex-row sm:items-start">
            <DatePickerCalendar
              mode="single"
              selected={selectedMonday}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              onSelect={pickDate}
              modifiers={{
                week: weekDays,
                ...(dueDate ? { due: dueDate } : {}),
              }}
              modifiersClassNames={{
                week: "bg-primary/10",
                due: "border border-red-400 text-red-600 font-semibold",
              }}
              className="rounded-lg border border-border"
            />
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground sm:flex-col sm:items-start sm:gap-2 sm:pt-2">
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-sm bg-primary/20" />
                선택 주간
              </span>
              {dueDate && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-2.5 rounded-sm border border-red-400" />
                  프로젝트 마감일 · {project.dueDate}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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
                        <Badge
                          variant="outline"
                          className="shrink-0 border-amber-200 bg-amber-50 text-amber-700"
                        >
                          <CircleDashed className="size-3.5" /> 미제출
                        </Badge>
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
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                    <Bot className="size-4" />
                  </div>
                  <div className="leading-tight">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground text-sm">AI 주간 종합 분석</span>
                      {meta && (
                        <Badge
                          variant="outline"
                          className={cn("font-normal", meta.className)}
                        >
                          {meta.label}
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {weekLabel(weekOffset)} · 제출 {submittedCount}/{members.length}
                    </div>
                  </div>
                </div>

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
                  <Loader2 className="size-6 animate-spin text-blue-600" />
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

                  {analysis.status === "FINALIZED" && analysis.finalReport ? (
                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                      <div className="mb-2 text-muted-foreground text-xs">최종 확정 보고서</div>
                      <p className="whitespace-pre-line text-foreground text-sm leading-relaxed">
                        {analysis.finalReport}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border p-4 text-sm">
                      <p className="text-foreground">
                        AI 분석이 생성되었습니다.{" "}
                        {analysis.status === "PM_REVIEWING"
                          ? "PM 검토가 필요합니다."
                          : "처리 중입니다."}
                      </p>
                      <p className="mt-1 text-muted-foreground text-xs">
                        상세 검토(Finding·Action 승인/수정/거절)와 최종 확정은 다음 단계에서
                        제공됩니다.
                      </p>
                      {analysis.llmStatuses &&
                        [analysis.llmStatuses.summarize, analysis.llmStatuses.review, analysis.llmStatuses.recommend].some(
                          (s) => s === "FALLBACK",
                        ) && (
                          <p className="mt-2 text-amber-600 text-xs">
                            일부 단계가 규칙 기반(FALLBACK)으로 처리되었습니다.
                          </p>
                        )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-14 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                    <Bot className="size-6 text-muted-foreground" />
                  </div>
                  <p className="text-foreground text-sm">아직 생성된 분석이 없습니다.</p>
                  <p className="max-w-xs text-muted-foreground text-xs">
                    제출된 팀원 스크럼을 바탕으로 [AI 주간 분석 생성]을 눌러 이번 주 종합
                    분석을 만들어 보세요.
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
