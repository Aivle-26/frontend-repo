import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  ClipboardList,
  Loader2,
  RefreshCw,
  Save,
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
import { Textarea } from "@/app/components/ui/textarea";
import { cn } from "@/app/components/ui/utils";
import { projectMembers, type ProjectSummary, type TeamMember } from "@/app/data/demoData";

/* ==================================================================== */
/* 데이터 모델                                                           */
/* ==================================================================== */

interface ScrumSubmission {
  submitted: boolean;
  submittedAt?: string;
  done: string[];
  todo: string[];
  blockers: string[];
}

/**
 * 주간 종합본. 백엔드 aiserver `WeeklyReportResponse`(reporting 도메인)와
 * 대응되도록 구성해, 추후 실제 API 연동 시 그대로 매핑할 수 있게 한다.
 *  - executiveSummary ← progress_summary
 *  - achievements     ← completed_work[]
 *  - blockers         ← risk_summary[]
 *  - nextWeek         ← next_week_plan[]
 */
interface WeeklyReport {
  executiveSummary: string;
  achievements: string;
  blockers: string;
  nextWeek: string;
}

/* ==================================================================== */
/* 주차(Week) 계산                                                       */
/* ==================================================================== */

function startOfWeek(base: Date): Date {
  const date = new Date(base);
  const day = date.getDay(); // 0(일)~6(토)
  const diff = day === 0 ? -6 : 1 - day; // 월요일 시작
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

/** week_start(ISO) — 실제 API 요청 시 사용할 수 있는 키. */
function weekStartKey(offset: number): string {
  const monday = addWeeks(startOfWeek(new Date()), offset);
  return monday.toISOString().slice(0, 10);
}

/** 두 월요일 사이의 주(week) 차이 */
function weeksBetweenMondays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

/** 해당 주차(offset)의 월~일 7일을 Date 배열로 */
function weekDaysOf(offset: number): Date[] {
  const monday = addWeeks(startOfWeek(new Date()), offset);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(day.getDate() + i);
    return day;
  });
}

/** 프로젝트 마감일 문자열("YYYY-MM-DD" 등)을 Date로 파싱 (실패 시 null) */
function parseDueDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/* ==================================================================== */
/* 데모 스크럼 데이터 (백엔드 스크럼 제출 API 연동 시 교체)              */
/* ==================================================================== */

const DONE_POOL = [
  "로그인/권한 모듈 리팩터링 완료",
  "요구사항 정의서 v2 리뷰 반영",
  "WBS 4번 작업(API 설계) 초안 작성",
  "결제 연동 테스트 케이스 12건 작성",
  "대시보드 위젯 3종 퍼블리싱",
  "데이터 이관 스크립트 1차 검증",
  "회의록 기반 액션 아이템 정리",
  "부하 테스트 시나리오 설계",
];
const TODO_POOL = [
  "리스크 대응책 문서화",
  "통합 테스트 환경 세팅",
  "요구사항 추적표 업데이트",
  "관리자 화면 접근성(WCAG) 점검",
  "배포 파이프라인 캐시 최적화",
  "API 응답 스키마 확정",
];
const BLOCKER_POOL = [
  "레거시 ERP 데이터 이관 범위 미확정으로 설계 지연",
  "외부 인증 연동 키 발급 대기",
  "성능 테스트 서버 리소스 부족",
  "요구사항 상충(결제 단계 수)으로 대기",
];

/** memberId + weekOffset 기반 결정적(seed) 데모 데이터 생성. */
function buildSubmission(member: TeamMember, offset: number): ScrumSubmission {
  const seed =
    Math.abs(
      [...member.id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) + offset * 7,
    );
  const submitted = seed % 5 !== 0; // 약 80% 제출
  if (!submitted) {
    return { submitted: false, done: [], todo: [], blockers: [] };
  }
  const pick = <T,>(pool: T[], count: number, salt: number): T[] =>
    Array.from({ length: count }, (_, i) => pool[(seed + salt + i * 3) % pool.length]);

  const hasBlocker = seed % 3 === 0;
  return {
    submitted: true,
    submittedAt: `${(seed % 5) + 1}일 전`,
    done: pick(DONE_POOL, 2 + (seed % 2), 1),
    todo: pick(TODO_POOL, 2, 4),
    blockers: hasBlocker ? pick(BLOCKER_POOL, 1, 2) : [],
  };
}

/* ==================================================================== */
/* 메인 컴포넌트                                                         */
/* ==================================================================== */

export function WeeklyScrum({ project }: { project: ProjectSummary }) {
  const members = useMemo(() => projectMembers(project.id), [project.id]);

  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    members[0]?.id ?? "",
  );
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // 주차 선택 달력용 값
  const thisMonday = useMemo(() => startOfWeek(new Date()), []);
  const selectedMonday = useMemo(
    () => addWeeks(thisMonday, weekOffset),
    [thisMonday, weekOffset],
  );
  const weekDays = useMemo(() => weekDaysOf(weekOffset), [weekOffset]);
  const dueDate = useMemo(() => parseDueDate(project.dueDate), [project.dueDate]);

  // 항상 펼쳐진 달력이라 보이는 월을 직접 제어한다. 주차를 옮기면 그 주의 월로 따라감.
  const [calendarMonth, setCalendarMonth] = useState<Date>(selectedMonday);
  useEffect(() => {
    setCalendarMonth(selectedMonday);
  }, [selectedMonday]);

  // 주차가 바뀌면 종합본은 해당 주차 기준으로 다시 생성해야 하므로 초기화
  const submissions = useMemo(() => {
    const map = new Map<string, ScrumSubmission>();
    members.forEach((member) => map.set(member.id, buildSubmission(member, weekOffset)));
    return map;
  }, [members, weekOffset]);

  const submittedMembers = members.filter((m) => submissions.get(m.id)?.submitted);
  const selectedMember =
    members.find((m) => m.id === selectedMemberId) ?? members[0] ?? null;
  const selectedSubmission = selectedMember
    ? submissions.get(selectedMember.id)
    : undefined;

  const changeWeek = (nextOffset: number) => {
    setWeekOffset(nextOffset);
    setReport(null); // 다른 주차의 종합본은 새로 생성
  };

  // 달력에서 특정 날짜를 고르면 그 날짜가 속한 주로 이동
  const pickDate = (day: Date | undefined) => {
    if (!day) return;
    changeWeek(weeksBetweenMondays(thisMonday, startOfWeek(day)));
  };

  /**
   * [🤖 주간 종합본 AI 생성]
   * 현재는 제출된 스크럼을 취합해 초안을 합성한다(UI 확인용).
   * 백엔드/aiserver 주간 보고서 생성 API가 프론트로 노출되면
   * 이 핸들러의 합성 로직을 `POST /api/reports/weekly/generate` 호출로 교체하면 된다.
   */
  const generateReport = async () => {
    if (generating) return;
    if (submittedMembers.length === 0) {
      toast.error("제출된 스크럼이 없어 종합본을 생성할 수 없습니다.");
      return;
    }
    setGenerating(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 1000));

      const allDone = submittedMembers.flatMap((m) =>
        (submissions.get(m.id)?.done ?? []).map((d) => `- (${m.name}) ${d}`),
      );
      const allBlockers = submittedMembers.flatMap((m) =>
        (submissions.get(m.id)?.blockers ?? []).map((b) => `- (${m.name}) ${b}`),
      );
      const allTodo = submittedMembers.flatMap((m) =>
        (submissions.get(m.id)?.todo ?? []).map((t) => `- (${m.name}) ${t}`),
      );

      setReport({
        executiveSummary:
          `${weekLabel(weekOffset)} (${weekRangeLabel(weekOffset)}) · ${project.name}\n` +
          `팀원 ${members.length}명 중 ${submittedMembers.length}명 제출.\n` +
          `핵심 성과 ${allDone.length}건, 블로커 ${allBlockers.length}건, 다음 주 예정 ${allTodo.length}건을 종합했습니다.`,
        achievements: allDone.join("\n") || "- 집계된 성과가 없습니다.",
        blockers:
          allBlockers.length > 0
            ? allBlockers.map((b) => `${b}\n   ↳ 대응책: `).join("\n")
            : "- 보고된 블로커가 없습니다.",
        nextWeek: allTodo.join("\n") || "- 예정 과제가 없습니다.",
      });
      toast.success("주간 종합본 초안을 생성했습니다.");
    } finally {
      setGenerating(false);
    }
  };

  const saveReport = async () => {
    if (!report) return;
    setSaving(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      toast.success("주간 종합본을 저장했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const patchReport = (key: keyof WeeklyReport, value: string) =>
    setReport((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <div className="space-y-4">
      {/* 헤더: 주차 선택 (항상 펼쳐진 달력) */}
      <Card>
        <CardContent className="space-y-4 py-4">
          {/* 상단: 타이틀 + 주차 이동 */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ClipboardList className="size-5" />
              </div>
              <div className="leading-tight">
                <h2 className="text-foreground text-lg">위클리 스크럼</h2>
                <p className="text-muted-foreground text-sm">
                  팀원 제출 스크럼을 모아보고 주차별 종합본을 생성·관리합니다.
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
                <div className="text-foreground text-sm">
                  {weekLabel(weekOffset)}
                </div>
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

          {/* 하단: 항상 펼쳐진 달력 + 범례 */}
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

      {/* 본문: 2단 분할 (좌: 제출 목록/상세, 우: 종합본) */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* 좌측: 팀원 제출 목록 + 상세 */}
        <div className="space-y-4">
          <SubmissionSummaryBar
            total={members.length}
            submitted={submittedMembers.length}
          />

          <div className="space-y-2">
            {members.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground text-sm">
                  이 프로젝트에 배정된 팀원이 없습니다.
                </CardContent>
              </Card>
            ) : (
              members.map((member) => {
                const submission = submissions.get(member.id);
                const active = member.id === selectedMember?.id;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setSelectedMemberId(member.id)}
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
                          <span className="text-muted-foreground text-xs">
                            {member.role}
                          </span>
                        </div>
                        {submission?.submitted ? (
                          <span className="text-muted-foreground text-xs">
                            제출 {submission.submittedAt} · 완료 {submission.done.length} ·
                            블로커 {submission.blockers.length}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            아직 제출하지 않았습니다.
                          </span>
                        )}
                      </div>
                      {submission?.submitted ? (
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

          {/* 선택한 팀원 상세 (Done / Todo / Blockers) */}
          {selectedMember && (
            <Card>
              <CardContent className="space-y-4 pt-5">
                <div className="flex items-center gap-2">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">
                      {selectedMember.name.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="leading-tight">
                    <div className="text-foreground text-sm">{selectedMember.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {selectedMember.role} · {weekLabel(weekOffset)}
                    </div>
                  </div>
                </div>

                {selectedSubmission?.submitted ? (
                  <div className="space-y-3">
                    <ScrumSection
                      icon={<CheckCircle2 className="size-4 text-emerald-600" />}
                      title="Done (완료)"
                      items={selectedSubmission.done}
                      tone="emerald"
                    />
                    <ScrumSection
                      icon={<Target className="size-4 text-blue-600" />}
                      title="Todo (예정)"
                      items={selectedSubmission.todo}
                      tone="blue"
                    />
                    <ScrumSection
                      icon={<TriangleAlert className="size-4 text-red-600" />}
                      title="Blockers (장애 요소)"
                      items={selectedSubmission.blockers}
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

        {/* 우측: 주차별 종합본 */}
        <div>
          <Card className="xl:sticky xl:top-4">
            <CardContent className="space-y-4 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-white">
                    <Bot className="size-4" />
                  </div>
                  <div className="leading-tight">
                    <div className="text-foreground text-sm">주간 종합본</div>
                    <div className="text-muted-foreground text-xs">
                      {weekLabel(weekOffset)} · 제출 {submittedMembers.length}/{members.length}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {report && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={saveReport}
                      disabled={saving || generating}
                    >
                      {saving ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Save className="size-3.5" />
                      )}
                      저장
                    </Button>
                  )}
                  <Button size="sm" onClick={generateReport} disabled={generating}>
                    {generating ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" /> 생성 중…
                      </>
                    ) : report ? (
                      <>
                        <RefreshCw className="size-3.5" /> 다시 생성
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-3.5" /> 주간 종합본 AI 생성
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {report ? (
                <div className="space-y-4">
                  <ReportField
                    label="주간 전체 요약 (Executive Summary)"
                    value={report.executiveSummary}
                    onChange={(v) => patchReport("executiveSummary", v)}
                    rows={4}
                  />
                  <ReportField
                    label="팀별 · 개인별 핵심 성과 종합"
                    value={report.achievements}
                    onChange={(v) => patchReport("achievements", v)}
                    rows={6}
                  />
                  <ReportField
                    label="주요 블로커(위험 요소) 및 대응책"
                    value={report.blockers}
                    onChange={(v) => patchReport("blockers", v)}
                    rows={5}
                  />
                  <ReportField
                    label="다음 주 주요 예정 과제"
                    value={report.nextWeek}
                    onChange={(v) => patchReport("nextWeek", v)}
                    rows={5}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-14 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                    <Bot className="size-6 text-muted-foreground" />
                  </div>
                  <p className="text-foreground text-sm">
                    아직 생성된 종합본이 없습니다.
                  </p>
                  <p className="max-w-xs text-muted-foreground text-xs">
                    제출된 팀원 스크럼을 바탕으로 [주간 종합본 AI 생성]을 눌러
                    이번 주 종합 리포트를 만들어 보세요.
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

function SubmissionSummaryBar({
  total,
  submitted,
}: {
  total: number;
  submitted: number;
}) {
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

function ReportField({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-foreground text-sm font-medium">{label}</label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="resize-y text-sm leading-relaxed"
      />
    </div>
  );
}
