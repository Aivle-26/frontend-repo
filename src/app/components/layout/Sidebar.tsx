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
// 기본값보다 넓히는 것은 허용하지 않는다. 기본값에서 줄이는 방향으로만 조절 가능.
const MAX_SIDEBAR_WIDTH = DEFAULT_SIDEBAR_WIDTH;

const ACTIVE_ITEM_CLASS =
  "bg-cyan-100/85 font-semibold text-teal-950 shadow-[0_6px_16px_-12px_rgba(13,148,136,0.7)] ring-1 ring-inset ring-cyan-300/85 dark:bg-violet-600/25 dark:text-violet-50 dark:shadow-[0_6px_16px_-12px_rgba(139,92,246,0.65)] dark:ring-violet-500/45";
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
  const standaloneItems = useMemo(
    () => items.filter((item) => !item.group),
    [items],
  );

  const groupedItems = useMemo(() => {
    const groups: Array<{ label: string; items: SidebarItem[] }> = [];

    items.forEach((item) => {
      if (!item.group) return;

      const label = item.group;
      const currentGroup = groups[groups.length - 1];
      if (!currentGroup || currentGroup.label !== label) {
        groups.push({ label, items: [item] });
        return;
      }

      currentGroup.items.push(item);
    });

    return groups;
  }, [items]);
  const distributeGroups = items.length >= 8;

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
        "relative z-30 flex shrink-0 flex-col bg-gradient-to-b from-cyan-50 via-teal-50/95 to-sky-50/85 text-teal-950 shadow-[10px_0_24px_-20px_rgba(8,145,178,0.42)] dark:from-black dark:via-zinc-950 dark:to-purple-950 dark:text-violet-50 dark:shadow-[10px_0_24px_-20px_rgba(139,92,246,0.36)]",
        hideOnMobile && "hidden md:flex",
      )}
      style={{ width: `${sidebarWidth}px` }}
    >
      <div
        className={cn(
          // TopBar와 높이와 그림자 깊이를 맞춰 하나의 헤더처럼 보이게 한다.
          "relative z-10 flex h-[80px] items-center overflow-hidden bg-white/15 shadow-[0_10px_24px_-20px_rgba(8,145,178,0.42)] dark:bg-white/[0.02] dark:shadow-[0_10px_24px_-20px_rgba(139,92,246,0.36)]",
          isIconOnly ? "justify-center px-2" : "gap-2.5 px-5",
        )}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-md shadow-cyan-500/25 dark:from-violet-500 dark:to-purple-700 dark:shadow-purple-950/45">
          <Sparkles className="size-5" />
        </div>
        {!isIconOnly ? (
          <div className="min-w-0 whitespace-nowrap leading-tight">
            <div className="truncate font-semibold tracking-tight text-teal-950 dark:text-violet-50">
              Pmate AI
            </div>
          </div>
        ) : null}
      </div>

      <nav
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2 overflow-hidden py-1.5",
          isIconOnly ? "px-2" : "px-3",
        )}
      >
        {standaloneItems.length > 0 ? (
          <div className="shrink-0">
            {standaloneItems.map((item) => {
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
                    "w-full text-sm font-semibold transition-colors duration-150",
                    isIconOnly
                      ? "flex items-center justify-center py-1.5"
                      : "flex justify-center",
                    isActive
                      ? "text-rose-700 dark:text-rose-200"
                      : "text-rose-600/85 hover:text-rose-700 dark:text-rose-300/85 dark:hover:text-rose-200",
                  )}
                >
                  {isIconOnly ? (
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full transition-all duration-150",
                        isActive
                          ? "bg-rose-600 text-white shadow-[0_4px_10px_-6px_rgba(225,29,72,0.9)] dark:bg-rose-500"
                          : "text-rose-600 dark:text-rose-300",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "relative inline-flex -translate-x-4 items-center gap-2 px-5 py-1.5 transition-transform duration-150",
                      )}
                    >
                      {isActive ? (
                        <span
                          className="absolute inset-0 translate-x-1 rounded-full bg-rose-50/90 shadow-[0_6px_16px_-12px_rgba(225,29,72,0.65)] ring-1 ring-inset ring-rose-200/90 dark:bg-rose-950/35 dark:ring-rose-800/70"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span
                        className={cn(
                          "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full transition-all duration-150",
                          isActive
                            ? "bg-rose-600 text-white shadow-[0_4px_10px_-6px_rgba(225,29,72,0.9)] dark:bg-rose-500"
                            : "text-rose-600 dark:text-rose-300",
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="relative z-10">{item.label}</span>
                    </span>
                  )}
                </button>
              );
            })}
            <div
              role="separator"
              className="mx-2 mt-1 border-t border-cyan-200/80 dark:border-violet-900/60"
              aria-hidden="true"
            />
          </div>
        ) : null}

        <div
          className={cn(
            "min-h-0",
            distributeGroups
              ? "flex flex-1 flex-col gap-3"
              : "space-y-1.5",
          )}
        >
          {groupedItems.map((group) => (
            <section
              key={group.label}
              aria-label={group.label}
              style={
                distributeGroups
                  ? { flexGrow: group.items.length + 1 }
                  : undefined
              }
              className={cn(
                "border border-cyan-200/80 bg-white/68 shadow-sm backdrop-blur-sm dark:border-violet-900/60 dark:bg-black/35",
                isIconOnly ? "rounded-xl p-0.5" : "rounded-2xl p-0.5",
                distributeGroups && "flex min-h-0 flex-1 flex-col",
              )}
            >
              {!isIconOnly ? (
                <div className="flex shrink-0 items-center gap-2 px-2.5 pb-0.5 pt-1.5">
                  <span
                    className="size-1.5 rounded-full bg-cyan-500 shadow-sm shadow-cyan-500/45 dark:bg-violet-400 dark:shadow-violet-500/35"
                    aria-hidden="true"
                  />
                  <span className="whitespace-nowrap text-[11px] font-semibold tracking-wide text-teal-800/80 dark:text-violet-300/80">
                    {group.label}
                  </span>
                </div>
              ) : null}

              <div
                className={cn(
                  distributeGroups
                    ? "flex min-h-0 flex-1 flex-col justify-evenly"
                    : "space-y-0.5",
                )}
              >
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
                        "group flex w-full items-center whitespace-nowrap rounded-xl py-1.5 text-sm transition-[background-color,color,box-shadow] duration-150",
                        isIconOnly ? "justify-center px-2" : "gap-3 px-3 text-left",
                        isActive ? ACTIVE_ITEM_CLASS : INACTIVE_ITEM_CLASS,
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full transition-all duration-150",
                          isActive
                            ? "bg-teal-600 text-white shadow-[0_4px_10px_-6px_rgba(13,148,136,0.9)] dark:bg-violet-500 dark:shadow-[0_4px_10px_-6px_rgba(139,92,246,0.9)]"
                            : "text-teal-700/55 group-hover:text-teal-800 dark:text-violet-300/55 dark:group-hover:text-violet-200",
                        )}
                      >
                        <Icon className={isActive ? "size-4" : "size-3.5"} />
                      </span>
                      {!isIconOnly ? <span className="truncate">{item.label}</span> : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

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
                    "group flex w-full items-center whitespace-nowrap rounded-xl py-1.5 text-sm transition-[background-color,color,box-shadow] duration-150",
                    isIconOnly ? "justify-center px-2" : "gap-3 px-3 text-left",
                    isActive ? ACTIVE_ITEM_CLASS : INACTIVE_ITEM_CLASS,
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full transition-all duration-150",
                      isActive
                        ? "bg-teal-600 text-white shadow-[0_4px_10px_-6px_rgba(13,148,136,0.9)] dark:bg-violet-500 dark:shadow-[0_4px_10px_-6px_rgba(139,92,246,0.9)]"
                        : "text-teal-700/55 group-hover:text-teal-800 dark:text-violet-300/55 dark:group-hover:text-violet-200",
                    )}
                  >
                    <Icon className={isActive ? "size-4" : "size-3.5"} />
                  </span>
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
            "p-2",
          )}
        >
          <section
            className={cn(
              "border border-cyan-200/80 bg-white/68 shadow-sm backdrop-blur-sm dark:border-violet-900/60 dark:bg-black/35",
              isIconOnly ? "rounded-xl p-0.5" : "rounded-2xl p-0.5",
            )}
          >
            {!isIconOnly ? (
              <div className="flex items-center gap-2 px-2.5 pb-0.5 pt-1.5">
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
                "group relative flex w-full items-center whitespace-nowrap rounded-xl py-1.5 text-sm text-teal-900/70 transition-all hover:bg-cyan-100/90 hover:text-teal-950 dark:text-zinc-300/80 dark:hover:bg-violet-950/75 dark:hover:text-violet-50",
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
        className="absolute right-0 top-0 z-20 h-full w-1.5 cursor-col-resize"
      />
    </aside>
  );
}
