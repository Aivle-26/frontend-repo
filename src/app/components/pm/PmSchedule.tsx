import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
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

export function PmSchedule({ project }: { project: ProjectSummary }) {
  const [wbs, setWbs] = useState<WbsResult | null>(null);
  const [schedule, setSchedule] = useState<ProjectScheduleResult | null>(null);
  const [loadingWbs, setLoadingWbs] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [generating, setGenerating] = useState(false); // 요청 접수 + 결과 폴링 동안 true
  const [error, setError] = useState("");
  const cancelledRef = useRef(false);

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

            <ScheduleGantt schedule={schedule} rows={scheduleRows} />

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>WBS</TableHead>
                    <TableHead>추천 시작</TableHead>
                    <TableHead>추천 종료</TableHead>
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
                        {formatDate(row.recommended.startDate)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(row.recommended.endDate)}
                      </TableCell>
                      <TableCell className="text-right">{row.recommended.estimatedDays}일</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {row.bufferDays}일
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
    </div>
  );
}

/** 추천 일정을 간트 차트(막대 타임라인)로 표시한다. */
function ScheduleGantt({
  schedule,
  rows,
}: {
  schedule: ProjectScheduleResult;
  rows: ProjectScheduleDetail[];
}) {
  const toTime = (value: string) => new Date(`${value}T00:00:00`).getTime();
  const shortLabel = (ms: number) =>
    new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric" }).format(new Date(ms));

  const starts = rows.map((r) => toTime(r.recommended.startDate));
  const ends = rows.map((r) => toTime(r.recommended.endDate));
  const rangeStart = Math.min(toTime(schedule.projectStartDate), ...starts);
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

  return (
    <div className="space-y-1.5">
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
          {todayPct != null && (
            <span
              className="absolute -translate-x-1/2 font-medium text-red-500 text-xs"
              style={{ left: `${todayPct}%` }}
            >
              today
            </span>
          )}
        </div>
      </div>

      {/* 각 일정 막대 */}
      {rows.map((row) => {
        const left = pct(toTime(row.recommended.startDate));
        const rawWidth = pct(toTime(row.recommended.endDate)) - left;
        const width = Math.max(rawWidth, 1.2);
        const title = `${shortLabel(toTime(row.recommended.startDate))} ~ ${shortLabel(
          toTime(row.recommended.endDate),
        )} (${row.recommended.estimatedDays}일)`;
        return (
          <div key={row.scheduleId} className="flex items-center">
            <div className={`${NAME_COL} flex items-center gap-1.5`}>
              {row.milestone && <Flag className="size-3.5 shrink-0 text-blue-600" />}
              <span className="truncate text-foreground text-sm" title={row.wbsName}>
                {row.wbsName}
              </span>
            </div>
            <div className="relative h-7 flex-1 rounded bg-muted/40">
              {todayPct != null && (
                <div
                  className="absolute inset-y-0 z-10 w-px bg-red-400"
                  style={{ left: `${todayPct}%` }}
                />
              )}
              {row.milestone ? (
                <div
                  className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] bg-blue-600"
                  style={{ left: `${left}%` }}
                  title={title}
                />
              ) : (
                <div
                  className="absolute inset-y-1 flex items-center justify-end overflow-hidden rounded bg-blue-500/90 pr-1.5"
                  style={{ left: `${left}%`, width: `${width}%` }}
                  title={title}
                >
                  <span className="whitespace-nowrap text-[10px] text-white">
                    {row.recommended.estimatedDays}일
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
