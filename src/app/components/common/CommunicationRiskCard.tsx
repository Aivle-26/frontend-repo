import { useCallback, useEffect, useState } from "react";
import {
  MessagesSquare,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Clock,
  Hash,
  AlertCircle,
  Lightbulb,
} from "lucide-react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { toast } from "sonner";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/app/components/ui/utils";
import {
  communicationRiskApi,
  severityLabel,
  severityTone,
  llmStatusLabel,
  type CommunicationRiskResult,
} from "@/app/api/communicationRiskApi";
import { slackChannelApi } from "@/app/api/slackChannelApi";
import { SlackChannelPicker } from "@/app/components/common/SlackChannelPicker";
import { getAccessToken } from "@/app/api/authToken";
import { Settings2 } from "lucide-react";

/** 로그인 세션에서 accessToken을 꺼낸다. /api/projects/** 는 인증이 필요하다. */
function currentAccessToken(): string | null {
  return getAccessToken();
}

interface CommunicationRiskCardProps {
  projectId: string;
}

function formatKst(iso: string): string {
  try {
    return format(parseISO(iso), "M월 d일 HH:mm", { locale: ko });
  } catch {
    return iso;
  }
}

function formatRelative(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { locale: ko, addSuffix: true });
  } catch {
    return iso;
  }
}

export function CommunicationRiskCard({ projectId }: CommunicationRiskCardProps) {
  const [data, setData] = useState<CommunicationRiskResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** null = 아직 확인 전, 0 = 미연결(채널 선택 화면), 1+ = 연결됨 */
  const [linkedCount, setLinkedCount] = useState<number | null>(null);
  /** 채널 편집(연결된 뒤에도 다시 고르기) 모드 */
  const [editingChannels, setEditingChannels] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = currentAccessToken();
      // 먼저 채널이 연결돼 있는지 본다. 없으면 분석 이전에 채널 선택부터 해야 한다.
      const channels = await slackChannelApi.list(projectId, token);
      setLinkedCount(channels.length);

      if (channels.length === 0) {
        setData(null);
      } else {
        const result = await communicationRiskApi.get(projectId, token);
        setData(result);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleChannelsSaved = useCallback(() => {
    setEditingChannels(false);
    void load();
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await communicationRiskApi.refresh(projectId, currentAccessToken());
      setData(result);
      toast.success("커뮤니케이션 리스크를 다시 분석했습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "재분석에 실패했습니다.");
    } finally {
      setRefreshing(false);
    }
  }, [projectId]);

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessagesSquare className="size-4 text-blue-600" />
            <span className="text-foreground">Slack 커뮤니케이션 리스크</span>
          </div>
          {/* 분석 결과가 있을 때만 상단에 재분석 + 채널편집 노출 */}
          {!loading && !error && linkedCount !== 0 && data && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingChannels(true)}
                disabled={refreshing}
              >
                <Settings2 className="size-4" />
                채널 편집
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleRefresh()}
                disabled={refreshing}
              >
                <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
                재분석
              </Button>
            </div>
          )}
        </div>

        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : editingChannels || linkedCount === 0 ? (
          <SlackChannelPicker projectId={projectId} onSaved={handleChannelsSaved} />
        ) : !data || data.status === "NEVER_ANALYZED" ? (
          <EmptyState onAnalyze={() => void handleRefresh()} busy={refreshing} />
        ) : (
          <ResultView data={data} />
        )}

        {editingChannels && (
          <div className="mt-3 flex justify-start">
            <Button variant="ghost" size="sm" onClick={() => setEditingChannels(false)}>
              취소
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResultView({ data }: { data: CommunicationRiskResult }) {
  const { metrics } = data;
  const changed = metrics.activityChangePercent;
  const dropped = changed !== null && changed < 0;
  const llmNote = llmStatusLabel(data.llmStatus);

  return (
    <div className="space-y-5">
      {/* 위험도 요약 */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          className={cn(
            "font-normal",
            data.riskLevel === "HIGH"
              ? "border-transparent bg-red-700 text-white dark:bg-red-800"
              : "",
          )}
          variant={data.riskLevel === "HIGH" ? "default" : "outline"}
        >
          <span
            className={cn(
              data.riskLevel !== "HIGH" && severityTone(data.riskLevel),
              "rounded-sm",
            )}
          >
            커뮤니케이션 위험도 {severityLabel(data.riskLevel)}
          </span>
        </Badge>
        {data.analyzedAt && (
          <span className="text-muted-foreground text-xs">
            {formatRelative(data.analyzedAt)} 분석
          </span>
        )}
        {llmNote && (
          <span className="text-muted-foreground text-xs">· {llmNote}</span>
        )}
      </div>

      {/* 판정 근거 */}
      <ul className="space-y-1.5">
        {data.reasons.map((reason) => (
          <li key={reason} className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <span className="text-foreground text-sm leading-snug">{reason}</span>
          </li>
        ))}
      </ul>

      {/* 지표 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric
          icon={Hash}
          label="최근 7일 대화"
          value={`${metrics.recent7dMessageCount}건`}
          sub={`이전 ${metrics.previous7dMessageCount}건`}
        />
        <Metric
          icon={dropped ? TrendingDown : TrendingUp}
          label="대화량 변화"
          value={changed === null ? "비교 불가" : `${changed > 0 ? "+" : ""}${changed}%`}
          sub={changed === null ? "이전 기간 데이터 없음" : undefined}
          tone={dropped ? "text-red-600" : "text-emerald-600"}
        />
        <Metric
          icon={Clock}
          label="24시간+ 미응답"
          value={`${metrics.longUnansweredCount}건`}
          tone={metrics.longUnansweredCount > 0 ? "text-red-600" : undefined}
        />
      </div>

      {/* 근거 메시지 */}
      {data.evidenceMessages.length > 0 && (
        <div>
          <p className="mb-2 text-muted-foreground text-xs">근거 메시지</p>
          <div className="divide-y divide-border rounded-lg border border-border">
            {data.evidenceMessages.map((m) => (
              <div key={`${m.channelId}-${m.messageTs}`} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
                    <Hash className="size-3" />
                    {m.channelName}
                  </span>
                  <span className="shrink-0 text-muted-foreground text-xs">
                    {formatKst(m.messageTs)}
                  </span>
                </div>
                <p className="mt-1 text-foreground text-sm leading-snug">
                  {m.messageText}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 권장 조치 */}
      <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2.5 dark:bg-blue-950/30">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-blue-600" />
        <div>
          <p className="text-muted-foreground text-xs">권장 조치</p>
          <p className="text-foreground text-sm leading-snug">
            {data.recommendedAction}
          </p>
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        분석 구간 {formatKst(data.analysisWindow.start)} ~{" "}
        {formatKst(data.analysisWindow.end)}
      </p>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-border px-3 py-2.5">
      <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
        <Icon className="size-3.5" />
        {label}
      </span>
      <p className={cn("mt-1 text-foreground", tone)}>{value}</p>
      {sub && <p className="text-muted-foreground text-xs">{sub}</p>}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <AlertCircle className="size-6 text-red-500" />
      <p className="text-muted-foreground text-sm">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        다시 시도
      </Button>
    </div>
  );
}

function EmptyState({ onAnalyze, busy }: { onAnalyze: () => void; busy: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <MessagesSquare className="size-6 text-muted-foreground" />
      <p className="text-muted-foreground text-sm">
        아직 분석 이력이 없습니다. Slack 대화를 분석해 커뮤니케이션 리스크를 확인하세요.
      </p>
      <Button size="sm" onClick={onAnalyze} disabled={busy}>
        <RefreshCw className={cn("size-4", busy && "animate-spin")} />
        분석 시작
      </Button>
    </div>
  );
}
