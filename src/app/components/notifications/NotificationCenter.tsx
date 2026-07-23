import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BellRing,
  Check,
  CheckCheck,
  ClipboardCheck,
  Clock3,
  FolderKanban,
  MessageSquareReply,
  ShieldAlert,
  UserRoundPlus,
} from "lucide-react";

import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { Separator } from "@/app/components/ui/separator";
import { cn } from "@/app/components/ui/utils";
import type { ProjectSummary } from "@/app/data/demoData";
import {
  createProjectNotifications,
  NOTIFICATION_PRIORITY_SCORE,
  type NotificationPriority,
  type NotificationType,
  type ProjectNotification,
} from "@/app/data/notificationData";

interface NotificationCenterProps {
  projects: ProjectSummary[];
  selectedProjectId?: string;
  isPm: boolean;
}

type PriorityFilter = "전체" | NotificationPriority;

const PRIORITY_FILTERS: PriorityFilter[] = [
  "전체",
  "긴급",
  "높음",
  "중간",
  "낮음",
];

const TYPE_LABEL: Record<NotificationType, string> = {
  risk: "리스크",
  feedback: "피드백",
  review: "검토",
  schedule: "일정",
  assignment: "업무 배정",
  system: "시스템",
};

export function NotificationCenter({
  projects,
  selectedProjectId,
  isPm,
}: NotificationCenterProps) {const [open, setOpen] = useState(false);
  const projectKey = projects.map((project) => project.id).join("|");
  const [notifications, setNotifications] = useState<ProjectNotification[]>(
    () => createProjectNotifications(projects),
  );
  const [projectChannel, setProjectChannel] = useState<string>(
    selectedProjectId || "all",
  );
  const [priorityFilter, setPriorityFilter] =
    useState<PriorityFilter>("전체");

  useEffect(() => {
    setNotifications((current) => {
      const readState = new Map(
        current.map((notification) => [
          notification.id,
          notification.unread,
        ]),
      );

      return createProjectNotifications(projects).map((notification) => ({
        ...notification,
        unread:
          readState.get(notification.id) ?? notification.unread,
      }));
    });
  }, [projectKey]);

  useEffect(() => {
    if (!isPm && selectedProjectId) {
      setProjectChannel(selectedProjectId);
    }
  }, [isPm, selectedProjectId]);

  const visibleNotifications = useMemo(() => {
    return notifications
      .filter((notification) =>
        projectChannel === "all"
          ? true
          : notification.projectId === projectChannel,
      )
      .filter((notification) =>
        priorityFilter === "전체"
          ? true
          : notification.priority === priorityFilter,
      )
      .sort((a, b) => {
        const priorityDifference =
          NOTIFICATION_PRIORITY_SCORE[b.priority] -
          NOTIFICATION_PRIORITY_SCORE[a.priority];

        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        return Number(b.unread) - Number(a.unread);
      });
  }, [notifications, priorityFilter, projectChannel]);

  const riskTop3 = useMemo(
    () =>
      visibleNotifications
        .filter((notification) => notification.type === "risk")
        .slice(0, 3),
    [visibleNotifications],
  );

  const regularNotifications = useMemo(
    () =>
      visibleNotifications.filter(
        (notification) =>
          !riskTop3.some((risk) => risk.id === notification.id),
      ),
    [riskTop3, visibleNotifications],
  );

  const unreadCount = notifications.filter(
    (notification) => notification.unread,
  ).length;

  const currentChannelName =
    projectChannel === "all"
      ? "전체 프로젝트"
      : projects.find(
          (project) => String(project.id) === projectChannel,
        )?.name ?? "선택 프로젝트";

  const markAsRead = (notificationId: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, unread: false }
          : notification,
      ),
    );
  };

  const markChannelAsRead = () => {
    setNotifications((current) =>
      current.map((notification) => {
        const belongsToChannel =
          projectChannel === "all" ||
          notification.projectId === projectChannel;

        return belongsToChannel
          ? { ...notification, unread: false }
          : notification;
      }),
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <PopoverTrigger
        type="button"
        aria-label={`알림함, 읽지 않은 알림 ${unreadCount}개`}
        className="
          relative inline-flex size-9 shrink-0
          items-center justify-center rounded-md
          text-sm font-medium
          transition-colors
          hover:bg-accent hover:text-accent-foreground
          focus-visible:outline-none
          focus-visible:ring-2
          focus-visible:ring-ring
        "
      >
        {unreadCount > 0 ? (
          <BellRing className="size-4" />
        ) : (
          <Bell className="size-4" />
        )}

        {unreadCount > 0 && (
          <span
            className="
              absolute right-0.5 top-0.5
              flex min-w-4 items-center justify-center
              rounded-full bg-destructive px-1
              text-[10px] leading-4
              text-destructive-foreground
            "
          >
            {unreadCount > 99
              ? "99+"
              : unreadCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={10}
        collisionPadding={16}
        className="z-[100] w-[min(94vw,560px)] overflow-hidden p-0"
      >
     
        <div className="flex items-start justify-between gap-4 p-4 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <BellRing className="size-4" />
              <h2 className="font-medium text-foreground">알림함</h2>
              <Badge variant="secondary">미확인 {unreadCount}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              프로젝트별 알림을 우선순위 순으로 확인합니다.
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={markChannelAsRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck className="size-4" />
            모두 읽음
          </Button>
        </div>

        <Separator />

        <div className="space-y-3 p-4 pb-3">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <FolderKanban className="size-3.5" />
              프로젝트 채널
            </div>

            <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
              {isPm && (
                <ChannelButton
                  active={projectChannel === "all"}
                  label="전체"
                  count={notifications.length}
                  onClick={() => setProjectChannel("all")}
                />
              )}

              {projects.map((project) => {
                const projectId = String(project.id);
                const count = notifications.filter(
                  (notification) =>
                    notification.projectId === projectId,
                ).length;

                return (
                  <ChannelButton
                    key={projectId}
                    active={projectChannel === projectId}
                    label={project.name}
                    count={count}
                    onClick={() => setProjectChannel(projectId)}
                  />
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs text-muted-foreground">
              우선순위 분류
            </div>

            <div className="flex flex-wrap gap-1.5">
              {PRIORITY_FILTERS.map((priority) => (
                <Button
                  key={priority}
                  type="button"
                  size="sm"
                  variant={
                    priorityFilter === priority ? "default" : "outline"
                  }
                  className="h-7 px-2.5 text-xs"
                  onClick={() => setPriorityFilter(priority)}
                >
                  {priority}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <Separator />

        <ScrollArea className="h-[min(66vh,620px)]">
          <div className="space-y-5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-foreground">
                  {currentChannelName}
                </div>
                <div className="text-xs text-muted-foreground">
                  긴급 → 높음 → 중간 → 낮음 순
                </div>
              </div>

              <Badge variant="outline">
                {visibleNotifications.length}건
              </Badge>
            </div>

            {riskTop3.length > 0 && (
              <section className="space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="size-4 text-destructive" />
                  <h3 className="text-sm font-medium text-foreground">
                    리스크 우선순위 TOP {riskTop3.length}
                  </h3>
                </div>

                <div className="space-y-2">
                  {riskTop3.map((notification, index) => (
                    <NotificationRow
                      key={notification.id}
                      notification={notification}
                      rank={index + 1}
                      onRead={markAsRead}
                    />
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <Bell className="size-4" />
                <h3 className="text-sm font-medium text-foreground">
                  전체 알림
                </h3>
              </div>

              {regularNotifications.length > 0 ? (
                <div className="space-y-2">
                  {regularNotifications.map((notification) => (
                    <NotificationRow
                      key={notification.id}
                      notification={notification}
                      onRead={markAsRead}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <Check className="mx-auto size-5 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    해당 조건의 추가 알림이 없습니다.
                  </p>
                </div>
              )}
            </section>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function ChannelButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="sm"
      className="h-8 shrink-0 gap-1.5 whitespace-nowrap"
      onClick={onClick}
    >
      <span className="max-w-40 truncate">{label}</span>
      <span className="text-[10px] text-muted-foreground">{count}</span>
    </Button>
  );
}

function NotificationRow({
  notification,
  rank,
  onRead,
}: {
  notification: ProjectNotification;
  rank?: number;
  onRead: (notificationId: string) => void;
}) {
  const Icon = notificationIcon(notification.type);

  return (
    <button
      type="button"
      onClick={() => onRead(notification.id)}
      className={cn(
        "w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/60",
        notification.unread && "border-primary/30 bg-primary/5",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="relative mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <Icon className="size-4" />
          {rank && (
            <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] text-destructive-foreground">
              {rank}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <PriorityBadge priority={notification.priority} />
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                  {TYPE_LABEL[notification.type]}
                </Badge>
                {notification.unread && (
                  <span className="size-1.5 rounded-full bg-primary" />
                )}
              </div>

              <div className="mt-1.5 text-sm font-medium text-foreground">
                {notification.title}
              </div>
            </div>

            <span className="shrink-0 text-[10px] text-muted-foreground">
              {notification.createdAt}
            </span>
          </div>

          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {notification.message}
          </p>

          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <FolderKanban className="size-3" />
            <span className="truncate">{notification.projectName}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function PriorityBadge({
  priority,
}: {
  priority: NotificationPriority;
}) {
  if (priority === "긴급") {
    return <Badge variant="destructive">긴급</Badge>;
  }

  if (priority === "높음") {
    return (
      <Badge className="border-transparent bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
        높음
      </Badge>
    );
  }

  if (priority === "중간") {
    return <Badge variant="secondary">중간</Badge>;
  }

  return <Badge variant="outline">낮음</Badge>;
}

function notificationIcon(type: NotificationType) {
  switch (type) {
    case "risk":
      return AlertTriangle;
    case "feedback":
      return MessageSquareReply;
    case "review":
      return ClipboardCheck;
    case "schedule":
      return Clock3;
    case "assignment":
      return UserRoundPlus;
    case "system":
      return Bell;
  }
}
