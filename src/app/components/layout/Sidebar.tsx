import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

import { cn } from "@/app/components/ui/utils";
import { SlackIcon } from "@/app/components/common/SlackIcon";

export interface SidebarItem {
  key: string;
  label: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
}

interface SidebarProps {
  items: SidebarItem[];
  active: string;
  onSelect: (key: string) => void;
}

const SIDEBAR_STORAGE_KEY = "aipm.sidebar-width";

const DEFAULT_SIDEBAR_WIDTH = 240;
const MIN_SIDEBAR_WIDTH = 190;
const MAX_SIDEBAR_WIDTH = 380;

export function Sidebar({
  items,
  active,
  onSelect,
}: SidebarProps) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const savedWidth = localStorage.getItem(
      SIDEBAR_STORAGE_KEY,
    );

    if (!savedWidth) {
      return DEFAULT_SIDEBAR_WIDTH;
    }

    const parsedWidth = Number(savedWidth);

    if (Number.isNaN(parsedWidth)) {
      return DEFAULT_SIDEBAR_WIDTH;
    }

    return Math.min(
      MAX_SIDEBAR_WIDTH,
      Math.max(MIN_SIDEBAR_WIDTH, parsedWidth),
    );
  });

  useEffect(() => {
    localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      String(sidebarWidth),
    );
  }, [sidebarWidth]);

  const startResize = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = sidebarWidth;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handlePointerMove = (
      moveEvent: PointerEvent,
    ) => {
      const movedDistance =
        moveEvent.clientX - startX;

      const nextWidth =
        startWidth + movedDistance;

      const limitedWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(
          MIN_SIDEBAR_WIDTH,
          nextWidth,
        ),
      );

      setSidebarWidth(limitedWidth);
    };

    const stopResize = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      window.removeEventListener(
        "pointermove",
        handlePointerMove,
      );

      window.removeEventListener(
        "pointerup",
        stopResize,
      );
    };

    window.addEventListener(
      "pointermove",
      handlePointerMove,
    );

    window.addEventListener(
      "pointerup",
      stopResize,
    );
  };

  const resetSidebarWidth = () => {
    setSidebarWidth(
      DEFAULT_SIDEBAR_WIDTH,
    );
  };

  return (
    <aside
      className="
        relative flex shrink-0 flex-col
        border-r border-border
        bg-sidebar
      "
      style={{
        width: `${sidebarWidth}px`,
      }}
    >
      {/* 로고 영역 */}
      <div className="flex h-16 items-center gap-2.5 overflow-hidden px-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Sparkles className="size-5" />
        </div>

        <div className="min-w-0 whitespace-nowrap leading-tight">
          <div className="truncate text-sidebar-foreground">
            BidWorks AI
          </div>

          <div className="truncate text-xs text-muted-foreground">
            RFP 프로젝트 관리
          </div>
        </div>
      </div>

      {/* 메뉴 */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden px-3 py-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.key === active;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() =>
                onSelect(item.key)
              }
              aria-current={
                isActive
                  ? "page"
                  : undefined
              }
              className={cn(
                `
                  group relative flex w-full
                  items-center gap-3
                  whitespace-nowrap
                  rounded-xl px-3 py-2.5
                  text-left text-sm
                  transition-all
                `,
                isActive
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <span
                className={cn(
                  `
                    absolute left-0 top-1/2
                    h-5 w-1
                    -translate-y-1/2
                    rounded-r-full
                    bg-primary
                    transition-opacity
                  `,
                  isActive
                    ? "opacity-100"
                    : "opacity-0",
                )}
                aria-hidden="true"
              />

              <Icon
                className={cn(
                  "size-4 shrink-0 transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-sidebar-foreground",
                )}
              />

              <span className="truncate">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* 연동 서비스 */}
      <div className="overflow-hidden border-t border-border p-3">
        <div className="whitespace-nowrap px-2 pb-1.5 text-xs text-muted-foreground">
          연동 서비스
        </div>

        <button
          type="button"
          onClick={() =>
            onSelect("slack")
          }
          aria-current={
            active === "slack"
              ? "page"
              : undefined
          }
          className={cn(
            `
              group relative flex w-full
              items-center gap-3
              whitespace-nowrap
              rounded-xl px-3 py-2.5
              text-left text-sm
              transition-all
            `,
            active === "slack"
              ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
          )}
        >
          <span
            className={cn(
              `
                absolute left-0 top-1/2
                h-5 w-1
                -translate-y-1/2
                rounded-r-full
                bg-primary
                transition-opacity
              `,
              active === "slack"
                ? "opacity-100"
                : "opacity-0",
            )}
            aria-hidden="true"
          />

          <SlackIcon className="shrink-0 text-base" />

          <span className="truncate">
            Slack 연동
          </span>
        </button>
      </div>

      {/* 사이드바 너비 조절 손잡이 */}
      <div
        role="separator"
        aria-label="사이드바 너비 조절"
        aria-orientation="vertical"
        title="드래그하여 너비 조절 · 더블클릭하여 초기화"
        onPointerDown={startResize}
        onDoubleClick={resetSidebarWidth}
        className="
          absolute right-0 top-0 z-20
          h-full w-1.5
          cursor-col-resize
          transition-colors
          hover:bg-primary/30
          active:bg-primary/50
        "
      />
    </aside>
  );
}