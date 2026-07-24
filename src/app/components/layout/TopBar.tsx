import { LogOut } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { Badge } from "@/app/components/ui/badge";
import { ThemeToggle } from "@/app/components/common/ThemeToggle";
import { NotificationCenter } from "@/app/components/notifications/NotificationCenter";
import type { ProjectSummary } from "@/app/data/demoData";

interface TopBarProps {
  title: string;
  subtitle?: string;
  userName: string;
  roleLabel: string;
  onLogout: () => void;
  actions?: React.ReactNode;
  projects?: ProjectSummary[];
  selectedProjectId?: string;
  isPm?: boolean;
}

export function TopBar({
  title,
  subtitle,
  userName,
  roleLabel,
  onLogout,
  actions,
  projects = [],
  selectedProjectId,
  isPm = false,
}: TopBarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-6">
      <div className="leading-tight">
        <div className="text-foreground">{title}</div>
        {subtitle && (
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {actions}
        <Badge variant="secondary">{roleLabel}</Badge>
        <ThemeToggle />

        <NotificationCenter
          projects={projects}
          selectedProjectId={selectedProjectId}
          isPm={isPm}
        />

        <Avatar className="size-8">
          <AvatarFallback>{userName.slice(0, 1)}</AvatarFallback>
        </Avatar>

        <Button variant="outline" size="sm" onClick={onLogout}>
          <LogOut className="size-4" />
          로그아웃
        </Button>
      </div>
    </header>
  );
}