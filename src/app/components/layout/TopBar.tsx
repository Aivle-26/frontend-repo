import {
  CheckCircle2,
  FolderKanban,
  Hash,
  LogOut,
  UserRound,
} from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import { Separator } from "@/app/components/ui/separator";
import { ThemeToggle } from "@/app/components/common/ThemeToggle";
import { cn } from "@/app/components/ui/utils";
import type { ProjectSummary } from "@/app/projects/projectTypes";

interface TopBarProps {
  title: string;
  subtitle?: string;
  userName: string;
  employeeNumber?: string;
  roleLabel: string;
  onLogout: () => void;
  actions?: React.ReactNode;
  /** 타이틀 바로 옆(오른쪽)에 렌더링할 내용 — 대상 프로젝트 선택 바 등. */
  middleContent?: React.ReactNode;
  projects?: ProjectSummary[];
  selectedProjectId?: string;
  isPm?: boolean;
  showNotifications?: boolean;
  compactOnMobile?: boolean;
}

export function TopBar({
  title,
  subtitle,
  userName,
  employeeNumber = "-",
  roleLabel,
  onLogout,
  actions,
  middleContent,
  projects = [],
  selectedProjectId,
  isPm = false,
  compactOnMobile = false,
}: TopBarProps) {
  const displayName = userName.trim() || "사용자";

  const selectedProject = projects.find(
    (project) => String(project.id) === String(selectedProjectId),
  );

  return (
    <header
      className={cn(
        "flex h-[80px] shrink-0 items-center justify-between border-b-[3px] border-cyan-200/90 bg-gradient-to-r from-cyan-50 via-teal-50 to-sky-50/90 px-7 shadow-[0_6px_24px_-15px_rgba(8,145,178,0.9)] dark:border-violet-950/90 dark:from-black dark:via-zinc-950 dark:to-purple-950",
        compactOnMobile && "gap-2 px-3 sm:px-6",
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
        <div className="min-w-0 shrink-0 leading-tight">
          <div className="truncate text-xl font-bold text-teal-950 dark:text-violet-50">
            {title}
          </div>
          {subtitle && (
            <div className="truncate text-[0.94rem] font-medium text-teal-700/75 dark:text-violet-300/75">
              {subtitle}
            </div>
          )}
        </div>
        {middleContent && <div className="min-w-0">{middleContent}</div>}
      </div>

      <div className="flex items-center gap-3">
        {actions}
        <Badge
          variant="secondary"
          className={cn(
            "border border-cyan-200 bg-white/76 text-[0.94rem] font-semibold text-teal-800 shadow-sm dark:border-violet-700/70 dark:bg-violet-950/45 dark:text-violet-200",
            compactOnMobile && "hidden sm:inline-flex",
          )}
        >
          {roleLabel}
        </Badge>

        <ThemeToggle />

        <div className={cn(compactOnMobile && "hidden sm:block")}>
          <Popover>
            <PopoverTrigger
              type="button"
              aria-label={`${displayName} 프로필 열기`}
              title={`${displayName} 프로필`}
              className="group flex items-center gap-2 rounded-full border border-cyan-200 bg-white/80 py-1.5 pl-2 pr-3.5 shadow-sm outline-none backdrop-blur-sm transition-all hover:border-cyan-300 hover:bg-cyan-100/85 hover:shadow-md focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-cyan-50 dark:border-violet-800/80 dark:bg-black/45 dark:hover:border-violet-600 dark:hover:bg-violet-950/70 dark:focus-visible:ring-violet-500 dark:focus-visible:ring-offset-black"
            >
              <UserRound className="size-[18px] shrink-0 text-teal-700 dark:text-violet-300" />
              <span className="whitespace-nowrap text-[1.05rem] font-semibold text-teal-950 dark:text-violet-50">
                {displayName}
              </span>
            </PopoverTrigger>

            <PopoverContent
              align="end"
              side="bottom"
              sideOffset={10}
              collisionPadding={16}
              className="z-[110] w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden border-cyan-200 p-0 shadow-xl dark:border-violet-900/70"
            >
              <div className="bg-gradient-to-br from-cyan-50 via-teal-50 to-sky-50 p-5 dark:from-black dark:via-zinc-950 dark:to-purple-950">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-cyan-300 bg-white/76 text-teal-700 shadow-sm dark:border-violet-700/70 dark:bg-violet-950/55 dark:text-violet-200">
                    <UserRound className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="break-words text-base font-semibold text-teal-950 dark:text-violet-50">
                        {displayName}
                      </div>
                      <Badge
                        variant={isPm ? "default" : "secondary"}
                        className="border border-cyan-300 bg-cyan-100 text-teal-800 dark:border-violet-700/70 dark:bg-violet-950/55 dark:text-violet-200"
                      >
                        {roleLabel}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-teal-700/70 dark:text-violet-300/70">
                      {isPm ? "프로젝트 매니저" : "프로젝트 참여 직원"}
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="bg-cyan-100 dark:bg-violet-950/70" />

              <div className="space-y-1 p-3">
                <ProfileRow
                  icon={<Hash className="size-4" />}
                  label="사번"
                  value={employeeNumber || "-"}
                />
                <ProfileRow
                  icon={<UserRound className="size-4" />}
                  label="권한"
                  value={roleLabel}
                />

                {isPm && (
                  <>
                    <ProfileRow
                      icon={<FolderKanban className="size-4" />}
                      label="관리 프로젝트"
                      value={`${projects.length}개`}
                    />
                    <ProfileRow
                      icon={<CheckCircle2 className="size-4" />}
                      label="현재 프로젝트"
                      value={selectedProject?.name ?? "선택되지 않음"}
                    />
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onLogout}
          aria-label="로그아웃"
          title="로그아웃"
          className="border-cyan-200 bg-white/72 text-teal-800 hover:border-cyan-300 hover:bg-cyan-100 hover:text-teal-950 dark:border-violet-800/80 dark:bg-black/35 dark:text-violet-200 dark:hover:border-violet-600 dark:hover:bg-violet-950/65 dark:hover:text-violet-50"
        >
          <LogOut className="size-4" />
          <span className={cn(compactOnMobile && "hidden sm:inline")}>
            로그아웃
          </span>
        </Button>
      </div>
    </header>
  );
}

function ProfileRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-cyan-50 dark:hover:bg-violet-950/60">
      <span className="mt-0.5 shrink-0 text-cyan-700 dark:text-violet-400">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-teal-700/65 dark:text-violet-300/65">
          {label}
        </div>
        <div className="mt-0.5 break-words text-sm text-foreground">
          {value}
        </div>
      </div>
    </div>
  );
}