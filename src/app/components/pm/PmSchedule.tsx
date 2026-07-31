import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import {
  ApiError,
  projectRepository,
  type AgentRequestResult,
  type WbsResult,
} from "@/app/api/projectRepository";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import type { ProjectSummary } from "@/app/projects/projectTypes";

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

export function PmSchedule({ project }: { project: ProjectSummary }) {
  const [wbs, setWbs] = useState<WbsResult | null>(null);
  const [requestResult, setRequestResult] = useState<AgentRequestResult | null>(null);
  const [loadingWbs, setLoadingWbs] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const loadWbs = async () => {
    setLoadingWbs(true);
    setError("");
    try {
      setWbs(await projectRepository.getWbs(project.id));
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
    setRequestResult(null);
    void loadWbs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const confirmedTaskCount = useMemo(
    () =>
      (wbs?.finalTasks ?? []).filter(
        (task) => task.confirmed && Number.isInteger(task.taskId) && Number(task.taskId) > 0,
      ).length,
    [wbs],
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
    try {
      const result = await projectRepository.generateSchedule(project.id);
      setRequestResult(result);
      toast.success("AI 일정 생성 요청이 접수되었습니다.");
    } catch (caught) {
      const message = messageOf(caught, "AI 일정 생성 요청에 실패했습니다.");
      setError(message);
      toast.error(message);
    } finally {
      setGenerating(false);
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
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                확정된 WBS를 백엔드 일정 생성 API로 전달합니다.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void loadWbs()} disabled={loadingWbs || generating}>
              {loadingWbs ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              WBS 새로고침
            </Button>
            <Button
              onClick={() => void generateSchedule()}
              disabled={loadingWbs || generating || !wbs?.finalConfirmed}
            >
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              AI 일정 생성 요청
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
          <AlertDescription>WBS 탭에서 최종 WBS를 먼저 확정해야 일정 생성을 요청할 수 있습니다.</AlertDescription>
        </Alert>
      ) : null}

      {generating ? (
        <Card>
          <CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="size-8 animate-spin text-blue-600" />
            <div className="font-medium text-foreground">백엔드에 AI 일정 생성을 요청하고 있습니다.</div>
          </CardContent>
        </Card>
      ) : requestResult ? (
        <Card>
          <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-50">
              <CheckCircle2 className="size-7 text-emerald-600" />
            </div>
            <div>
              <div className="font-medium text-foreground">일정 생성 요청이 접수되었습니다.</div>
              <div className="mt-1 text-sm text-muted-foreground">
                백엔드 상태: {requestResult.status}
              </div>
            </div>
            <div className="w-full max-w-xl rounded-xl border bg-muted/30 p-4 text-left text-sm">
              <div><span className="font-medium">실행 ID:</span> {requestResult.agentExecutionId}</div>
              <div className="mt-2"><span className="font-medium">에이전트 버전:</span> {requestResult.agentVersion}</div>
            </div>
            <Alert className="max-w-xl text-left">
              <AlertCircle className="size-4" />
              <AlertDescription>
                현재 백엔드는 일정 생성 요청과 AI 결과 저장 API만 제공하며, 저장된 일정 조회 API는 제공하지 않습니다.
                따라서 프론트만 수정한 이번 버전에서는 요청 접수 상태까지만 정확히 표시합니다.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
              <CalendarClock className="size-7 text-muted-foreground" />
            </div>
            <div>
              <div className="font-medium text-foreground">아직 일정 생성 요청을 하지 않았습니다.</div>
              <div className="mt-1 text-sm text-muted-foreground">
                최종 WBS를 확정한 뒤 AI 일정 생성을 요청하세요.
              </div>
            </div>
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
