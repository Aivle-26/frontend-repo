import { useEffect, useState } from "react";

/**
 * PM ↔ 직원 피드백 채팅 스토어.
 * 아직 실시간 채팅 백엔드가 없어서, taskStore/noticeStore와 동일한
 * localStorage + 커스텀 이벤트 패턴으로 우선 구현한다.
 * (백엔드 채팅 API가 생기면 이 스토어를 그 API 호출로 교체하면 된다.)
 */

export interface FeedbackChatMessage {
  id: string;
  sender: "pm" | "staff";
  authorName: string;
  text: string;
  /** ISO 문자열 */
  sentAt: string;
}

const STORAGE_KEY = "aipm.feedbackChat";
const CHANGED_EVENT = "aipm:feedback-chat-changed";

const SEED_MESSAGES: FeedbackChatMessage[] = [
  {
    id: "fc1",
    sender: "pm",
    authorName: "PM 정하늘",
    text: "3.2 환경 규정 준수 초안 검토했어요. 근거 조항 인용 부분만 보강해 주시면 좋을 것 같아요.",
    sentAt: "2026-07-27T10:12:00",
  },
  {
    id: "fc2",
    sender: "staff",
    authorName: "나",
    text: "네 확인했습니다! 오늘 중으로 근거 조항 추가해서 다시 올릴게요.",
    sentAt: "2026-07-27T10:20:00",
  },
];

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

export function getFeedbackMessages(): FeedbackChatMessage[] {
  if (!canUseStorage()) {
    return SEED_MESSAGES;
  }

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_MESSAGES));
    return SEED_MESSAGES;
  }

  try {
    return JSON.parse(saved) as FeedbackChatMessage[];
  } catch (error) {
    console.error("피드백 채팅 데이터를 읽지 못했습니다.", error);
    return SEED_MESSAGES;
  }
}

function saveFeedbackMessages(messages: FeedbackChatMessage[]): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
}

/** 메시지를 맨 뒤에 추가합니다. */
export function sendFeedbackMessage(
  sender: "pm" | "staff",
  authorName: string,
  text: string,
): void {
  const trimmed = text.trim();
  if (!trimmed) return;

  const current = getFeedbackMessages();
  const message: FeedbackChatMessage = {
    id: `fc${Date.now()}`,
    sender,
    authorName,
    text: trimmed,
    sentAt: new Date().toISOString(),
  };
  saveFeedbackMessages([...current, message]);
}

/** React 컴포넌트에서 채팅 내역을 구독하는 Hook입니다. */
export function useFeedbackChat(): FeedbackChatMessage[] {
  const [messages, setMessages] = useState<FeedbackChatMessage[]>(() =>
    getFeedbackMessages(),
  );

  useEffect(() => {
    const sync = () => setMessages(getFeedbackMessages());

    window.addEventListener(CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener(CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return messages;
}