import { Hourglass } from "lucide-react";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { cn } from "@/app/components/ui/utils";
import { demoRepository } from "@/app/data/demoRepository";

interface TeamProgressDelayCardProps {
  projectId: string;
}

export function TeamProgressDelayCard({ projectId }: TeamProgressDelayCardProps) {
  const { rows } = demoRepository.getTeamProgressDelay(projectId);
  const delayedCount = rows.filter((d) => d.delayDays > 0).length;

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Hourglass className="size-4 text-blue-600" />
            <span className="text-foreground">팀원 진행도 지연</span>
          </div>
          {delayedCount > 0 ? (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 font-normal">
              지연 {delayedCount}명
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-normal">
              전원 정상
            </Badge>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground text-sm">
            이 프로젝트에 배정된 팀원이 없습니다.
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((d) => {
              const status =
                d.delayDays > 0 ? "지연" : d.progress < d.expectedProgress ? "주의" : "정상";
              const statusStyle =
                status === "지연"
                  ? "bg-red-50 text-red-700 border-red-200"
                  : status === "주의"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200";
              const barColor =
                status === "지연"
                  ? "bg-red-500"
                  : status === "주의"
                    ? "bg-amber-500"
                    : "bg-emerald-500";
              return (
                <div key={d.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground text-sm">{d.name}</span>
                        <span className="text-muted-foreground text-xs">{d.role}</span>
                      </div>
                      <p className="mt-0.5 truncate text-muted-foreground text-xs">
                        {d.currentTask} · 마감 {d.dueDate}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn("shrink-0 font-normal", statusStyle)}>
                      {status === "지연" ? `${d.delayDays}일 지연` : status}
                    </Badge>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", barColor)}
                        style={{ width: `${d.progress}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-muted-foreground text-xs">
                      실제 {d.progress}% / 목표 {d.expectedProgress}%
                    </span>
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
