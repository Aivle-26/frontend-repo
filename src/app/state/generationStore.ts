import { useEffect, useState } from "react";

/**
 * AI 생성 산출물의 "생성 완료" 상태를 프로젝트별로 보관합니다.
 *
 * 컴포넌트 로컬 state로 두면 사이드바 이동(언마운트) 시 사라지므로,
 * taskStore와 동일한 localStorage + 커스텀 이벤트 패턴으로 유지합니다.
 * (백엔드 연동 시 이 스토어를 서버 상태 조회로 교체)
 */

const STORAGE_KEY = "aipm.generation";
const REGISTERED_KEY = "aipm.schedule-registered";
const CHANGED_EVENT = "aipm:generation-changed";

export type GenKey =
  | "req"
  | "milestone"
  | "wbs"
  | "schedule"
  | "ui"
  | "weekly"
  | "decision";

/** projectId -> 생성 완료된 산출물 키 목록 */
type GenerationStore = Record<string, GenKey[]>;

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function readStore(): GenerationStore {
  if (!canUseStorage()) {
    return {};
  }

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return {};
  }

  try {
    return JSON.parse(saved) as GenerationStore;
  } catch (error) {
    console.error("생성 상태를 읽지 못했습니다.", error);
    return {};
  }
}

function writeStore(store: GenerationStore): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
}

/** 특정 프로젝트에서 생성 완료된 산출물 키 목록을 반환합니다. */
export function getGenerated(projectId: string): GenKey[] {
  return readStore()[projectId] ?? [];
}

/** 산출물을 생성 완료로 표시합니다. */
export function markGenerated(projectId: string, key: GenKey): void {
  const store = readStore();
  const list = store[projectId] ?? [];

  if (!list.includes(key)) {
    store[projectId] = [...list, key];
    writeStore(store);
  }
}

/** ---- 일정 등록 상태 (프로젝트 일정으로 등록됨) ---- */

function readRegistered(): string[] {
  if (!canUseStorage()) {
    return [];
  }

  const saved = window.localStorage.getItem(REGISTERED_KEY);
  if (!saved) {
    return [];
  }

  try {
    return JSON.parse(saved) as string[];
  } catch {
    return [];
  }
}

/** 프로젝트 일정이 등록됐는지 여부를 반환합니다. */
export function isScheduleRegistered(projectId: string): boolean {
  return readRegistered().includes(projectId);
}

/** 프로젝트 일정을 등록 상태로 표시합니다. */
export function markScheduleRegistered(projectId: string): void {
  const list = readRegistered();
  if (!list.includes(projectId)) {
    window.localStorage.setItem(
      REGISTERED_KEY,
      JSON.stringify([...list, projectId]),
    );
    window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
  }
}

/** React 컴포넌트에서 일정 등록 상태를 구독하는 Hook입니다. */
export function useScheduleRegistered(projectId: string): boolean {
  const [registered, setRegistered] = useState<boolean>(() =>
    isScheduleRegistered(projectId),
  );

  useEffect(() => {
    const sync = () => setRegistered(isScheduleRegistered(projectId));
    sync();

    window.addEventListener(CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener(CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [projectId]);

  return registered;
}

/**
 * React 컴포넌트에서 생성 완료 상태를 구독하는 Hook입니다.
 * 다른 화면/탭에서 변경돼도 자동으로 다시 렌더링됩니다.
 */
export function useGenerated(projectId: string): Set<GenKey> {
  const [keys, setKeys] = useState<GenKey[]>(() => getGenerated(projectId));

  useEffect(() => {
    const sync = () => setKeys(getGenerated(projectId));
    sync();

    window.addEventListener(CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener(CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [projectId]);

  return new Set(keys);
}
