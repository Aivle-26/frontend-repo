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
    buttonLabel: "일정 생성 바로가기",
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
 * 서버에 실제 저장된 데이터 중 가장 뒤까지 완료된 단계를 기준으로
 * 프로젝트 카드의 다음 이동 단계를 결정합니다.
 *
 * 하위 단계 API 응답 형식이나 상태가 오래된 경우에도 이미 생성된 WBS/일정을
 * 놓치지 않도록 일정 -> WBS -> 요구사항 순서로 역방향 확인합니다.
 */
export async function getProjectPlanningProgress(
  projectId: string | number,
): Promise<ProjectPlanningProgress> {
  // 1. 일정 결과가 하나라도 저장되어 있으면 다음 단계는 업무 배정입니다.
  try {
    const schedule = await projectRepository.getSchedules(projectId);
    const schedules = Array.isArray(schedule.schedules)
      ? schedule.schedules
      : [];

    if (schedules.length > 0) {
      return STAGE_META.assign;
    }
  } catch (error) {
    if (!isNotFound(error)) {
      // 일정 조회 API가 아직 배포되지 않았거나 일시 실패해도
      // WBS/요구사항 단계 판별은 계속 진행합니다.
      console.warn(`프로젝트 ${projectId} 일정 진행도 조회 실패`, error);
    }
  }

  // 2. AI 제안 또는 최종 WBS 작업이 하나라도 생성되어 있으면
  //    다음 단계는 일정 생성입니다. finalConfirmed 여부로 막지 않습니다.
  try {
    const wbs = await projectRepository.getWbs(projectId);
    const aiSuggestionTasks = Array.isArray(wbs.aiSuggestionTasks)
      ? wbs.aiSuggestionTasks
      : [];
    const finalTasks = Array.isArray(wbs.finalTasks) ? wbs.finalTasks : [];

    if (aiSuggestionTasks.length > 0 || finalTasks.length > 0) {
      return STAGE_META.schedule;
    }
  } catch (error) {
    if (!isNotFound(error)) {
      console.warn(`프로젝트 ${projectId} WBS 진행도 조회 실패`, error);
    }
  }

  // 3. 확정 요구사항이 있으면 다음 단계는 WBS 생성입니다.
  try {
    const requirements = await projectRepository.getRequirements(projectId);
    const finalRequirements = Array.isArray(requirements.finalRequirements)
      ? requirements.finalRequirements
      : [];
    const hasConfirmedRequirements = finalRequirements.some(
      (requirement) =>
        requirement.confirmed === true || requirement.status === "CONFIRMED",
    );

    if (hasConfirmedRequirements) {
      return STAGE_META.wbs;
    }
  } catch (error) {
    if (!isNotFound(error)) {
      console.warn(`프로젝트 ${projectId} 요구사항 진행도 조회 실패`, error);
    }
  }

  return STAGE_META.requirements;
}
