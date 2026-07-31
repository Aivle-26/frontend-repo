import { useEffect, useState } from "react";
import type { Notice } from "@/app/data/demoData";

/**
 * 사용자가 직접 등록한 공지만 브라우저 저장소에 보관합니다.
 * 정적 공지 더미데이터는 초기값으로 사용하지 않습니다.
 *
 * 현재 백엔드에 공지사항 API가 없으므로 등록 내용은 이 브라우저의
 * localStorage에만 저장됩니다. 서버 공지 API가 추가되면 이 저장소를
 * API 호출 방식으로 교체해야 여러 사용자에게 동일하게 공유할 수 있습니다.
 */

const STORAGE_KEY = "aipm.notices";
const CHANGED_EVENT = "aipm:notices-changed";
const LEGACY_DUMMY_IDS = new Set(["n1", "n2", "n3", "n4", "n5", "n6", "n7"]);

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function isNotice(value: unknown): value is Notice {
  if (!value || typeof value !== "object") return false;
  const notice = value as Partial<Notice>;
  return (
    typeof notice.id === "string" &&
    typeof notice.title === "string" &&
    typeof notice.author === "string" &&
    typeof notice.date === "string" &&
    typeof notice.summary === "string" &&
    Array.isArray(notice.content)
  );
}

export function getNotices(): Notice[] {
  if (!canUseStorage()) return [];

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return [];

  try {
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return [];
    }

    // 과거 버전에서 자동으로 주입했던 n1~n7 더미 공지를 제거하고,
    // 사용자가 등록해 생성된 공지만 유지합니다.
    const notices = parsed.filter(isNotice).filter((notice) => !LEGACY_DUMMY_IDS.has(notice.id));

    if (notices.length !== parsed.length) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notices));
    }

    return notices;
  } catch (error) {
    console.error("공지 데이터를 읽지 못했습니다.", error);
    window.localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

function saveNotices(notices: Notice[]): void {
  if (!canUseStorage()) return;

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notices));
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
}

/** 새 공지를 목록 맨 앞에 추가합니다. */
export function addNotice(notice: Omit<Notice, "id">): void {
  const current = getNotices();
  const newNotice: Notice = {
    ...notice,
    id: `n${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  saveNotices([newNotice, ...current]);
}

/** React 컴포넌트에서 공지 목록을 구독하는 Hook입니다. */
export function useNotices(): Notice[] {
  const [notices, setNotices] = useState<Notice[]>(() => getNotices());

  useEffect(() => {
    const sync = () => setNotices(getNotices());

    window.addEventListener(CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener(CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return notices;
}
