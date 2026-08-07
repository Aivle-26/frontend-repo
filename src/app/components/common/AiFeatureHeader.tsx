import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/app/components/ui/utils";

interface AiFeatureHeaderProps {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  compact?: boolean;
  className?: string;
}

/**
 * AI 기능 카드에서 공통으로 사용하는 제목 영역.
 * 민트 라이트 테마와 블랙·퍼플 다크 테마에 동일한 위계를 제공합니다.
 */
export function AiFeatureHeader({
  icon: Icon,
  title,
  description,
  meta,
  compact = false,
  className,
}: AiFeatureHeaderProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl border border-cyan-200/80 bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-500 text-white shadow-[0_10px_24px_-12px_rgba(13,148,136,0.9)]",
          "dark:border-violet-700/70 dark:from-violet-600 dark:via-purple-600 dark:to-fuchsia-700 dark:shadow-[0_10px_24px_-12px_rgba(168,85,247,0.9)]",
          compact ? "size-9" : "size-12",
        )}
      >
        <Icon className={compact ? "size-[18px]" : "size-6"} />
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <div
            className={cn(
              "font-semibold tracking-[-0.02em] text-foreground",
              compact ? "text-[0.98rem]" : "text-lg",
            )}
          >
            {title}
          </div>
          {meta}
        </div>
        {description ? (
          <div
            className={cn(
              "mt-1 max-w-3xl leading-relaxed text-muted-foreground",
              compact ? "text-[0.8rem]" : "text-sm",
            )}
          >
            {description}
          </div>
        ) : null}
      </div>
    </div>
  );
}
