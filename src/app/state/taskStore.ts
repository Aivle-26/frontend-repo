import { useEffect, useState } from "react";
import {
  TASKS,
  type Task,
  type TaskColumn,
} from "@/app/data/demoData";

/**
 * 업무 보드 스토어입니다.
 *
 * ⚠️ 의도적으로 localStorage에 저장하지 않습니다. — 직원 화면은 아직
 * "UI만 구현" 단계라 시연용으로 쓰지 않기 때문에, 코드를 새로 받거나
 * 새로고침하거나 로그아웃 후 재로그인하면 항상 데모 데이터(TASKS)로
 * 깨끗하게 리셋되는 게 더 낫습니다.
 *
 * 메모리(모듈 변수)에만 상태를 두고, 같은 세션(탭을 새로고침하지 않은 동안)
 * 안에서는 커스텀 이벤트로 화면들끼리 동기화됩니다. 실제 백엔드 API가
 * 생기면 이 스토어를 그 API 호출로 교체하면 됩니다.
 */

const TASK_CHANGED_EVENT = "aipm:tasks-changed";

let currentTasks: Task[] = TASKS;

export function getTasks(): Task[] {
  return currentTasks;
}

function setTasks(tasks: Task[]): void {
  currentTasks = tasks;

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TASK_CHANGED_EVENT));
  }
}

/**
 * 특정 업무의 열(column)을 변경합니다.
 *
 * todo   : 할 일
 * doing  : 진행 중
 * review : 검토
 * done   : 완료
 */
export function updateTaskColumn(taskId: string, column: TaskColumn): void {
  setTasks(
    currentTasks.map((task) => (task.id === taskId ? { ...task, column } : task)),
  );
}

/** 특정 업무를 완료 상태로 변경합니다. */
export function completeTask(taskId: string): void {
  updateTaskColumn(taskId, "done");
}

/**
 * 업무를 추가하거나 기존 업무를 수정합니다.
 * 같은 ID의 업무가 있으면 수정하고, 없으면 새 업무를 추가합니다.
 */
export function upsertTask(task: Task): void {
  const exists = currentTasks.some((t) => t.id === task.id);
  setTasks(
    exists
      ? currentTasks.map((t) => (t.id === task.id ? { ...t, ...task } : t))
      : [...currentTasks, task],
  );
}

/** 특정 업무를 삭제합니다. */
export function removeTask(taskId: string): void {
  setTasks(currentTasks.filter((task) => task.id !== taskId));
}

/**
 * React 컴포넌트에서 업무 목록을 구독하는 Hook입니다.
 * 업무가 변경되면 자동으로 새로운 업무 목록을 불러와 화면을 다시 렌더링합니다.
 */
export function useTasks(): Task[] {
  const [tasks, setTasksState] = useState<Task[]>(() => getTasks());

  useEffect(() => {
    const sync = () => setTasksState(getTasks());

    window.addEventListener(TASK_CHANGED_EVENT, sync);

    return () => {
      window.removeEventListener(TASK_CHANGED_EVENT, sync);
    };
  }, []);

  return tasks;
}