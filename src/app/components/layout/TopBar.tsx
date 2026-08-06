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
        "flex h-16 shrink-0 items-center justify-between border-b border-emerald-200/80 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50/80 px-6 shadow-[0_4px_18px_-16px_rgba(5,150,105,0.9)] dark:border-emerald-800/70 dark:from-emerald-950 dark:via-teal-950/95 dark:to-slate-950",
        compactOnMobile && "gap-2 px-3 sm:px-6",
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
        <div className="min-w-0 shrink-0 leading-tight">
          <div className="truncate font-medium text-emerald-950 dark:text-emerald-50">
            {title}
          </div>
          {subtitle && (
            <div className="truncate text-xs text-emerald-700/70 dark:text-emerald-200/65">
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
            "border border-emerald-200 bg-white/70 text-emerald-800 shadow-sm dark:border-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-100",
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
              className="group flex items-center gap-2 rounded-full border border-emerald-200 bg-white/75 py-1 pl-1 pr-3 shadow-sm outline-none backdrop-blur-sm transition-all hover:border-emerald-300 hover:bg-emerald-100/80 hover:shadow-md focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/55 dark:hover:border-emerald-600 dark:hover:bg-emerald-800/70 dark:focus-visible:ring-offset-emerald-950"
            >
              <UserRound className="size-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
              <span className="whitespace-nowrap text-sm font-semibold text-emerald-950 dark:text-emerald-50">
                {displayName}
              </span>
            </PopoverTrigger>

            <PopoverContent
              align="end"
              side="bottom"
              sideOffset={10}
              collisionPadding={16}
              className="z-[110] w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden border-emerald-200 p-0 shadow-xl dark:border-emerald-800"
            >
              <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-5 dark:from-emerald-950 dark:via-teal-950 dark:to-slate-950">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-emerald-300 bg-white/70 text-emerald-700 shadow-sm dark:border-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-200">
                    <UserRound className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="break-words text-base font-semibold text-emerald-950 dark:text-emerald-50">
                        {displayName}
                      </div>
                      <Badge
                        variant={isPm ? "default" : "secondary"}
                        className="border border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-100"
                      >
                        {roleLabel}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-emerald-700/70 dark:text-emerald-200/65">
                      {isPm ? "프로젝트 매니저" : "프로젝트 참여 직원"}
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="bg-emerald-100 dark:bg-emerald-900" />

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
          className="border-emerald-200 bg-white/65 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-950 dark:border-emerald-700 dark:bg-emerald-900/45 dark:text-emerald-100 dark:hover:bg-emerald-800 dark:hover:text-emerald-50"
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
    <div className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/65">
      <span className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-emerald-700/65 dark:text-emerald-300/65">
          {label}
        </div>
        <div className="mt-0.5 break-words text-sm text-foreground">
          {value}
        </div>
      </div>
    </div>
  );
}
