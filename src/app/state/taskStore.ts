import { useEffect, useState } from "react";
import {
  TASKS,
  type Task,
  type TaskColumn,
} from "@/app/data/demoData";

const TASK_STORAGE_KEY = "aipm.tasks";
const TASK_CHANGED_EVENT = "aipm:tasks-changed";

/**
 * 현재 실행 환경에서 localStorage를 사용할 수 있는지 확인합니다.
 */
function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

/**
 * 저장된 업무 목록을 불러옵니다.
 *
 * 저장된 업무가 없다면 demoData.ts의 TASKS를
 * 초기 업무 데이터로 저장한 뒤 반환합니다.
 */
export function getTasks(): Task[] {
  if (!canUseStorage()) {
    return TASKS;
  }

  const savedTasks = window.localStorage.getItem(
    TASK_STORAGE_KEY,
  );

  if (!savedTasks) {
    window.localStorage.setItem(
      TASK_STORAGE_KEY,
      JSON.stringify(TASKS),
    );

    return TASKS;
  }

  try {
    return JSON.parse(savedTasks) as Task[];
  } catch (error) {
    console.error("업무 데이터를 읽지 못했습니다.", error);

    window.localStorage.setItem(
      TASK_STORAGE_KEY,
      JSON.stringify(TASKS),
    );

    return TASKS;
  }
}

/**
 * 변경된 업무 목록을 localStorage에 저장합니다.
 *
 * 저장 후 커스텀 이벤트를 발생시켜
 * 현재 화면의 다른 컴포넌트도 변경을 감지하게 합니다.
 */
function saveTasks(tasks: Task[]): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(
    TASK_STORAGE_KEY,
    JSON.stringify(tasks),
  );

  window.dispatchEvent(
    new CustomEvent(TASK_CHANGED_EVENT),
  );
}

/**
 * 특정 업무의 열(column)을 변경합니다.
 *
 * todo   : 할 일
 * doing  : 진행 중
 * review : 검토
 * done   : 완료
 */
export function updateTaskColumn(
  taskId: string,
  column: TaskColumn,
): void {
  const currentTasks = getTasks();

  const updatedTasks = currentTasks.map((task) => {
    if (task.id !== taskId) {
      return task;
    }

    return {
      ...task,
      column,
    };
  });

  saveTasks(updatedTasks);
}

/**
 * 특정 업무를 완료 상태로 변경합니다.
 */
export function completeTask(taskId: string): void {
  updateTaskColumn(taskId, "done");
}

/**
 * 업무를 추가하거나 기존 업무를 수정합니다.
 *
 * 같은 ID의 업무가 있으면 수정하고,
 * 같은 ID가 없으면 새 업무를 추가합니다.
 */
export function upsertTask(task: Task): void {
  const currentTasks = getTasks();

  const taskExists = currentTasks.some(
    (currentTask) => currentTask.id === task.id,
  );

  const updatedTasks = taskExists
    ? currentTasks.map((currentTask) =>
        currentTask.id === task.id
          ? {
              ...currentTask,
              ...task,
            }
          : currentTask,
      )
    : [...currentTasks, task];

  saveTasks(updatedTasks);
}

/**
 * 특정 업무를 삭제합니다.
 */
export function removeTask(taskId: string): void {
  const updatedTasks = getTasks().filter(
    (task) => task.id !== taskId,
  );

  saveTasks(updatedTasks);
}

/**
 * React 컴포넌트에서 업무 목록을 사용하는 Hook입니다.
 *
 * 업무가 변경되면 자동으로 새로운 업무 목록을 불러와
 * 화면을 다시 렌더링합니다.
 */
export function useTasks(): Task[] {
  const [tasks, setTasks] = useState<Task[]>(() =>
    getTasks(),
  );

  useEffect(() => {
    const synchronizeTasks = () => {
      setTasks(getTasks());
    };

    window.addEventListener(
      TASK_CHANGED_EVENT,
      synchronizeTasks,
    );

    window.addEventListener(
      "storage",
      synchronizeTasks,
    );

    return () => {
      window.removeEventListener(
        TASK_CHANGED_EVENT,
        synchronizeTasks,
      );

      window.removeEventListener(
        "storage",
        synchronizeTasks,
      );
    };
  }, []);

  return tasks;
}