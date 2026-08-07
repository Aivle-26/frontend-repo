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
const MIN_SIDEBAR_WIDTH = 72;
const ICON_ONLY_THRESHOLD = 170;
const MAX_SIDEBAR_WIDTH = 380;

const ACTIVE_ITEM_CLASS =
  "bg-cyan-100/90 font-medium text-teal-950 shadow-sm ring-1 ring-cyan-300/90 dark:bg-violet-600/25 dark:text-violet-50 dark:ring-violet-500/45";
const INACTIVE_ITEM_CLASS =
  "text-teal-900/70 hover:bg-cyan-100/90 hover:text-teal-950 dark:text-zinc-300/80 dark:hover:bg-violet-950/75 dark:hover:text-violet-50";

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

  const isIconOnly = sidebarWidth < ICON_ONLY_THRESHOLD;

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
        "relative flex shrink-0 flex-col border-r border-cyan-200/90 bg-gradient-to-b from-cyan-50 via-teal-50/95 to-sky-50/85 text-teal-950 shadow-[4px_0_26px_-18px_rgba(8,145,178,0.78)] dark:border-violet-950/90 dark:from-black dark:via-zinc-950 dark:to-purple-950 dark:text-violet-50",
        hideOnMobile && "hidden md:flex",
      )}
      style={{ width: `${sidebarWidth}px` }}
    >
      <div
        className={cn(
          "flex h-16 items-center overflow-hidden border-b border-cyan-200/80 dark:border-violet-900/60",
          isIconOnly ? "justify-center px-2" : "gap-2.5 px-5",
        )}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-md shadow-cyan-500/25 dark:from-violet-500 dark:to-purple-700 dark:shadow-purple-950/45">
          <Sparkles className="size-5" />
        </div>
        {!isIconOnly ? (
          <div className="min-w-0 whitespace-nowrap leading-tight">
            <div className="truncate font-semibold tracking-tight text-teal-950 dark:text-violet-50">
              BidWorks AI
            </div>
          </div>
        ) : null}
      </div>

      <nav
        className={cn(
          "flex-1 space-y-3 overflow-y-auto overflow-x-hidden py-3",
          isIconOnly ? "px-2" : "px-3",
        )}
      >
        {groupedItems.map((group) => (
          <section
            key={group.label}
            aria-label={group.label}
            className={cn(
              "border border-cyan-200/80 bg-white/68 shadow-sm backdrop-blur-sm dark:border-violet-900/60 dark:bg-black/35",
              isIconOnly ? "rounded-xl p-1" : "rounded-2xl p-1.5",
            )}
          >
            {!isIconOnly ? (
              <div className="flex items-center gap-2 px-2.5 pb-1.5 pt-1">
                <span
                  className="size-1.5 rounded-full bg-cyan-500 shadow-sm shadow-cyan-500/45 dark:bg-violet-400 dark:shadow-violet-500/35"
                  aria-hidden="true"
                />
                <span className="whitespace-nowrap text-[11px] font-semibold tracking-wide text-teal-800/80 dark:text-violet-300/80">
                  {group.label}
                </span>
              </div>
            ) : null}

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
                    aria-label={item.label}
                    title={isIconOnly ? item.label : undefined}
                    className={cn(
                      "group relative flex w-full items-center whitespace-nowrap rounded-xl py-2.5 text-sm transition-all",
                      isIconOnly ? "justify-center px-2" : "gap-3 px-3 text-left",
                      isActive ? ACTIVE_ITEM_CLASS : INACTIVE_ITEM_CLASS,
                    )}
                  >
                    <span
                      className={cn(
                        "absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-cyan-500 transition-opacity dark:bg-violet-500",
                        isActive ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden="true"
                    />
                    <Icon
                      className={cn(
                        "size-4 shrink-0 transition-colors",
                        isActive
                          ? "text-teal-700 dark:text-violet-300"
                          : "text-teal-700/55 group-hover:text-teal-800 dark:text-violet-300/55 dark:group-hover:text-violet-200",
                      )}
                    />
                    {!isIconOnly ? <span className="truncate">{item.label}</span> : null}
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
              className="mx-2 my-2 border-t border-cyan-200/80 dark:border-violet-900/60"
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
                  aria-label={item.label}
                  title={isIconOnly ? item.label : undefined}
                  className={cn(
                    "group relative flex w-full items-center whitespace-nowrap rounded-xl py-2.5 text-sm transition-all",
                    isIconOnly ? "justify-center px-2" : "gap-3 px-3 text-left",
                    isActive ? ACTIVE_ITEM_CLASS : INACTIVE_ITEM_CLASS,
                  )}
                >
                  <span
                    className={cn(
                      "absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-cyan-500 transition-opacity dark:bg-violet-500",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden="true"
                  />
                  <Icon
                    className={cn(
                      "size-4 shrink-0 transition-colors",
                      isActive
                        ? "text-teal-700 dark:text-violet-300"
                        : "text-teal-700/55 group-hover:text-teal-800 dark:text-violet-300/55 dark:group-hover:text-violet-200",
                    )}
                  />
                  {!isIconOnly ? <span className="truncate">{item.label}</span> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </nav>

      {showIntegrations ? (
        <div
          className={cn(
            "overflow-hidden border-t border-cyan-200/80 dark:border-violet-900/60",
            isIconOnly ? "p-2" : "p-3",
          )}
        >
          <section
            className={cn(
              "border border-cyan-200/80 bg-white/68 shadow-sm backdrop-blur-sm dark:border-violet-900/60 dark:bg-black/35",
              isIconOnly ? "rounded-xl p-1" : "rounded-2xl p-1.5",
            )}
          >
            {!isIconOnly ? (
              <div className="flex items-center gap-2 px-2.5 pb-1.5 pt-1">
                <span
                  className="size-1.5 rounded-full bg-teal-500 shadow-sm shadow-teal-500/40 dark:bg-purple-400 dark:shadow-purple-500/35"
                  aria-hidden="true"
                />
                <span className="whitespace-nowrap text-[11px] font-semibold tracking-wide text-teal-800/80 dark:text-violet-300/80">
                  연동 서비스
                </span>
              </div>
            ) : null}
            {/* 복잡한 OAuth 연동 대신 단순 외부 링크(Slack 바로가기)로 대체 */}
            <a
              href={SLACK_URL}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Slack 바로가기"
              title={isIconOnly ? "Slack 바로가기" : undefined}
              className={cn(
                "group relative flex w-full items-center whitespace-nowrap rounded-xl py-2.5 text-sm text-teal-900/70 transition-all hover:bg-cyan-100/90 hover:text-teal-950 dark:text-zinc-300/80 dark:hover:bg-violet-950/75 dark:hover:text-violet-50",
                isIconOnly ? "justify-center px-2" : "gap-3 px-3 text-left",
              )}
            >
              <SlackIcon className="shrink-0 text-base" />
              {!isIconOnly ? (
                <>
                  <span className="truncate">Slack 바로가기</span>
                  <ExternalLink className="ml-auto size-3.5 shrink-0 opacity-60" />
                </>
              ) : null}
            </a>
          </section>
        </div>
      ) : null}

      <div
        role="separator"
        aria-label="사이드바 너비 조절"
        aria-orientation="vertical"
        title="드래그하여 너비 조절 · 좁히면 아이콘 모드 · 더블클릭하여 초기화"
        onPointerDown={startResize}
        onDoubleClick={resetSidebarWidth}
        className="absolute right-0 top-0 z-20 h-full w-1.5 cursor-col-resize transition-colors hover:bg-cyan-400/35 active:bg-cyan-500/55 dark:hover:bg-violet-500/30 dark:active:bg-violet-500/50"
      />
    </aside>
  );
}