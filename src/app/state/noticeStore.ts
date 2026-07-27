import { useEffect, useState } from "react";
import { STAFF_NOTICES, type Notice } from "@/app/data/demoData";

/**
 * 공지사항을 보관/추가하는 스토어입니다.
 * 정적 데이터(STAFF_NOTICES)를 초기값으로 쓰고, PM이 등록한 공지를
 * taskStore와 동일한 localStorage + 커스텀 이벤트 패턴으로 유지합니다.
 * (백엔드 연동 시 이 스토어를 공지 API 호출로 교체)
 */

const STORAGE_KEY = "aipm.notices";
const CHANGED_EVENT = "aipm:notices-changed";

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

export function getNotices(): Notice[] {
  if (!canUseStorage()) {
    return STAFF_NOTICES;
  }

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(STAFF_NOTICES));
    return STAFF_NOTICES;
  }

  try {
    return JSON.parse(saved) as Notice[];
  } catch (error) {
    console.error("공지 데이터를 읽지 못했습니다.", error);
    return STAFF_NOTICES;
  }
}

function saveNotices(notices: Notice[]): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notices));
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
}

/** 새 공지를 목록 맨 앞에 추가합니다. */
export function addNotice(notice: Omit<Notice, "id">): void {
  const current = getNotices();
  const newNotice: Notice = { ...notice, id: `n${Date.now()}` };
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
