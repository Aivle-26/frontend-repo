import type { ProjectSummary } from "@/app/data/demoData";

export type NotificationPriority = "긴급" | "높음" | "중간" | "낮음";
export type NotificationType =
  | "risk"
  | "feedback"
  | "review"
  | "schedule"
  | "assignment"
  | "system";

export interface ProjectNotification {
  id: string;
  projectId: string;
  projectName: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  createdAt: string;
  unread: boolean;
}

export const NOTIFICATION_PRIORITY_SCORE: Record<NotificationPriority, number> = {
  긴급: 4,
  높음: 3,
  중간: 2,
  낮음: 1,
};

/**
 * 백엔드 알림 API가 연결되기 전 UI 확인용 데이터입니다.
 * PM이 보유한 프로젝트마다 알림 채널과 샘플 알림을 자동 생성합니다.
 */
export function createProjectNotifications(
  projects: ProjectSummary[],
): ProjectNotification[] {
  return projects.flatMap((project, projectIndex) => {
    const projectId = String(project.id);
    const base = `${projectId}-${projectIndex}`;

    return [
      {
        id: `${base}-risk-1`,
        projectId,
        projectName: project.name,
        type: "risk" as const,
        priority: "긴급" as const,
        title: "리스크 우선 조치 필요",
        message:
          project.riskCount > 0
            ? `현재 ${project.riskCount}건의 리스크가 등록되어 있습니다. 영향도와 대응 담당자를 확인하세요.`
            : "보안 요구사항과 장애 복구 계획에서 미확정 항목이 감지되었습니다.",
        createdAt: "5분 전",
        unread: true,
      },
      {
        id: `${base}-risk-2`,
        projectId,
        projectName: project.name,
        type: "risk" as const,
        priority: "높음" as const,
        title: "일정 지연 가능성 감지",
        message: `${project.dueDate} 마감 일정 기준으로 선행 업무의 여유 기간이 부족합니다.`,
        createdAt: "18분 전",
        unread: true,
      },
      {
        id: `${base}-feedback`,
        projectId,
        projectName: project.name,
        type: "feedback" as const,
        priority: "높음" as const,
        title: "산출물 피드백 요청",
        message: "팀원이 제출한 요구사항 정의서 초안에 대한 PM 검토를 요청했습니다.",
        createdAt: "42분 전",
        unread: true,
      },
      {
        id: `${base}-review`,
        projectId,
        projectName: project.name,
        type: "review" as const,
        priority: "중간" as const,
        title: "검토 대기 산출물",
        message: "검토 대기 중인 산출물이 있습니다. 승인 또는 수정 요청을 선택하세요.",
        createdAt: "1시간 전",
        unread: projectIndex % 2 === 0,
      },
      {
        id: `${base}-assignment`,
        projectId,
        projectName: project.name,
        type: "assignment" as const,
        priority: "중간" as const,
        title: "미배정 요구사항 확인",
        message: `${project.reqCount || 1}개 요구사항 중 담당자가 지정되지 않은 항목을 확인하세요.`,
        createdAt: "오늘 09:20",
        unread: false,
      },
      {
        id: `${base}-system`,
        projectId,
        projectName: project.name,
        type: "system" as const,
        priority: "낮음" as const,
        title: "프로젝트 분석 정보 갱신",
        message: `프로젝트 상태가 '${project.status}' 기준으로 동기화되었습니다.`,
        createdAt: "어제",
        unread: false,
      },
    ];
  });
}
