import { useEffect, useState } from "react";
import type { Task, TaskColumn, Priority } from "@/app/data/demoData";
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
 */

const TASK_CHANGED_EVENT = "aipm:tasks-changed";

let currentTasks: Task[] = [];
let currentProjectId: string | null = null;

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
  currentProjectId = projectId;
  try {
    const list = await projectRepository.getMyTasks(projectId);
    currentTasks = list.map((t) => mapTask(t, projectName));
  } catch (error) {
    console.error("업무 목록을 불러오지 못했습니다.", error);
    toast.error("업무 목록을 불러오지 못했습니다.");
    currentTasks = [];
  }
  notify();
}

export function getTasks(): Task[] {
  return currentTasks;
}

async function patchProgress(taskId: string, column: TaskColumn): Promise<void> {
  if (!currentProjectId) return;
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