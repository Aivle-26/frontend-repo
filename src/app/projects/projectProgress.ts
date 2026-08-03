import {
  ApiError,
  projectRepository,
} from "@/app/api/projectRepository";

export type PlanningStage =
  | "requirements"
  | "wbs"
  | "schedule"
  | "assign"
  | "budget";

export interface ProjectPlanningProgress {
  stage: PlanningStage;
  buttonLabel: string;
}

const STAGE_META: Record<PlanningStage, ProjectPlanningProgress> = {
  requirements: {
    stage: "requirements",
    buttonLabel: "요구사항 만들러 가기",
  },
  wbs: {
    stage: "wbs",
    buttonLabel: "WBS 만들러 가기",
  },
  schedule: {
    stage: "schedule",
    buttonLabel: "일정 만들러 가기",
  },
  assign: {
    stage: "assign",
    buttonLabel: "업무 배정하러 가기",
  },
  budget: {
    stage: "budget",
    buttonLabel: "예산 설정하러 가기",
  },
};

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/**
 * 서버에 실제 저장된 계획 데이터를 순서대로 조회해 다음 진행 단계를 결정합니다.
 *
 * 현재 백엔드에는 배정 결과/최종 예산 조회 API가 없으므로,
 * 확정 일정 이후에는 업무 배정 단계까지만 판별합니다.
 */
export async function getProjectPlanningProgress(
  projectId: string | number,
): Promise<ProjectPlanningProgress> {
  const requirements = await projectRepository.getRequirements(projectId);
  const finalRequirements = Array.isArray(requirements.finalRequirements)
    ? requirements.finalRequirements
    : [];
  const hasConfirmedRequirements = finalRequirements.some(
    (requirement) =>
      requirement.confirmed === true || requirement.status === "CONFIRMED",
  );

  if (!hasConfirmedRequirements) {
    return STAGE_META.requirements;
  }

  try {
    const wbs = await projectRepository.getWbs(projectId);
    const finalTasks = Array.isArray(wbs.finalTasks) ? wbs.finalTasks : [];

    if (wbs.finalConfirmed !== true || finalTasks.length === 0) {
      return STAGE_META.wbs;
    }
  } catch (error) {
    if (isNotFound(error)) {
      return STAGE_META.wbs;
    }
    throw error;
  }

  try {
    const schedule = await projectRepository.getSchedules(projectId);
    const schedules = Array.isArray(schedule.schedules)
      ? schedule.schedules
      : [];
    const allSchedulesConfirmed =
      schedules.length > 0 &&
      schedules.every((item) => item.confirmed === true);

    if (!allSchedulesConfirmed) {
      return STAGE_META.schedule;
    }
  } catch (error) {
    if (isNotFound(error)) {
      return STAGE_META.schedule;
    }
    throw error;
  }

  return STAGE_META.assign;
}
