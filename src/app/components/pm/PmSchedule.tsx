import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Flag,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import {
  ApiError,
  projectRepository,
  type ProjectScheduleDetail,
  type ProjectScheduleResult,
  type WbsResult,
} from "@/app/api/projectRepository";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/app/components/ui/collapsible";
import { cn } from "@/app/components/ui/utils";
import type { ProjectSummary } from "@/app/projects/projectTypes";

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 20; // 약 60초

function messageOf(error: unknown, fallback: string) {
  return error instanceof ApiError && error.message ? error.message : fallback;
}

function formatDate(value?: string | null) {
  if (!value) return "미설정";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const VERSION_LABEL = {
  expected: "예상",
  recommended: "권장",
  conservative: "보수적",
} as const;

/** 두 날짜(포함) 사이의 평일(영업일) 수를 센다. */
function businessDaysBetween(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  let count = 0;
  const cur = new Date(start);
  while (cur.getTime() <= end.getTime()) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}


export function PmSchedule({
  project,
  onNavigateNext,
}: {
  project: ProjectSummary;
  onNavigateNext?: () => void;
}) {
  const [wbs, setWbs] = useState<WbsResult | null>(null);
  const [schedule, setSchedule] = useState<ProjectScheduleResult | null>(null);
  const [loadingWbs, setLoadingWbs] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [generating, setGenerating] = useState(false); // 요청 접수 + 결과 폴링 동안 true
  const [error, setError] = useState("");
  const cancelledRef = useRef(false);

  // AI가 제안하는 3가지 일정 버전 중 지금 보고 있는(적용할) 버전
  const [selectedVersion, setSelectedVersion] = useState<
    "expected" | "recommended" | "conservative"
  >("recommended");
  const [applying, setApplying] = useState(false);
  const [appliedVersion, setAppliedVersion] = useState<
    "expected" | "recommended" | "conservative" | null
  >(null);
  const [wbsListOpen, setWbsListOpen] = useState(false);


  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const loadWbs = useCallback(async () => {
    setLoadingWbs(true);
    setError("");
    try {
      const result = await projectRepository.getWbs(project.id);
      if (!cancelledRef.current) setWbs(result);
    } catch (caught) {
      if (!cancelledRef.current) setWbs(null);
      if (!(caught instanceof ApiError && caught.status === 404)) {
        setError(messageOf(caught, "WBS를 불러오지 못했습니다."));
      }
    } finally {
      if (!cancelledRef.current) setLoadingWbs(false);
    }
  }, [project.id]);

  // 저장된 일정 결과를 조회한다. 아직 없으면(404) null.
  const loadSchedule = useCallback(async (): Promise<ProjectScheduleResult | null> => {
    const res = await projectRepository.getSchedules(project.id);
    return res;
  }, [project.id]);

  const refreshSchedule = useCallback(async () => {
    setLoadingSchedule(true);
    try {
      const res = await loadSchedule();
      if (!cancelledRef.current) setSchedule(res);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) {
        if (!cancelledRef.current) setSchedule(null);
      } else if (!cancelledRef.current) {
        setError(messageOf(caught, "일정을 불러오지 못했습니다."));
      }
    } finally {
      if (!cancelledRef.current) setLoadingSchedule(false);
    }
  }, [loadSchedule]);

  useEffect(() => {
    setSchedule(null);
    void loadWbs();
    void refreshSchedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const confirmedTaskCount = useMemo(
    () =>
      (wbs?.finalTasks ?? []).filter(
        (task) => task.confirmed && Number.isInteger(task.taskId) && Number(task.taskId) > 0,
      ).length,
    [wbs],
  );

  const scheduleRows = useMemo(
    () => [...(schedule?.schedules ?? [])].sort((a, b) => a.orderIndex - b.orderIndex),
    [schedule],
  );

  const versionRangeSummary = useMemo(() => {
    if (scheduleRows.length === 0) return null;
    const starts = scheduleRows.map((r) => r[selectedVersion].startDate);
    const ends = scheduleRows.map((r) => r[selectedVersion].endDate);
    const start = starts.reduce((min, d) => (d < min ? d : min));
    const end = ends.reduce((max, d) => (d > max ? d : max));
    return { start, end, businessDays: businessDaysBetween(start, end) };
  }, [scheduleRows, selectedVersion]);

  const generateSchedule = async () => {
    if (!project.server?.plannedStartDate || !project.server?.plannedEndDate) {
      setError("프로젝트 시작일과 종료일을 먼저 저장해야 합니다.");
      return;
    }
    if (!wbs?.finalConfirmed || confirmedTaskCount === 0) {
      setError("먼저 WBS 탭에서 최종 WBS를 확정해야 합니다.");
      return;
    }

    setGenerating(true);
    setError("");
    const previousExecId = schedule?.agentExecutionId ?? null;
    try {
      const request = await projectRepository.generateSchedule(project.id);
      const targetExecId = request.agentExecutionId ?? null;
      toast.success("AI 일정 생성 요청이 접수되었습니다. 결과를 기다리는 중…");

      // 새 실행 결과(agentExecutionId 일치, 또는 이전과 달라짐)가 나올 때까지 폴링한다.
      for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
        if (cancelledRef.current) return;
        await sleep(POLL_INTERVAL_MS);
        if (cancelledRef.current) return;

        let res: ProjectScheduleResult | null = null;
        try {
          res = await loadSchedule();
        } catch (caught) {
          if (!(caught instanceof ApiError && caught.status === 404)) throw caught;
        }

        const isFresh =
          res != null &&
          (targetExecId != null
            ? res.agentExecutionId === targetExecId
            : res.agentExecutionId !== previousExecId);

        if (isFresh) {
          if (!cancelledRef.current) {
            setSchedule(res);
            toast.success("AI 일정이 생성되었습니다.");
          }
          return;
        }
      }

      toast.message("아직 생성 중이에요. 잠시 후 '결과 새로고침'을 눌러 확인해 주세요.");
    } catch (caught) {
      const message = messageOf(caught, "AI 일정 생성에 실패했습니다.");
      setError(message);
      toast.error(message);
    } finally {
      if (!cancelledRef.current) setGenerating(false);
    }
  };

  const handleApplySchedule = async () => {
    if (!schedule) return;
    setApplying(true);
    try {
      const saved = await projectRepository.saveFinalSchedule(project.id, {
        projectStartDate: schedule.projectStartDate,
        targetEndDate: schedule.targetEndDate,
        schedules: schedule.schedules.map((row) => ({
          externalScheduleId: row.wbsCode,
          wbsId: row.wbsId,
          expected: row.expected,
          recommended: row.recommended,
          conservative: row.conservative,
          predecessorWbsIds: row.predecessorWbsIds,
          milestone: row.milestone,
          bufferDays: row.bufferDays,
        })),
      });
      setSchedule(saved);
      setAppliedVersion(selectedVersion);
      toast.success(`${VERSION_LABEL[selectedVersion]} 일정을 프로젝트 일정으로 적용했어요.`);
    } catch (caught) {
      toast.error(messageOf(caught, "일정 적용에 실패했습니다."));
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="border-blue-100 bg-blue-50/50">
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-blue-600 text-white">
              <CalendarClock className="size-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">AI 일정 생성</h2>
                <Badge variant="secondary">{project.name}</Badge>
                {schedule?.llmStatus && (
                  <Badge
                    variant="outline"
                    className="border-emerald-200 bg-emerald-50 font-normal text-emerald-700"
                  >
                    {schedule.llmStatus}
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                확정된 WBS를 기준으로 AI가 추천·보수 일정을 생성합니다.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void refreshSchedule()}
              disabled={loadingSchedule || generating}
            >
              {loadingSchedule ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              결과 새로고침
            </Button>
            <Button
              onClick={() => void generateSchedule()}
              disabled={loadingWbs || generating || !wbs?.finalConfirmed}
            >
              {generating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {schedule ? "AI 일정 다시 생성" : "AI 일정 생성"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard label="프로젝트 시작일" value={formatDate(project.server?.plannedStartDate)} />
        <InfoCard label="목표 종료일" value={formatDate(project.server?.plannedEndDate)} />
        <InfoCard
          label="확정 WBS"
          value={loadingWbs ? "조회 중" : wbs?.finalConfirmed ? `${confirmedTaskCount}개` : "확정 필요"}
        />
      </div>

      {!loadingWbs && (!wbs || !wbs.finalConfirmed) ? (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>
            WBS 탭에서 최종 WBS를 먼저 확정해야 일정 생성을 요청할 수 있습니다.
          </AlertDescription>
        </Alert>
      ) : null}

      {generating ? (
        <Card>
          <CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="size-8 animate-spin text-blue-600" />
            <div className="font-medium text-foreground">AI가 일정을 생성하고 있습니다…</div>
            <div className="text-sm text-muted-foreground">
              결과가 준비되면 자동으로 표시됩니다. (최대 약 1분)
            </div>
          </CardContent>
        </Card>
      ) : schedule && scheduleRows.length > 0 ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">
                프로젝트 기간 {formatDate(schedule.projectStartDate)} ~{" "}
                {formatDate(schedule.targetEndDate)} · 총 {scheduleRows.length}개 항목
              </div>
              <span className="text-muted-foreground text-xs">
                실행 {schedule.agentExecutionId} · {schedule.agentVersion}
              </span>
            </div>

            {schedule.warnings.length > 0 && (
              <Alert>
                <AlertCircle className="size-4" />
                <AlertDescription>
                  {schedule.warnings.map((w, i) => (
                    <div key={i}>{w}</div>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            {/* AI 일정 추천 — 버전 탭 (예상 / 권장 / 보수적) */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 p-1">
                {(["expected", "recommended", "conservative"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setSelectedVersion(v)}
                    className={cn(
                      "rounded-md px-4 py-1.5 text-sm transition-colors",
                      selectedVersion === v
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {VERSION_LABEL[v]}
                  </button>
                ))}
              </div>
              {versionRangeSummary && (
                <span className="text-muted-foreground text-sm">
                  {formatDate(versionRangeSummary.start)} – {formatDate(versionRangeSummary.end)} ·{" "}
                  {versionRangeSummary.businessDays} 영업일
                </span>
              )}
            </div>

            <ScheduleGantt schedule={schedule} rows={scheduleRows} version={selectedVersion} />

            <Collapsible open={wbsListOpen} onOpenChange={setWbsListOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left hover:bg-muted/50"
                >
                  <span className="flex items-center gap-2 text-foreground text-sm">
                    <ChevronDown
                      className={cn(
                        "size-4 text-muted-foreground transition-transform",
                        wbsListOpen && "rotate-180",
                      )}
                    />
                    WBS별 상세 일정
                    <Badge variant="outline" className="font-normal">
                      {scheduleRows.length}건
                    </Badge>
                  </span>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>WBS</TableHead>
                        <TableHead>{VERSION_LABEL[selectedVersion]} 시작</TableHead>
                        <TableHead>{VERSION_LABEL[selectedVersion]} 종료</TableHead>
                        <TableHead className="text-right">예상일수</TableHead>
                        <TableHead className="text-right">버퍼</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduleRows.map((row) => (
                        <TableRow key={row.scheduleId}>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5">
                              {row.milestone && <Flag className="size-3.5 text-blue-600" />}
                              <span className="text-foreground">{row.wbsName}</span>
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(row[selectedVersion].startDate)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(row[selectedVersion].endDate)}
                          </TableCell>
                          <TableCell className="text-right">
                            {row[selectedVersion].estimatedDays}일
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {row.bufferDays}일
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <span className="inline-block size-2 rotate-45 rounded-[1px] bg-blue-600" />{" "}
                마일스톤 · {VERSION_LABEL[selectedVersion]} 일정이 선택되었습니다.
                {appliedVersion && (
                  <span className="ml-1 text-emerald-600">
                    ({VERSION_LABEL[appliedVersion]} 일정 적용됨)
                  </span>
                )}
              </span>
              <Button onClick={() => void handleApplySchedule()} disabled={applying}>
                {applying ? <Loader2 className="size-4 animate-spin" /> : null}
                이 일정 적용
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
              <CalendarClock className="size-7 text-muted-foreground" />
            </div>
            <div>
              <div className="font-medium text-foreground">아직 생성된 일정이 없습니다.</div>
              <div className="mt-1 text-sm text-muted-foreground">
                최종 WBS를 확정한 뒤 "AI 일정 생성"을 눌러주세요.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {onNavigateNext && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={onNavigateNext}>
            업무 배정 화면으로 이동 <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * 카테고리(단계)별 막대 색상. 단계 순서(index)가 커질수록(아래로 내려갈수록)
 * 채도는 높이고 명도는 낮춰 더 깊은 색으로 표현한다.
 */
function categoryColor(index: number, total: number): string {
  const hues = [212, 174, 150, 128, 40, 22, 280, 330];
  const hue = hues[index % hues.length];
  const t = total > 1 ? index / (total - 1) : 0; // 0(맨 위) → 1(맨 아래)
  const saturation = Math.round(58 + t * 28); // 58% → 86% (채도 깊게)
  const lightness = Math.round(54 - t * 18); // 54% → 36% (아래로 갈수록 어둡게)
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/** 추천 일정을 간트 차트(막대 타임라인)로 표시한다. */
function ScheduleGantt({
  schedule,
  rows,
  version,
}: {
  schedule: ProjectScheduleResult;
  rows: ProjectScheduleDetail[];
  version: "expected" | "recommended" | "conservative";
}) {
  const toTime = (value: string) => new Date(`${value}T00:00:00`).getTime();
  const shortLabel = (ms: number) =>
    new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(new Date(ms));

  const ends = rows.map((r) => toTime(r[version].endDate));
  // 타임라인 시작 = 프로젝트 시작일에 고정. 막대가 프로젝트 시작일에 정렬된다.
  const rangeStart = toTime(schedule.projectStartDate);
  const rangeEnd = Math.max(toTime(schedule.targetEndDate), ...ends);
  const total = Math.max(1, rangeEnd - rangeStart);
  const pct = (ms: number) => ((ms - rangeStart) / total) * 100;

  const todayMs = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();
  const todayPct = todayMs >= rangeStart && todayMs <= rangeEnd ? pct(todayMs) : null;

  // 축 눈금 5개(시작~끝 균등 분할)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const ms = rangeStart + f * total;
    return { pct: f * 100, label: shortLabel(ms) };
  });

  const NAME_COL = "w-40 shrink-0 pr-3";

  // 카테고리(단계) 매핑: 각 행이 속한 최상위 PHASE의 순번을 찾아 색을 정한다.
  const byId = new Map(rows.map((r) => [r.wbsId, r]));
  const phaseRows = rows
    .filter((r) => r.itemType === "PHASE")
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const phaseIndexById = new Map(phaseRows.map((r, i) => [r.wbsId, i]));
  const phaseCount = phaseRows.length;

  const phaseIndexOf = (row: ProjectScheduleDetail): number => {
    let cur: ProjectScheduleDetail | undefined = row;
    let guard = 0;
    while (cur && guard < 50) {
      guard += 1;
      if (cur.itemType === "PHASE") return phaseIndexById.get(cur.wbsId) ?? 0;
      if (cur.parentWbsId == null) break;
      cur = byId.get(cur.parentWbsId);
    }
    return 0;
  };

  return (
    <div className="space-y-1.5">
      {/* today 라벨 (날짜보다 한 줄 위) */}
      <div className="flex">
        <div className={NAME_COL} />
        <div className="relative h-4 flex-1">
          {todayPct != null && (
            <span
              className="absolute -translate-x-1/2 font-medium text-amber-600 text-xs"
              style={{ left: `${todayPct}%` }}
            >
              today
            </span>
          )}
        </div>
      </div>
      {/* 날짜 축 */}
      <div className="flex items-end">
        <div className={NAME_COL} />
        <div className="relative h-5 flex-1">
          {ticks.map((t, i) => (
            <span
              key={i}
              className="absolute -translate-x-1/2 text-muted-foreground text-xs"
              style={{ left: `${t.pct}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>

      {/* 각 일정 행 */}
      {rows.map((row) => {
        const catIndex = phaseIndexOf(row);
        const barColor = categoryColor(catIndex, phaseCount);

        // 단계(카테고리) 행: 막대 없이 그룹 헤더로만 표시한다.
        if (row.itemType === "PHASE") {
          return (
            <div key={row.scheduleId} className="flex items-center pt-2.5">
              <div className={`${NAME_COL} flex items-center gap-1.5`}>
                <span
                  className="size-2.5 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: barColor }}
                />
                <span
                  className="truncate text-foreground text-sm font-semibold"
                  title={row.wbsName}
                >
                  {row.wbsName}
                </span>
              </div>
              <div className="relative h-5 flex-1 border-b border-dashed border-border/60">
                {todayPct != null && (
                  <div
                    className="absolute inset-y-0 z-10 w-px -translate-x-1/2 bg-amber-400/70"
                    style={{ left: `${todayPct}%` }}
                  />
                )}
              </div>
            </div>
          );
        }

        const startPct = pct(toTime(row[version].startDate));
        const endPct = pct(toTime(row[version].endDate));
        const left = Math.max(0, startPct);
        const width = Math.max(Math.min(endPct, 100) - left, 1.2);
        const title = `${shortLabel(toTime(row[version].startDate))} ~ ${shortLabel(
          toTime(row[version].endDate),
        )} (${row[version].estimatedDays}일)`;
        return (
          <div key={row.scheduleId} className="flex items-center">
            <div className={`${NAME_COL} flex items-center gap-1.5 pl-3`}>
              {row.milestone && <Flag className="size-3.5 shrink-0 text-blue-600" />}
              <span className="truncate text-foreground text-sm" title={row.wbsName}>
                {row.wbsName}
              </span>
            </div>
            <div className="relative h-7 flex-1 rounded bg-muted/40">
              {todayPct != null && (
                <div
                  className="absolute inset-y-0 z-10 w-[3px] -translate-x-1/2 rounded bg-amber-500"
                  style={{ left: `${todayPct}%` }}
                />
              )}
              {row.milestone ? (
                <div
                  className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px]"
                  style={{ left: `${left}%`, backgroundColor: barColor }}
                  title={title}
                />
              ) : (
                <div
                  className="absolute inset-y-1 flex items-center justify-end overflow-hidden rounded pr-1.5"
                  style={{ left: `${left}%`, width: `${width}%`, backgroundColor: barColor }}
                  title={title}
                >
                  <span className="whitespace-nowrap text-[10px] text-white">
                    {row[version].estimatedDays}일
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-1 text-xl font-semibold text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}