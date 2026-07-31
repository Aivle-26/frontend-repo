import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/app/components/ui/utils";
import {
  sendFeedbackMessage,
  useFeedbackChat,
} from "@/app/state/feedbackChatStore";

/**
 * PM 피드백에 간단히 답장할 수 있는 채팅 위젯.
 * 아직 실시간 채팅 백엔드가 없어서 feedbackChatStore(로컬 저장)를 사용한다.
 * PM 쪽 답장 UI는 아직 없다 — 직원이 보낸 메시지는 저장되지만, PM이
 * 답장하려면 PM 화면에도 같은 컴포넌트를 붙여야 한다.
 */

interface PmFeedbackChatProps {
  currentUserName: string;
  /** true면 다이얼로그 등 좁은 공간에 넣기 좋게 목록 높이를 줄인다. */
  compact?: boolean;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PmFeedbackChat({ compact = false }: PmFeedbackChatProps) {
  const messages = useFeedbackChat();
  const [draft, setDraft] = useState("");

  const submit = () => {
    if (!draft.trim()) return;
    // 로그인 계정명(currentUserName)이 뭐든 상관없이 내 메시지는 항상 "나"로 표시한다.
    sendFeedbackMessage("staff", "나", draft);
    setDraft("");
  };

  return (
    <div className="flex flex-col">
      <div className={cn("space-y-3 overflow-y-auto pr-1", compact ? "max-h-40" : "max-h-72")}>
        {messages.map((m) => {
          const isMe = m.sender === "staff";
          return (
            <div
              key={m.id}
              className={cn("flex flex-col", isMe ? "items-end" : "items-start")}
            >
              <div className="mb-1 flex items-center gap-1.5 px-1">
                <span className="text-muted-foreground text-xs">{m.authorName}</span>
                <span className="text-muted-foreground/70 text-xs">
                  {formatTime(m.sentAt)}
                </span>
              </div>
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  isMe
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                {m.text}
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <p className="py-6 text-center text-muted-foreground text-sm">
            아직 대화가 없습니다.
          </p>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="PM에게 답장하기"
          className="flex h-9 w-full rounded-md border border-border bg-transparent px-3 py-1 text-sm outline-none"
        />
        <Button type="button" size="icon" onClick={submit} disabled={!draft.trim()}>
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}