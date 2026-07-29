import type {
  ProjectSummary as ApiProjectSummary,
} from "@/app/api/projectRepository";
import type {
  ProjectStatus,
  ProjectSummary,
} from "@/app/projects/projectTypes";

export function mapApiProject(project: ApiProjectSummary): ProjectSummary {
  return {
    id: String(project.projectId),
    server: {
      description: project.description,
      pmEmployeeNumber: project.pmEmployeeNumber,
      status: project.status,
      plannedStartDate: project.plannedStartDate,
      plannedEndDate: project.plannedEndDate,
    },
    name: project.name,
    client: project.pmEmployeeNumber
      ? `PM ${project.pmEmployeeNumber}`
      : "PM 미지정",
    status: mapProjectStatus(project.status),
    progress: project.status?.toUpperCase() === "COMPLETED" ? 100 : 0,
    dueDate: project.plannedEndDate ?? "-",
    riskCount: 0,
    reqCount: 0,
    wizardStep: 0,
    estimate: "-",
    updatedAt: formatProjectPeriod(
      project.plannedStartDate,
      project.plannedEndDate,
    ),
    docs: [],
    requirements: null,
  };
}

export function formatProjectPeriod(
  startDate: string | null,
  endDate: string | null,
) {
  if (startDate && endDate) return `${startDate} ~ ${endDate}`;
  if (startDate) return `${startDate} 시작`;
  if (endDate) return `${endDate} 종료 예정`;
  return "-";
}

export function formatServerProjectStatus(status?: string) {
  const normalized = status?.trim().toUpperCase();
  const labels: Record<string, string> = {
    ACTIVE: "진행 중",
    IN_PROGRESS: "진행 중",
    COMPLETED: "완료",
    PENDING_APPROVAL: "승인 대기",
    ANALYZING: "분석 중",
    DRAFT: "준비",
    READY: "준비",
  };

  if (!normalized) return "상태 없음";
  return labels[normalized] ?? status!.trim();
}

function mapProjectStatus(status: string): ProjectStatus {
  const normalized = status.trim().toUpperCase();
  if (
    normalized === "ACTIVE" ||
    normalized === "IN_PROGRESS" ||
    normalized === "진행중"
  ) {
    return "진행중";
  }
  if (normalized === "COMPLETED" || normalized === "완료") return "완료";
  if (
    normalized === "PENDING_APPROVAL" ||
    normalized === "승인대기"
  ) {
    return "승인대기";
  }
  if (normalized === "ANALYZING" || normalized === "분석중") return "분석중";
  return "준비";
}
