import { useEffect, useState } from "react";

/**
 * PM ↔ 직원 피드백 채팅 스토어.
 *
 * ⚠️ 의도적으로 localStorage에 저장하지 않습니다. — 직원 화면은 아직
 * "UI만 구현" 단계라 시연용으로 쓰지 않기 때문에, 코드를 새로 받거나
 * 새로고침하거나 로그아웃 후 재로그인하면 항상 초기 대화 내용(SEED_MESSAGES)으로
 * 깨끗하게 리셋되는 게 더 낫습니다.
 *
 * 메모리(모듈 변수)에만 상태를 두고, 같은 세션(탭을 새로고침하지 않은 동안)
 * 안에서는 커스텀 이벤트로 화면들끼리 동기화됩니다. 실제 채팅 백엔드 API가
 * 생기면 이 스토어를 그 API 호출로 교체하면 됩니다.
 */

export interface FeedbackChatMessage {
  id: string;
  sender: "pm" | "staff";
  authorName: string;
  text: string;
  /** ISO 문자열 */
  sentAt: string;
}

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

let currentMessages: FeedbackChatMessage[] = SEED_MESSAGES;

export function getFeedbackMessages(): FeedbackChatMessage[] {
  return currentMessages;
}

function setFeedbackMessages(messages: FeedbackChatMessage[]): void {
  currentMessages = messages;

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
  }
}

/** 메시지를 맨 뒤에 추가합니다. */
export function sendFeedbackMessage(
  sender: "pm" | "staff",
  authorName: string,
  text: string,
): void {
  const trimmed = text.trim();
  if (!trimmed) return;

  const message: FeedbackChatMessage = {
    id: `fc${Date.now()}`,
    sender,
    authorName,
    text: trimmed,
    sentAt: new Date().toISOString(),
  };
  setFeedbackMessages([...currentMessages, message]);
}

/** React 컴포넌트에서 채팅 내역을 구독하는 Hook입니다. */
export function useFeedbackChat(): FeedbackChatMessage[] {
  const [messages, setMessages] = useState<FeedbackChatMessage[]>(() =>
    getFeedbackMessages(),
  );

  useEffect(() => {
    const sync = () => setMessages(getFeedbackMessages());

    window.addEventListener(CHANGED_EVENT, sync);

    return () => {
      window.removeEventListener(CHANGED_EVENT, sync);
    };
  }, []);

  return messages;
}