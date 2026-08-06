import {
  ApiError,
  projectRepository,
} from "@/app/api/projectRepository";

export type PlanningStage =
  | "requirements"
  | "wbs"
  | "schedule"
  | "assign"
  | "budget"
  | "uiPrototype";

 const BUDGET_COMPLETED_STORAGE_KEY =
   "bidworks:completed-project-budgets";

 const UI_PROTOTYPE_COMPLETED_STORAGE_KEY =
   "bidworks:completed-project-ui-prototypes";

 function readCompletedIds(storageKey: string): string[] {
   if (typeof window === "undefined") {
     return [];
   }

   try {
     const raw = window.localStorage.getItem(storageKey);

     if (!raw) {
       return [];
     }

     const parsed = JSON.parse(raw);

     return Array.isArray(parsed)
       ? parsed.map((value) => String(value))
       : [];
   } catch {
     return [];
   }
 }

 function readCompletedBudgetProjectIds(): string[] {
   return readCompletedIds(BUDGET_COMPLETED_STORAGE_KEY);
 }

 export function isProjectBudgetCompleted(
   projectId: string | number,
 ): boolean {
   return readCompletedBudgetProjectIds().includes(
     String(projectId),
   );
 }

 export function markProjectBudgetCompleted(
   projectId: string | number,
 ): void {
   if (typeof window === "undefined") {
     return;
   }

   const projectIds = new Set(
     readCompletedBudgetProjectIds(),
   );

   projectIds.add(String(projectId));

   window.localStorage.setItem(
     BUDGET_COMPLETED_STORAGE_KEY,
     JSON.stringify([...projectIds]),
   );

   window.dispatchEvent(
     new CustomEvent("project-budget-completed", {
       detail: {
         projectId: String(projectId),
       },
     }),
   );
 }

 /** UI 프로토타입 생성 단계 완료 여부 (아직 이 단계를 뒷받침하는 백엔드가 없어 예산 완료와 같은
  * localStorage 방식으로 추적한다). */
 export function isProjectUiPrototypeCompleted(
   projectId: string | number,
 ): boolean {
   return readCompletedIds(UI_PROTOTYPE_COMPLETED_STORAGE_KEY).includes(
     String(projectId),
   );
 }

 export function markProjectUiPrototypeCompleted(
   projectId: string | number,
 ): void {
   if (typeof window === "undefined") {
     return;
   }

   const projectIds = new Set(
     readCompletedIds(UI_PROTOTYPE_COMPLETED_STORAGE_KEY),
   );

   projectIds.add(String(projectId));

   window.localStorage.setItem(
     UI_PROTOTYPE_COMPLETED_STORAGE_KEY,
     JSON.stringify([...projectIds]),
   );

   window.dispatchEvent(
     new CustomEvent("project-ui-prototype-completed", {
       detail: {
         projectId: String(projectId),
       },
     }),
   );
 }

export interface ProjectPlanningProgress {
  stage: PlanningStage;
  buttonLabel: string;
  /** 요구사항-WBS-일정-업무 배정까지 모두 끝나 운영 화면을 열 수 있는 상태 */
  planningComplete: boolean;
}

const STAGE_META: Record<PlanningStage, ProjectPlanningProgress> = {
  requirements: {
    stage: "requirements",
    buttonLabel: "요구사항 만들러 가기",
    planningComplete: false,
  },
  wbs: {
    stage: "wbs",
    buttonLabel: "WBS 만들러 가기",
    planningComplete: false,
  },
  schedule: {
    stage: "schedule",
    buttonLabel: "일정 생성 바로가기",
    planningComplete: false,
  },
  assign: {
    stage: "assign",
    buttonLabel: "업무 배정하러 가기",
    planningComplete: false,
  },
  budget: {
    stage: "budget",
    buttonLabel: "예산 설정하러 가기",
    planningComplete: false,
  },
  uiPrototype: {
    stage: "uiPrototype",
    buttonLabel: "UI 프로토타입 만들러 가기",
    planningComplete: false,
  },
};

const DASHBOARD_PROGRESS: ProjectPlanningProgress = {
  stage: "budget",
  buttonLabel: "대시보드 열기",
  planningComplete: true,
};

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/**
 * 예산 완료 여부를 서버(최종 확정 견적 존재)로 판단한다.
 * localStorage 플래그는 브라우저/계정마다 달라 사람마다 랜딩이 갈리므로, DB를 우선한다.
 * 조회 자체가 실패(네트워크 등)하면 기존 localStorage 플래그로 폴백한다.
 */
async function isBudgetSavedOnServer(
  projectId: string | number,
): Promise<boolean> {
  try {
    const cost = await projectRepository.getFinalCostEstimate(projectId);
    return cost != null && (cost.confirmed === true || cost.costEstimateId != null);
  } catch (error) {
    if (isNotFound(error)) {
      return false;
    }
    return isProjectBudgetCompleted(projectId);
  }
}

/**
 * 서버 실데이터를 가장 뒤 단계부터 확인합니다.
 *
 * - 모든 WBS leaf task가 실제 업무로 배정됨: 계획 완료 → 기존 운영 대시보드
 * - 일정 존재: 업무 배정
 * - WBS 존재: 일정 생성
 * - 확정 요구사항 존재: WBS 생성
 * - 그 외: 요구사항 작성
 */
export async function getProjectPlanningProgress(
  projectId: string | number,
): Promise<ProjectPlanningProgress> {
  // 1. 실제 업무 배정 완료 여부
  // 백엔드 /progress 응답에서 전체 leaf task 수와 배정 task 수가 같으면
  // 계획 단계가 끝난 것으로 판정합니다.
  try {
    const progress = await projectRepository.getProjectProgress(projectId);
    const totalTaskCount = Number(progress.totalTaskCount ?? 0);
    const assignedTaskCount = Number(progress.assignedTaskCount ?? 0);

    if (totalTaskCount > 0 && assignedTaskCount >= totalTaskCount) {
      if (!(await isBudgetSavedOnServer(projectId))) {
        return STAGE_META.budget;
      }
      return isProjectUiPrototypeCompleted(projectId)
        ? DASHBOARD_PROGRESS
        : STAGE_META.uiPrototype;
    }
  } catch (error) {
    if (!isNotFound(error)) {
      console.warn(`프로젝트 ${projectId} 업무 배정 진행도 조회 실패`, error);
    }
  }

  // 2. 일정 결과가 저장되어 있으면 다음 단계는 업무 배정입니다.
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
      console.warn(`프로젝트 ${projectId} 일정 진행도 조회 실패`, error);
    }
  }

  // 3. AI 제안 또는 최종 WBS 작업이 있으면 일정 생성 단계입니다.
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

  // 4. 확정 요구사항이 있으면 WBS 생성 단계입니다.
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