import { useEffect, useState } from "react";
import { AlertCircle, Hourglass, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/app/components/ui/card";
import { cn } from "@/app/components/ui/utils";
import {
  ApiError,
  projectRepository,
  type MemberProgress,
} from "@/app/api/projectRepository";

interface TeamProgressDelayCardProps {
  projectId: string;
  excludeEmployeeNumber?: string;
}

export function TeamProgressDelayCard({
  projectId,
  excludeEmployeeNumber,
}: TeamProgressDelayCardProps) {
  const [members, setMembers] = useState<MemberProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    projectRepository
      .getTeamProgress(projectId)
      .then((res) => {
        if (!cancelled) {
          setMembers(
            (res.members ?? []).filter(
              (member) => member.employeeNumber !== excludeEmployeeNumber,
            ),
          );
        }
      })
      .catch((caught) => {
        if (cancelled) return;
        if (caught instanceof ApiError && caught.status === 404) {
          setMembers([]);
        } else {
          setError(
            caught instanceof Error ? caught.message : "팀원 진행 상황을 불러오지 못했습니다.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [excludeEmployeeNumber, projectId]);

  const delayedCount = members.filter((m) => m.delayedTaskCount > 0).length;

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Hourglass className="size-4 text-blue-600" />
            <span className="text-foreground">팀원 진행 상황</span>
          </div>
          {!loading && !error && members.length > 0 && delayedCount === 0 && (
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              전원 정상
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-sm">
            <Loader2 className="size-4 animate-spin" /> 불러오는 중…
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 py-6 text-muted-foreground text-sm">
            <AlertCircle className="size-4 text-rose-500" /> {error}
          </div>
        ) : members.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground text-sm">
            아직 배정된 팀원이 없거나 진행 데이터가 없습니다.
          </p>
        ) : (
          <div className="space-y-3">
            {members.map((m) => {
              const delayed = m.delayedTaskCount > 0;
              const barColor = delayed
                ? "bg-gradient-to-r from-[#f4a0a7] via-[#ec7883] to-[#d95f6d] shadow-[0_0_10px_rgba(217,95,109,0.18)]"
                : m.progressRate >= 100
                  ? "bg-emerald-500"
                  : "bg-blue-500";
              return (
                <div
                  key={m.employeeNumber}
                  className={cn(
                    "rounded-lg border p-3 transition-colors",
                    delayed
                      ? "border-rose-300/90 bg-rose-50/30 shadow-[0_6px_18px_-14px_rgba(190,24,93,0.55)] dark:border-rose-800/80 dark:bg-rose-950/15"
                      : "border-border bg-card",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-foreground text-sm">{m.name}</span>
                      <p className="mt-0.5 text-muted-foreground text-xs">
                        완료 {m.completedTaskCount}/{m.totalTaskCount}건 · 공수 {m.totalEstimatedHours}h
                      </p>
                    </div>
                    {delayed ? (
                      <span className="shrink-0 text-sm font-bold text-rose-700 dark:text-rose-300">
                        지연 {m.delayedTaskCount}건
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        정상
                      </span>
                    )}
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", barColor)}
                        style={{ width: `${Math.min(100, m.progressRate)}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-muted-foreground text-xs">{m.progressRate}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
