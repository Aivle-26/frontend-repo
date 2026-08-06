import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Sparkles } from "lucide-react";

import { cn } from "@/app/components/ui/utils";
import { SlackIcon } from "@/app/components/common/SlackIcon";

// Slack 워크스페이스 바로가기 URL. .env(VITE_SLACK_URL)로 오버라이드 가능.
const SLACK_URL =
  (import.meta.env?.VITE_SLACK_URL as string | undefined) ?? "https://slack.com";
export interface SidebarItem {
  key: string;
  label: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  /** 같은 group 값을 가진 항목은 하나의 카테고리 카드로 묶입니다. */
  group?: string;
}

interface SidebarProps {
  items: SidebarItem[];
  /** 구분선 아래(하단)에 별도로 노출할 보조 항목 (예: 유사 프로젝트 검색). */
  bottomItems?: SidebarItem[];
  active: string;
  onSelect: (key: string) => void;
  showIntegrations?: boolean;
  hideOnMobile?: boolean;
}

const SIDEBAR_STORAGE_KEY = "aipm.sidebar-width";
const DEFAULT_SIDEBAR_WIDTH = 240;
const MIN_SIDEBAR_WIDTH = 190;
const MAX_SIDEBAR_WIDTH = 380;

const ACTIVE_ITEM_CLASS =
  "bg-emerald-200/85 font-medium text-emerald-950 shadow-sm ring-1 ring-emerald-300/80 dark:bg-violet-600/25 dark:text-violet-50 dark:ring-violet-500/45";
const INACTIVE_ITEM_CLASS =
  "text-emerald-900/70 hover:bg-emerald-100/85 hover:text-emerald-950 dark:text-zinc-300/80 dark:hover:bg-violet-950/75 dark:hover:text-violet-50";

export function Sidebar({
  items,
  bottomItems,
  active,
  onSelect,
  showIntegrations = true,
  hideOnMobile = false,
}: SidebarProps) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const savedWidth = localStorage.getItem(SIDEBAR_STORAGE_KEY);

    if (!savedWidth) return DEFAULT_SIDEBAR_WIDTH;
    const parsedWidth = Number(savedWidth);
    if (Number.isNaN(parsedWidth)) return DEFAULT_SIDEBAR_WIDTH;

    return Math.min(
      MAX_SIDEBAR_WIDTH,
      Math.max(MIN_SIDEBAR_WIDTH, parsedWidth),
    );
  });

  const groupedItems = useMemo(() => {
    const groups: Array<{ label: string; items: SidebarItem[] }> = [];

    items.forEach((item) => {
      const label = item.group ?? "메뉴";
      const currentGroup = groups[groups.length - 1];
      if (!currentGroup || currentGroup.label !== label) {
        groups.push({ label, items: [item] });
        return;
      }

      currentGroup.items.push(item);
    });

    return groups;
  }, [items]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = sidebarWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const movedDistance = moveEvent.clientX - startX;
      const nextWidth = startWidth + movedDistance;
      const limitedWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, nextWidth),
      );

      setSidebarWidth(limitedWidth);
    };
    const stopResize = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
  };

  const resetSidebarWidth = () => {
    setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
  };

  return (
    <aside
      className={cn(
        "relative flex shrink-0 flex-col border-r border-emerald-200/80 bg-gradient-to-b from-emerald-50 via-teal-50/90 to-cyan-50/70 text-emerald-950 shadow-[4px_0_24px_-18px_rgba(5,150,105,0.75)] dark:border-violet-950/90 dark:from-black dark:via-zinc-950 dark:to-purple-950 dark:text-violet-50",
        hideOnMobile && "hidden md:flex",
      )}
      style={{ width: `${sidebarWidth}px` }}
    >
      <div className="flex h-16 items-center gap-2.5 overflow-hidden border-b border-emerald-200/70 px-5 dark:border-violet-900/60">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 dark:from-violet-500 dark:to-purple-700 dark:shadow-purple-950/45">
          <Sparkles className="size-5" />
        </div>
        <div className="min-w-0 whitespace-nowrap leading-tight">
          <div className="truncate font-semibold tracking-tight text-emerald-950 dark:text-violet-50">
            BidWorks AI
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-3 py-3">
        {groupedItems.map((group) => (
          <section
            key={group.label}
            aria-label={group.label}
            className="rounded-2xl border border-emerald-200/70 bg-white/60 p-1.5 shadow-sm backdrop-blur-sm dark:border-violet-900/60 dark:bg-black/35"
          >
            <div className="flex items-center gap-2 px-2.5 pb-1.5 pt-1">
              <span
                className="size-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/40 dark:bg-violet-400 dark:shadow-violet-500/35"
                aria-hidden="true"
              />
              <span className="whitespace-nowrap text-[11px] font-semibold tracking-wide text-emerald-800/80 dark:text-violet-300/80">
                {group.label}
              </span>
            </div>

            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.key === active;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onSelect(item.key)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group relative flex w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm transition-all",
                      isActive ? ACTIVE_ITEM_CLASS : INACTIVE_ITEM_CLASS,
                    )}
                  >
                    <span
                      className={cn(
                        "absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-emerald-500 transition-opacity dark:bg-violet-500",
                        isActive ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden="true"
                    />
                    <Icon
                      className={cn(
                        "size-4 shrink-0 transition-colors",
                        isActive
                          ? "text-emerald-700 dark:text-violet-300"
                          : "text-emerald-700/55 group-hover:text-emerald-800 dark:text-violet-300/55 dark:group-hover:text-violet-200",
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        {bottomItems && bottomItems.length > 0 ? (
          <div className="space-y-0.5 pt-1">
            <div
              role="separator"
              className="mx-2 my-2 border-t border-emerald-200/70 dark:border-violet-900/60"
              aria-hidden="true"
            />
            {bottomItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.key === active;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onSelect(item.key)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group relative flex w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm transition-all",
                    isActive ? ACTIVE_ITEM_CLASS : INACTIVE_ITEM_CLASS,
                  )}
                >
                  <span
                    className={cn(
                      "absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-emerald-500 transition-opacity dark:bg-violet-500",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden="true"
                  />
                  <Icon
                    className={cn(
                      "size-4 shrink-0 transition-colors",
                      isActive
                        ? "text-emerald-700 dark:text-violet-300"
                        : "text-emerald-700/55 group-hover:text-emerald-800 dark:text-violet-300/55 dark:group-hover:text-violet-200",
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </nav>

      {showIntegrations ? (
        <div className="overflow-hidden border-t border-emerald-200/70 p-3 dark:border-violet-900/60">
          <section className="rounded-2xl border border-emerald-200/70 bg-white/60 p-1.5 shadow-sm backdrop-blur-sm dark:border-violet-900/60 dark:bg-black/35">
            <div className="flex items-center gap-2 px-2.5 pb-1.5 pt-1">
              <span
                className="size-1.5 rounded-full bg-teal-500 shadow-sm shadow-teal-500/40 dark:bg-purple-400 dark:shadow-purple-500/35"
                aria-hidden="true"
              />
              <span className="whitespace-nowrap text-[11px] font-semibold tracking-wide text-emerald-800/80 dark:text-violet-300/80">
                연동 서비스
              </span>
            </div>
            {/* 복잡한 OAuth 연동 대신 단순 외부 링크(Slack 바로가기)로 대체 */}
            <a
              href={SLACK_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="group relative flex w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm text-emerald-900/70 transition-all hover:bg-emerald-100/85 hover:text-emerald-950 dark:text-zinc-300/80 dark:hover:bg-violet-950/75 dark:hover:text-violet-50"
            >
              <SlackIcon className="shrink-0 text-base" />
              <span className="truncate">Slack 바로가기</span>
              <ExternalLink className="ml-auto size-3.5 shrink-0 opacity-60" />
            </a>
          </section>
        </div>
      ) : null}

      <div
        role="separator"
        aria-label="사이드바 너비 조절"
        aria-orientation="vertical"
        title="드래그하여 너비 조절 · 더블클릭하여 초기화"
        onPointerDown={startResize}
        onDoubleClick={resetSidebarWidth}
        className="absolute right-0 top-0 z-20 h-full w-1.5 cursor-col-resize transition-colors hover:bg-emerald-400/35 active:bg-emerald-500/55 dark:hover:bg-violet-500/30 dark:active:bg-violet-500/50"
      />
    </aside>
  );
}