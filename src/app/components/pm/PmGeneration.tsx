import { useMemo, useRef, useState } from "react";
import {
  Bot,
  FileText,
  Flag,
  Network,
  CalendarClock,
  MonitorSmartphone,
  ClipboardList,
  ScrollText,
  Wand2,
  RefreshCw,
  Eye,
  EyeOff,
  Pencil,
  Download,
  CheckCircle2,
  Clock,
  Lock,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/app/components/ui/utils";
import { projectRepository } from "@/app/api/projectRepository";
import {
  markGenerated,
  markScheduleRegistered,
  useGenerated,
  useScheduleRegistered,
  type GenKey as Key,
} from "@/app/state/generationStore";
import type { ProjectSummary } from "@/app/data/demoData";

type GenStatus = "idle" | "generating" | "done";

// WBS 미리보기용 데모 데이터 (백엔드 연동 시 생성 결과로 교체)
const WBS_ROWS = [
  { phase: "1. 분석", task: "요구사항 정의 · 현행 시스템 조사", duration: "2주" },
  { phase: "2. 설계", task: "아키텍처 · DB · 화면 설계", duration: "3주" },
  { phase: "3. 개발", task: "핵심 모듈 · 알림 연동 · 대시보드", duration: "8주" },
  { phase: "4. 시험", task: "통합 시험 · 인수 시험", duration: "3주" },
];

// 계획 백본: 앞 단계가 완료돼야 다음 단계가 열립니다.
const BACKBONE: {
  key: Key;
  icon: typeof FileText;
  title: string;
  desc: string;
  short: string;
  doneMeta: string;
}[] = [
  { key: "req", icon: FileText, title: "요구사항 목록", desc: "RFP에서 핵심 요구사항을 추출", short: "요구사항", doneMeta: "12건 추출됨" },
  { key: "milestone", icon: Flag, title: "프로젝트 목표/마일스톤", desc: "프로젝트 목표와 주요 마일스톤 정리", short: "마일스톤", doneMeta: "목표 3 · 마일스톤 4" },
  { key: "wbs", icon: Network, title: "WBS 초안", desc: "작업 분해 구조를 단계·하위 작업으로 구성", short: "WBS", doneMeta: "4단계 구성" },
  { key: "schedule", icon: CalendarClock, title: "MC 일정 계획", desc: "WBS 기반 마일스톤·기간을 간트로 산정", short: "일정", doneMeta: "간트 차트" },
];

export function PmGeneration({
  project,
  onOpenDocuments,
  onOpenRequirements,
}: {
  project: ProjectSummary;
  onOpenDocuments?: () => void;
  onOpenRequirements?: () => void;
}) {
  // 생성 완료 상태는 스토어(localStorage)에 유지 → 사이드바 이동해도 보존
  const done = useGenerated(project.id);
  // 생성 중(transient) 상태만 로컬 관리
  const [busy, setBusy] = useState<Partial<Record<Key, boolean>>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const scheduleRegistered = useScheduleRegistered(project.id);
  const previewRef = useRef<HTMLDivElement>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);

  const statusOf = (key: Key): GenStatus =>
    busy[key] ? "generating" : done.has(key) ? "done" : "idle";

  const run = async (key: Key, label: string, onDone?: () => void) => {
    setBusy((prev) => ({ ...prev, [key]: true }));
    await projectRepository.reanalyzeRfp();
    // AI 연동 전까지 로딩 상태가 보이도록 최소 지연을 둡니다. (백엔드 연결 시 제거)
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    markGenerated(project.id, key);
    setBusy((prev) => ({ ...prev, [key]: false }));
    toast.success(`${label} 생성을 완료했어요.`);
    onDone?.();
  };

  const scrollToPreview = () =>
    requestAnimationFrame(() =>
      previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );

  // 생성 직후: 미리보기를 펼치고 스크롤
  const openPreview = () => {
    setPreviewOpen(true);
    scrollToPreview();
  };

  // 미리보기 버튼: 펼치기/접기 토글 (펼칠 때만 스크롤)
  const togglePreview = () =>
    setPreviewOpen((open) => {
      if (!open) scrollToPreview();
      return !open;
    });

  const scrollToSchedule = () =>
    requestAnimationFrame(() =>
      scheduleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );

  const openSchedule = () => {
    setScheduleOpen(true);
    scrollToSchedule();
  };

  const toggleSchedule = () =>
    setScheduleOpen((open) => {
      if (!open) scrollToSchedule();
      return !open;
    });

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <Card className="border-blue-100 bg-blue-50/40">
        <CardContent className="pt-6 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Bot className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="text-foreground">AI 문서 생성</span>
              <Badge variant="secondary" className="font-normal">
                {project.name}
              </Badge>
            </div>
            <div className="text-muted-foreground text-xs mt-0.5">
              공고문·요구사항 분석 결과를 바탕으로 계획 문서를 자동 생성합니다.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 1. 계획 백본 */}
      <section className="space-y-3">
        <SectionTitle
          title="계획 백본"
          hint="앞 단계가 완료되면 다음 단계가 열립니다"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {BACKBONE.map((step, idx) => {
            const st = statusOf(step.key);
            const prev = BACKBONE[idx - 1];
            const locked = idx > 0 && !done.has(prev.key);
            const label: StatusLabel = st === "done"
              ? { text: "생성 완료", tone: "success" }
              : locked
                ? { text: `${prev.short} 필요`, tone: "warning" }
                : { text: "미생성", tone: "muted" };
            return (
              <GeneratorCard
                key={step.key}
                icon={step.icon}
                title={step.title}
                description={step.desc}
                status={st}
                statusLabel={label}
              >
                {locked ? (
                  <Button variant="outline" size="sm" className="flex-1" disabled>
                    <Lock className="size-3.5" /> {prev.short} 먼저 생성
                  </Button>
                ) : st === "done" ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => run(step.key, step.title)}
                    >
                      <RefreshCw className="size-3.5" /> 다시 생성
                    </Button>
                    {step.key === "req" && onOpenRequirements && (
                      <Button size="sm" className="flex-1" onClick={onOpenRequirements}>
                        요구사항 보기 <ArrowRight className="size-3.5" />
                      </Button>
                    )}
                    {step.key === "wbs" && (
                      <Button size="sm" className="flex-1" onClick={togglePreview}>
                        {previewOpen ? (
                          <>
                            <EyeOff className="size-3.5" /> 접기
                          </>
                        ) : (
                          <>
                            <Eye className="size-3.5" /> 미리보기
                          </>
                        )}
                      </Button>
                    )}
                    {step.key === "milestone" && onOpenDocuments && (
                      <Button size="sm" className="flex-1" onClick={onOpenDocuments}>
                        문서함 보기 <ArrowRight className="size-3.5" />
                      </Button>
                    )}
                    {step.key === "schedule" && (
                      <Button size="sm" className="flex-1" onClick={toggleSchedule}>
                        {scheduleOpen ? (
                          <>
                            <EyeOff className="size-3.5" /> 접기
                          </>
                        ) : (
                          <>
                            <Eye className="size-3.5" /> 일정표 보기
                          </>
                        )}
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={st === "generating"}
                    onClick={() =>
                      run(
                        step.key,
                        step.title,
                        step.key === "wbs"
                          ? openPreview
                          : step.key === "schedule"
                            ? openSchedule
                            : undefined,
                      )
                    }
                  >
                    {st === "generating" ? (
                      <>
                        <Clock className="size-3.5 animate-spin" /> 생성 중…
                      </>
                    ) : (
                      <>
                        <Wand2 className="size-3.5" /> 생성하기
                      </>
                    )}
                  </Button>
                )}
              </GeneratorCard>
            );
          })}
        </div>

        {/* WBS 생성 중: 스켈레톤 로딩 */}
        {statusOf("wbs") === "generating" && <WbsPreviewSkeleton />}

        {/* WBS 미리보기 (미리보기 버튼으로 펼치기/접기) */}
        {statusOf("wbs") === "done" && previewOpen && (
          <div ref={previewRef}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Eye className="size-4 text-muted-foreground" /> WBS 미리보기
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast("편집 모드는 준비 중이에요.")}
                  >
                    <Pencil className="size-3.5" /> 편집
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      toast.success("WBS를 문서함에 저장했어요.");
                      onOpenDocuments?.();
                    }}
                  >
                    <Download className="size-3.5" /> 문서함 저장
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">단계</TableHead>
                      <TableHead>작업</TableHead>
                      <TableHead className="w-20">기간</TableHead>
                      <TableHead className="w-24">담당</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {WBS_ROWS.map((row) => (
                      <TableRow key={row.phase}>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="border-blue-200 bg-blue-50 font-normal text-blue-700"
                          >
                            {row.phase}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.task}</TableCell>
                        <TableCell className="text-muted-foreground">{row.duration}</TableCell>
                        <TableCell className="text-muted-foreground">미배정</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 일정 생성 중: 스켈레톤 */}
        {statusOf("schedule") === "generating" && <SchedulePreviewSkeleton />}

        {/* WBS 기반 일정 계획 (간트) */}
        {statusOf("schedule") === "done" && scheduleOpen && (
          <div ref={scheduleRef}>
            <ScheduleGantt
              registered={scheduleRegistered}
              onRegister={() => {
                markScheduleRegistered(project.id);
                toast.success("프로젝트 일정으로 등록했어요.");
              }}
              onOpenDocuments={onOpenDocuments}
            />
          </div>
        )}
      </section>

      {/* 2. 추가 산출물 (설계 · 운영/문서화) */}
      <section className="space-y-3">
        <SectionTitle title="추가 산출물" hint="필요할 때 개별로 생성" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GeneratorCard
            icon={MonitorSmartphone}
            title="UI 프로토타입 초안"
            description="주요 화면 흐름을 프로토타입으로 초안화"
            status={statusOf("ui")}
            statusLabel={
              statusOf("ui") === "done"
                ? { text: "생성 완료", tone: "success" }
                : { text: "미생성", tone: "muted" }
            }
          >
            {statusOf("ui") === "done" ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => run("ui", "UI 프로토타입 초안")}
                >
                  <RefreshCw className="size-3.5" /> 다시 생성
                </Button>
                {onOpenDocuments && (
                  <Button size="sm" className="flex-1" onClick={onOpenDocuments}>
                    문서함 보기 <ArrowRight className="size-3.5" />
                  </Button>
                )}
              </>
            ) : (
              <Button
                size="sm"
                className="flex-1"
                disabled={statusOf("ui") === "generating"}
                onClick={() => run("ui", "UI 프로토타입 초안")}
              >
                {statusOf("ui") === "generating" ? (
                  <>
                    <Clock className="size-3.5 animate-spin" /> 생성 중…
                  </>
                ) : (
                  <>
                    <Wand2 className="size-3.5" /> 생성하기
                  </>
                )}
              </Button>
            )}
          </GeneratorCard>

          <GeneratorCard
            icon={ClipboardList}
            title="주간 스크럼 보고서"
            description="진행률·이슈를 취합해 주간 리포트 자동 작성"
            status={statusOf("weekly")}
            statusLabel={
              statusOf("weekly") === "done"
                ? { text: "생성 완료", tone: "success" }
                : { text: "이번 주 · 미생성", tone: "muted" }
            }
          >
            {statusOf("weekly") === "done" ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => run("weekly", "주간 스크럼 보고서")}
                >
                  <RefreshCw className="size-3.5" /> 다시 생성
                </Button>
                {onOpenDocuments && (
                  <Button size="sm" className="flex-1" onClick={onOpenDocuments}>
                    문서함 보기 <ArrowRight className="size-3.5" />
                  </Button>
                )}
              </>
            ) : (
              <Button
                size="sm"
                className="flex-1"
                disabled={statusOf("weekly") === "generating"}
                onClick={() => run("weekly", "주간 스크럼 보고서")}
              >
                {statusOf("weekly") === "generating" ? (
                  <>
                    <Clock className="size-3.5 animate-spin" /> 생성 중…
                  </>
                ) : (
                  <>
                    <Wand2 className="size-3.5" /> 생성하기
                  </>
                )}
              </Button>
            )}
          </GeneratorCard>

          <GeneratorCard
            icon={ScrollText}
            title="결정사항 로그"
            description="회의·검토 중 확정된 결정사항을 문서로 정리"
            status={statusOf("decision")}
            statusLabel={
              statusOf("decision") === "done"
                ? { text: "문서화 완료", tone: "success" }
                : { text: "누적 5건", tone: "muted" }
            }
          >
            {statusOf("decision") === "done" ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() =>
                    run("decision", "결정사항 로그", () =>
                      toast.success("결정사항 로그를 문서함에 저장했어요."),
                    )
                  }
                >
                  <RefreshCw className="size-3.5" /> 다시 생성
                </Button>
                <Button size="sm" className="flex-1" onClick={() => onOpenDocuments?.()}>
                  문서함 보기 <ArrowRight className="size-3.5" />
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className="flex-1"
                disabled={statusOf("decision") === "generating"}
                onClick={() =>
                  run("decision", "결정사항 로그", () =>
                    toast.success("결정사항 로그를 문서함에 저장했어요."),
                  )
                }
              >
                {statusOf("decision") === "generating" ? (
                  <>
                    <Clock className="size-3.5 animate-spin" /> 문서화 중…
                  </>
                ) : (
                  <>
                    <Download className="size-3.5" /> 문서로 내보내기
                  </>
                )}
              </Button>
            )}
          </GeneratorCard>
        </div>
      </section>
    </div>
  );
}

type StatusLabel = { text: string; tone: "success" | "warning" | "muted" };

function WbsPreviewSkeleton() {
  return (
    <Card aria-busy="true" aria-label="WBS 생성 중">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
          <Clock className="size-4 animate-spin" /> WBS 생성 중…
        </CardTitle>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-24" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex gap-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 flex-1" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 border-t border-border pt-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function parseWeeks(duration: string): number {
  const m = duration.match(/(\d+)\s*주/);
  return m ? Number(m[1]) : 1;
}

function nextMonday(base: Date): Date {
  const d = new Date(base);
  const day = d.getDay(); // 0(일)~6(토)
  const add = (8 - (day || 7)) % 7 || 7;
  d.setDate(d.getDate() + add);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}-${dd}`;
}

// WBS 각 단계 기간을 이어받아 시작·종료일과 간트 막대를 산정합니다.
function buildSchedule() {
  const start = nextMonday(new Date());
  const totalWeeks = WBS_ROWS.reduce((sum, r) => sum + parseWeeks(r.duration), 0);
  let cursor = 0;
  const rows = WBS_ROWS.map((r) => {
    const weeks = parseWeeks(r.duration);
    const phaseStart = new Date(start.getTime() + cursor * WEEK_MS);
    const phaseEnd = new Date(start.getTime() + (cursor + weeks) * WEEK_MS - DAY_MS);
    const offsetPct = (cursor / totalWeeks) * 100;
    const widthPct = (weeks / totalWeeks) * 100;
    cursor += weeks;
    return { phase: r.phase, start: phaseStart, end: phaseEnd, offsetPct, widthPct };
  });
  const end = rows[rows.length - 1]?.end ?? start;
  return { start, end, totalWeeks, rows };
}

function ScheduleGantt({
  registered,
  onRegister,
  onOpenDocuments,
}: {
  registered: boolean;
  onRegister: () => void;
  onOpenDocuments?: () => void;
}) {
  const { start, end, totalWeeks, rows } = useMemo(buildSchedule, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="leading-tight">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4 text-muted-foreground" /> WBS 기반 일정 계획
          </CardTitle>
          <CardDescription className="mt-0.5">
            {fmtDate(start)} ~ {fmtDate(end)} · {totalWeeks}주 · WBS 기간에서 자동 산정
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast("날짜 조정은 준비 중이에요.")}
        >
          <Pencil className="size-3.5" /> 날짜 조정
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">단계</TableHead>
              <TableHead className="w-40">기간</TableHead>
              <TableHead>타임라인</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.phase}>
                <TableCell>
                  <Badge
                    variant="outline"
                    className="border-blue-200 bg-blue-50 font-normal text-blue-700"
                  >
                    {row.phase}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {fmtDate(row.start)} ~ {fmtDate(row.end)}
                </TableCell>
                <TableCell>
                  <div className="relative h-2.5 w-full rounded-full bg-muted">
                    <div
                      className="absolute top-0 h-2.5 rounded-full bg-blue-500"
                      style={{ left: `${row.offsetPct}%`, width: `${row.widthPct}%` }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <span className="text-muted-foreground text-xs">
            WBS 각 단계 기간을 바탕으로 시작·종료일이 자동 배정됐어요.
          </span>
          {registered ? (
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-50 font-normal text-emerald-700"
              >
                <CheckCircle2 className="size-3" /> 프로젝트 일정에 등록됨
              </Badge>
              {onOpenDocuments && (
                <Button variant="ghost" size="sm" onClick={onOpenDocuments}>
                  문서함 <ArrowRight className="size-3.5" />
                </Button>
              )}
            </div>
          ) : (
            <Button size="sm" onClick={onRegister}>
              <CalendarClock className="size-3.5" /> 프로젝트 일정으로 등록
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SchedulePreviewSkeleton() {
  return (
    <Card aria-busy="true" aria-label="일정 계획 생성 중">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
          <Clock className="size-4 animate-spin" /> 일정 계획 생성 중…
        </CardTitle>
        <Skeleton className="h-8 w-24" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-2.5 flex-1 rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <h3 className="text-foreground text-sm font-medium">{title}</h3>
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
    </div>
  );
}

function GeneratorCard({
  icon: Icon,
  title,
  description,
  status,
  statusLabel,
  children,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
  status: GenStatus;
  statusLabel: StatusLabel;
  children: React.ReactNode;
}) {
  const toneClass =
    statusLabel.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : statusLabel.tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-border bg-muted/40 text-muted-foreground";

  return (
    <Card className={cn("flex flex-col", status === "done" && "border-emerald-200/70")}>
      <CardContent className="flex flex-1 flex-col gap-3 pt-6">
        <div className="flex items-center gap-2">
          <Icon className="size-5 text-blue-600" />
          <span className="text-foreground text-[15px] font-medium leading-tight">{title}</span>
        </div>
        <CardDescription className="leading-relaxed">{description}</CardDescription>
        <Badge variant="outline" className={cn("w-fit font-normal", toneClass)}>
          {statusLabel.tone === "success" && <CheckCircle2 className="size-3" />}
          {statusLabel.tone === "warning" && <Clock className="size-3" />}
          {statusLabel.text}
        </Badge>
        <div className="mt-auto flex gap-2 pt-1">{children}</div>
      </CardContent>
    </Card>
  );
}
