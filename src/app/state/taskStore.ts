import { useEffect, useState } from "react";
import { TASKS, type Task, type TaskColumn, type Priority } from "@/app/data/demoData";
import {
  projectRepository,
  type TaskAssignmentResponse,
  type TaskProgressStatus,
} from "@/app/api/projectRepository";
import { toast } from "sonner";

/**
 * 업무 보드 스토어입니다.
 *
 * 실제 백엔드 API(GET /tasks/me, PATCH /tasks/{wbsId}/progress)를 씁니다.
 * 화면(StaffDashboard)이 마운트될 때 loadTasks(projectId, projectName)를
 * 한 번 호출해줘야 하고, 그 뒤로는 이 모듈이 메모리에 최신 상태를 들고
 * 있으면서 커스텀 이벤트로 화면들끼리 동기화합니다.
 *
 * 실제 배정된 업무가 아직 없거나(빈 배열) API 호출 자체가 실패하면,
 * 화면이 텅 비어 보이지 않도록 예시(더미) 업무로 채운다. 이 경우
 * isDemoData가 true가 되므로 화면에서 "예시 데이터" 표시에 활용할 수 있다.
 */

const TASK_CHANGED_EVENT = "aipm:tasks-changed";

let currentTasks: Task[] = [];
let currentProjectId: string | null = null;
let currentIsDemoData = false;

function notify(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TASK_CHANGED_EVENT));
  }
}

function statusToColumn(status: TaskProgressStatus): TaskColumn {
  if (status === "COMPLETED") return "done";
  if (status === "TODO") return "todo";
  // IN_PROGRESS / REVIEW / DELAYED — 검토 요청 컬럼은 없앴으므로 진행 중으로 묶는다.
  return "doing";
}

function columnToStatus(column: TaskColumn): { status: TaskProgressStatus; progressRate: number } {
  if (column === "done") return { status: "COMPLETED", progressRate: 100 };
  if (column === "todo") return { status: "TODO", progressRate: 0 };
  return { status: "IN_PROGRESS", progressRate: 50 };
}

/** 백엔드 응답을 화면에서 쓰는 Task 형태로 변환한다. */
function mapTask(res: TaskAssignmentResponse, projectName: string): Task {
  const priority: Priority = res.overdue || res.milestone ? "높음" : "중간";
  return {
    id: String(res.wbsId),
    title: res.taskName,
    column: statusToColumn(res.status),
    priority,
    due: res.dueDate ?? "-",
    assignee: "나",
    relatedReq: res.description || res.taskCode,
    projectName,
  };
}

/** 프로젝트를 열 때(StaffDashboard 마운트 시) 호출해서 실제 업무 목록을 불러온다. */
export async function loadTasks(projectId: string, projectName: string): Promise<void> {
  // 이미 같은 프로젝트의 예시(더미) 데이터를 보여주고 있다면 다시 불러오지 않는다.
  // (예시 데이터는 서버에 진짜로 존재하지 않아서, 화면 안에서 "완료 처리" 같은
  //  로컬 상태 변경을 했더라도 재조회하면 항상 초기 상태로 리셋되어 버리기 때문.)
  if (currentProjectId === projectId && currentIsDemoData && currentTasks.length > 0) {
    notify();
    return;
  }

  currentProjectId = projectId;
  try {
    const list = await projectRepository.getMyTasks(projectId);
    if (list.length > 0) {
      currentTasks = list.map((t) => mapTask(t, projectName));
      currentIsDemoData = false;
    } else {
      // 아직 실제로 배정된 업무가 없다 — 화면이 비어 보이지 않도록 예시 데이터로 채운다.
      // 예시 데이터는 원래 갖고 있던 다양한 프로젝트명을 그대로 보여준다(현재 프로젝트로 통일하지 않음).
      currentTasks = TASKS;
      currentIsDemoData = true;
    }
  } catch (error) {
    console.error("업무 목록을 불러오지 못했습니다.", error);
    toast.error("실제 업무 목록을 불러오지 못해 예시 데이터를 보여드려요.");
    currentTasks = TASKS;
    currentIsDemoData = true;
  }
  notify();
}

/** 지금 보이는 업무 목록이 실제 데이터가 아니라 예시(더미)인지 여부. */
export function isTasksDemoData(): boolean {
  return currentIsDemoData;
}

export function getTasks(): Task[] {
  return currentTasks;
}

async function patchProgress(taskId: string, column: TaskColumn): Promise<void> {
  if (!currentProjectId) return;

  // 예시(더미) 데이터를 보고 있을 때는 실제 백엔드에 존재하지 않는 업무라
  // API를 호출하면 무조건 실패한다. 화면 상태만 바꿔주고 서버 호출은 건너뛴다.
  if (currentIsDemoData) {
    currentTasks = currentTasks.map((t) => (t.id === taskId ? { ...t, column } : t));
    notify();
    return;
  }

  const { status, progressRate } = columnToStatus(column);

  // 낙관적 업데이트: 응답 기다리지 않고 화면부터 바꾼다.
  const previous = currentTasks;
  currentTasks = currentTasks.map((t) => (t.id === taskId ? { ...t, column } : t));
  notify();

  try {
    await projectRepository.updateTaskProgress(currentProjectId, taskId, {
      status,
      progressRate,
    });
  } catch (error) {
    console.error("업무 상태 변경에 실패했습니다.", error);
    toast.error("업무 상태 변경에 실패했습니다. 다시 시도해 주세요.");
    // 실패하면 원래 상태로 되돌린다.
    currentTasks = previous;
    notify();
  }
}

/** 특정 업무를 완료 상태로 변경합니다. */
export function completeTask(taskId: string): void {
  void patchProgress(taskId, "done");
}

/** 특정 업무의 열(column)을 변경합니다. (todo / doing / done) */
export function updateTaskColumn(taskId: string, column: TaskColumn): void {
  void patchProgress(taskId, column);
}

/**
 * React 컴포넌트에서 업무 목록을 구독하는 Hook입니다.
 * 업무가 변경되면 자동으로 새로운 업무 목록을 불러와 화면을 다시 렌더링합니다.
 */
export function useTasks(): Task[] {
  const [tasks, setTasks] = useState<Task[]>(() => getTasks());

  useEffect(() => {
    const sync = () => setTasks(getTasks());

    window.addEventListener(TASK_CHANGED_EVENT, sync);

    return () => {
      window.removeEventListener(TASK_CHANGED_EVENT, sync);
    };
  }, []);

  return tasks;
}