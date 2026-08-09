import { FolderKanban } from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { cn } from "@/app/components/ui/utils";
import type {
  ProjectStatus,
  ProjectSummary,
} from "@/app/projects/projectTypes";

function statusClass(s: ProjectStatus) {
  const map: Record<ProjectStatus, string> = {
    분석중: "bg-muted text-muted-foreground",
    준비: "bg-amber-50 text-amber-700 border-amber-200",
    승인대기: "bg-orange-50 text-orange-700 border-orange-200",
    진행중: "bg-blue-50 text-blue-700 border-blue-200",
    완료: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  return map[s];
}

interface ProjectScopeBarProps {
  projects: ProjectSummary[];
  value: string;
  onChange: (id: string) => void;
  /** 넘기면 오른쪽 안내 문구 대신 이 id를 가진 빈 슬롯을 렌더링한다 (다른 화면에서 포탈로 내용을 꽂아 넣을 수 있음). */
  rightSlotId?: string;
  /** true면 [프로젝트] 탭과 동일하게 상태 뱃지를 "진행 중"으로 보여준다 (기획 완료 여부, 화면마다 표시가 다르지 않도록). */
  planningComplete?: boolean;
  /** TopBar 안에 끼워 넣을 때는 카드 테두리 없이 더 작게 표시한다. */
  compact?: boolean;
}

/** 프로젝트 단위 화면(요구사항·리스크·문서 등) 상단에 붙는 대상 프로젝트 선택 바 */
export function ProjectScopeBar({
  projects,
  value,
  onChange,
  rightSlotId,
  planningComplete,
  compact = false,
}: ProjectScopeBarProps) {
  const selected = projects.find((p) => p.id === value) ?? null;
  const statusLabel = planningComplete ? "진행 중" : selected?.status;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2.5",
        compact
          // 헤더(80px 고정 높이) 안에서는 절대 두 줄로 접히면 안 된다.
          ? "min-w-0 flex-nowrap text-sm"
          : "rounded-xl border border-border bg-card px-4 py-2.5 gap-3",
      )}
    >
      {!compact && (
        <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
          <FolderKanban className="size-4" /> 대상 프로젝트
        </span>
      )}
      <Select value={value} onValueChange={onChange}>
        {/* compact(헤더 삽입) 모드에서는 우측 프로필 칩과 같은 결로 맞춰
            헤더 위에 얹힌 컨트롤처럼 보이게 한다. */}
        <SelectTrigger
          className={cn(
            compact
              ? "h-9 w-full min-w-[8.5rem] max-w-64 justify-start rounded-full border-cyan-200 bg-white/80 pl-3 pr-3.5 font-medium text-teal-900 shadow-sm backdrop-blur-sm transition-all [&>svg:last-child]:ml-auto hover:border-cyan-300 hover:bg-cyan-100/85 hover:shadow-md focus-visible:border-cyan-400 focus-visible:ring-cyan-500/30 dark:border-violet-800/80 dark:bg-black/45 dark:text-violet-100 dark:hover:border-violet-600 dark:hover:bg-violet-950/70"
              : "h-9 w-72",
          )}
        >
          {compact && (
            <FolderKanban className="size-4 shrink-0 text-teal-600 dark:text-violet-300" />
          )}
          <SelectValue placeholder="프로젝트를 선택하세요" />
        </SelectTrigger>
        <SelectContent>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected && statusLabel && !compact && (
        <>
          <Badge
            variant="outline"
            className={cn(
              "font-normal",
              planningComplete
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : statusClass(selected.status),
            )}
          >
            {statusLabel}
          </Badge>
          <span className="text-muted-foreground text-xs">{selected.client}</span>
        </>
      )}
      {rightSlotId ? (
        <div id={rightSlotId} className="ml-auto flex items-center gap-2" />
      ) : (
        !compact && (
          <span className="ml-auto text-muted-foreground text-xs">
            이 화면은 선택한 프로젝트 기준으로 표시됩니다.
          </span>
        )
      )}
    </div>
  );
}