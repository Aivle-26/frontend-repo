import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import {
  ApiError,
  projectRepository,
  type ScheduleDateRange,
  type ScheduleRecommendationResponse,
  type WbsResult,
  type WbsTask,
} from "@/app/api/projectRepository";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { cn } from "@/app/components/ui/utils";
import type { ProjectSummary } from "@/app/projects/projectTypes";

type Scenario = "expected" | "recommended" | "conservative";

const SCENARIO_META: Record<Scenario, { label: string; percentile: string; description: string }> = {
  expected: { label: "예상 일정", percentile: "P50", description: "일반적인 예상 일정" },
  recommended: { label: "권장 일정", percentile: "P80", description: "위험을 고려한 권장 일정" },
  conservative: { label: "보수적 일정", percentile: "P90", description: "여유를 포함한 보수적 일정" },
};

function messageOf(error: unknown, fallback: string) {
  return error instanceof ApiError && error.message ? error.message : fallback;
}

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

function inclusiveDays(range: ScheduleDateRange) {
  const start = parseDate(range.startDate);
  const end = parseDate(range.endDate);
  if (!start || !end) return null;
  return daysBetween(start, end) + 1;
}

function formatDate(value: string) {
  const date = parseDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function toLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function PmSchedule({ project }: { project: ProjectSummary }) {
  const [wbs, setWbs] = useState<WbsResult | null>(null);
  const [recommendation, setRecommendation] = useState<ScheduleRecommendationResponse | null>(null);
  const [scenario, setScenario] = useState<Scenario>("recommended");
  const [loadingWbs, setLoadingWbs] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const loadWbs = async () => {
    setLoadingWbs(true);
    setError("");
    try {
      const loaded = await projectRepository.getWbs(project.id);
      setWbs(loaded);
    } catch (caught) {
      setWbs(null);
      if (!(caught instanceof ApiError && caught.status === 404)) {
        setError(messageOf(caught, "WBS를 불러오지 못했습니다."));
      }
    } finally {
      setLoadingWbs(false);
    }
  };

  useEffect(() => {
    setRecommendation(null);
    void loadWbs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const confirmedTasks = useMemo(
    () =>
      [...(wbs?.finalTasks ?? [])]
        .filter((task) => task.confirmed && Number.isInteger(task.taskId) && Number(task.taskId) > 0)
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [wbs],
  );

  const taskById = useMemo(
    () => new Map(confirmedTasks.map((task) => [Number(task.taskId), task])),
    [confirmedTasks],
  );

  const generateRecommendation = async () => {
    if (!project.server?.plannedStartDate) {
      setError("프로젝트 시작 예정일이 저장되어 있지 않습니다.");
      return;
    }
    if (!wbs?.finalConfirmed || confirmedTasks.length === 0) {
      setError("먼저 WBS 탭에서 최종 WBS를 확정해야 합니다.");
      return;
    }

    setGenerating(true);
    setError("");
    try {
      const response = await projectRepository.recommendSchedule(project.id);
      setRecommendation(response);
      setScenario("recommended");
      toast.success("AI 일정 추천이 완료되었습니다.");
    } catch (caught) {
      const message = messageOf(caught, "AI 일정 추천에 실패했습니다.");
      setError(message);
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const rows = useMemo(() => {
    if (!recommendation) return [];
    return recommendation.wbsSchedules
      .map((schedule) => ({
        schedule,
        task: taskById.get(schedule.wbsId) ?? null,
        range: schedule[scenario],
      }))
      .sort((a, b) => {
        const aOrder = a.task?.orderIndex ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.task?.orderIndex ?? Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder;
      });
  }, [recommendation, scenario, taskById]);

  const timeline = useMemo(() => {
    const valid = rows
      .map((row) => ({ row, start: parseDate(row.range.startDate), end: parseDate(row.range.endDate) }))
      .filter(
        (item): item is { row: (typeof rows)[number]; start: Date; end: Date } =>
          item.start !== null && item.end !== null,
      );

    if (valid.length === 0) return null;
    const minStart = new Date(Math.min(...valid.map((item) => item.start.getTime())));
    const maxEnd = new Date(Math.max(...valid.map((item) => item.end.getTime())));
    const totalDays = Math.max(1, daysBetween(minStart, maxEnd) + 1);

    return { minStart, maxEnd, totalDays };
  }, [rows]);

  const overallDays = timeline ? timeline.totalDays : null;

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
                <h2 className="text-lg font-semibold text-foreground">AI 추천 일정</h2>
                <Badge variant="secondary">{project.name}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                확정된 WBS를 기반으로 P50·P80·P90 세 가지 일정을 생성합니다.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void loadWbs()} disabled={loadingWbs || generating}>
              {loadingWbs ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              WBS 새로고침
            </Button>
            <Button
              onClick={() => void generateRecommendation()}
              disabled={loadingWbs || generating || !wbs?.finalConfirmed}
            >
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {recommendation ? "AI 일정 다시 추천" : "AI 일정 추천"}
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
        <InfoCard label="프로젝트 시작일" value={project.server?.plannedStartDate ? formatDate(project.server.plannedStartDate) : "미설정"} />
        <InfoCard label="목표 종료일" value={project.server?.plannedEndDate ? formatDate(project.server.plannedEndDate) : "미설정"} />
        <InfoCard
          label="확정 WBS"
          value={loadingWbs ? "조회 중" : wbs?.finalConfirmed ? `${confirmedTasks.length}개` : "확정 필요"}
        />
      </div>

      {!loadingWbs && (!wbs || !wbs.finalConfirmed) ? (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>
            일정 추천은 최종 확정된 WBS의 실제 DB 식별자를 사용합니다. WBS 탭에서 최종 WBS를 먼저 확정하세요.
          </AlertDescription>
        </Alert>
      ) : null}

      {generating ? (
        <Card>
          <CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="size-8 animate-spin text-blue-600" />
            <div className="font-medium text-foreground">AI가 WBS별 일정을 계산하고 있습니다.</div>
            <div className="text-sm text-muted-foreground">P50·P80·P90 추천 결과를 기다리는 중입니다.</div>
          </CardContent>
        </Card>
      ) : recommendation ? (
        <>
          {recommendation.warnings.length > 0 ? (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertDescription>
                <ul className="list-disc space-y-1 pl-4">
                  {recommendation.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}

          <Card>
            <CardHeader className="border-b">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-base">추천 시나리오</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    AI API가 반환한 날짜 범위를 시나리오별로 비교합니다.
                  </p>
                </div>
                <div className="grid grid-cols-3 rounded-xl bg-muted p-1">
                  {(Object.keys(SCENARIO_META) as Scenario[]).map((key) => {
                    const meta = SCENARIO_META[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setScenario(key)}
                        className={cn(
                          "rounded-lg px-3 py-2 text-left text-sm transition-colors",
                          scenario === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <div className="font-medium">{meta.label}</div>
                        <div className="text-xs">{meta.percentile}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="grid gap-4 md:grid-cols-3">
                <InfoCard label="선택 시나리오" value={`${SCENARIO_META[scenario].label} · ${SCENARIO_META[scenario].percentile}`} />
                <InfoCard label="전체 기간" value={overallDays ? `${overallDays}일` : "-"} />
                <InfoCard
                  label="예상 종료일"
                  value={timeline ? formatDate(toLocalIsoDate(timeline.maxEnd)) : "-"}
                />
              </div>

              <div className="overflow-hidden rounded-xl border">
                <div className="grid grid-cols-[260px_minmax(720px,1fr)] border-b bg-muted/40 text-xs font-medium text-muted-foreground">
                  <div className="border-r px-4 py-3">WBS 작업</div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span>{timeline ? formatDate(toLocalIsoDate(timeline.minStart)) : "-"}</span>
                    <span>{timeline ? formatDate(toLocalIsoDate(timeline.maxEnd)) : "-"}</span>
                  </div>
                </div>

                <div className="max-h-[620px] overflow-auto">
                  {rows.map(({ schedule, task, range }) => {
                    const start = parseDate(range.startDate);
                    const end = parseDate(range.endDate);
                    const left = timeline && start ? (daysBetween(timeline.minStart, start) / timeline.totalDays) * 100 : 0;
                    const width = timeline && start && end ? Math.max(1.5, ((daysBetween(start, end) + 1) / timeline.totalDays) * 100) : 0;
                    const duration = inclusiveDays(range);

                    return (
                      <div key={schedule.wbsId} className="grid min-h-16 grid-cols-[260px_minmax(720px,1fr)] border-b last:border-b-0">
                        <div className="border-r px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-[11px]">{task?.taskCode ?? `#${schedule.wbsId}`}</Badge>
                            <span className="truncate text-sm font-medium text-foreground">{task?.taskName ?? "WBS 작업"}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock3 className="size-3" /> {duration !== null ? `${duration}일` : "날짜 확인 필요"}
                          </div>
                        </div>
                        <div className="relative min-w-[720px] bg-[linear-gradient(to_right,hsl(var(--border)/0.5)_1px,transparent_1px)] bg-[size:8.333%_100%] px-4 py-3">
                          <div
                            className="absolute top-1/2 h-8 -translate-y-1/2 rounded-lg bg-blue-600 px-3 text-xs font-medium leading-8 text-white shadow-sm"
                            style={{ left: `${left}%`, width: `${width}%`, minWidth: "72px" }}
                            title={`${range.startDate} ~ ${range.endDate}`}
                          >
                            <span className="block truncate">{range.startDate} ~ {range.endDate}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <CheckCircle2 className="size-4" />
                일정 막대는 AI 응답의 시작일·종료일만 사용하며 프론트에서 기간을 임의 생성하지 않습니다.
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
              <CalendarClock className="size-7 text-muted-foreground" />
            </div>
            <div>
              <div className="font-medium text-foreground">아직 생성된 추천 일정이 없습니다.</div>
              <div className="mt-1 text-sm text-muted-foreground">
                최종 WBS를 확정한 뒤 AI 일정 추천을 실행하세요.
              </div>
            </div>
            <Button onClick={() => void generateRecommendation()} disabled={loadingWbs || generating || !wbs?.finalConfirmed}>
              <Sparkles className="size-4" /> AI 일정 추천
            </Button>
          </CardContent>
        </Card>
      )}
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
