import {
  CheckCircle2,
  FolderKanban,
  Hash,
  LogOut,
  UserRound,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
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
  projects = [],
  selectedProjectId,
  isPm = false,
  compactOnMobile = false,
}: TopBarProps) {
  const initial = userName.trim().slice(0, 1) || "U";

  const selectedProject = projects.find(
    (project) => String(project.id) === String(selectedProjectId),
  );

  return (
    <header
      className={cn(
        "flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-6",
        compactOnMobile && "gap-2 px-3 sm:px-6",
      )}
    >
      <div className="min-w-0 leading-tight">
        <div className="truncate text-foreground">{title}</div>
        {subtitle && (
          <div className="truncate text-xs text-muted-foreground">
            {subtitle}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {actions}
        <Badge
          variant="secondary"
          className={cn(compactOnMobile && "hidden sm:inline-flex")}
        >
          {roleLabel}
        </Badge>
        <ThemeToggle />

        <div className={cn(compactOnMobile && "hidden sm:block")}>
          <Popover>
          <PopoverTrigger
            type="button"
            aria-label="내 프로필 열기"
            title="내 프로필"
            className="rounded-full outline-none ring-offset-background transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Avatar className="size-8 cursor-pointer border border-border">
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
          </PopoverTrigger>

          <PopoverContent
            align="end"
            side="bottom"
            sideOffset={10}
            collisionPadding={16}
            className="z-[110] w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden p-0"
          >
            <div className="bg-muted/35 p-5">
              <div className="flex items-center gap-3">
                <Avatar className="size-12 border border-border bg-background">
                  <AvatarFallback className="text-base font-semibold">
                    {initial}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate font-semibold text-foreground">
                      {userName}
                    </div>
                    <Badge variant={isPm ? "default" : "secondary"}>
                      {roleLabel}
                    </Badge>
                  </div>

                  <div className="mt-1 text-xs text-muted-foreground">
                    {isPm ? "프로젝트 매니저" : "프로젝트 참여 직원"}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

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
    <div className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50">
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>

      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-0.5 break-words text-sm text-foreground">
          {value}
        </div>
      </div>
    </div>
  );
}
