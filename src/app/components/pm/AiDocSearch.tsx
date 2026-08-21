import { useEffect, useRef, useState } from "react";
import {
  Search,
  ArrowRight,
  MessagesSquare,
  Sparkles,
  FileText,
  Loader2,
  AlertCircle,
  Trash2,
  Copy,
  Check,
  Lightbulb,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { AI_SEARCH_EXAMPLES, type ProjectSummary } from "@/app/data/demoData";
import { getAccessToken } from "@/app/api/authToken";
import {
  assistantApi,
  assistantLlmStatusLabel,
  type AssistantAnswer,
  type AssistantSource,
} from "@/app/api/assistantApi";

/** 답변을 기다리는 동안 순서대로 돌아가며 보여줄 문구 (실제 진행 단계와 무관, 연출용) */
const THINKING_MESSAGES = [
  "질문을 이해하는 중…",
  "요구사항 문서를 찾는 중…",
  "WBS·일정을 확인하는 중…",
  "관련 근거를 정리하는 중…",
];

/** 대화 한 턴: 질문 + (로딩/완료/오류) 답변 상태 */
interface Turn {
  id: number;
  question: string;
  status: "loading" | "done" | "error";
  answer: AssistantAnswer | null;
  error: string | null;
}

/** 출처 한 건의 표시 제목. document_name 우선, 없으면 요구사항/WBS id로 대체. */
function sourceTitle(s: AssistantSource): string {
  if (s.documentName) return s.documentName;
  if (s.requirementId != null) return `요구사항 #${s.requirementId}`;
  if (s.wbsId != null) return `WBS #${s.wbsId}`;
  if (s.deliverableId) return `산출물 ${s.deliverableId}`;
  return "관련 자료";
}

export function AiDocSearch({
  project,
  onOpenRequirements,
}: {
  project: ProjectSummary;
  onOpenRequirements?: () => void;
  /** 현재 화면에서는 사용하지 않지만 호출부 호환을 위해 유지한다. */
  onOpenRisk?: () => void;
}) {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const nextId = useRef(1);

  const busy = turns.some((t) => t.status === "loading");
  const started = turns.length > 0;

  const logContainerRef = useRef<HTMLDivElement>(null);

  // 새 질문/답변이 추가되거나 로딩→완료로 바뀔 때마다 최신 대화가 보이도록 맨 아래로 스크롤한다.
  useEffect(() => {
    const el = logContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const ask = async (raw: string) => {
    const q = raw.trim();
    if (!q || busy) return;

    const id = nextId.current++;
    setInput("");
    setTurns((prev) => [
      ...prev,
      { id, question: q, status: "loading", answer: null, error: null },
    ]);

    try {
      const answer = await assistantApi.query(project.id, q, getAccessToken());
      setTurns((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, status: "done", answer } : t,
        ),
      );
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "질문 처리 중 오류가 발생했습니다.";
      setTurns((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, status: "error", error: message } : t,
        ),
      );
    }
  };

  const retry = (turn: Turn) => {
    // 실패한 턴을 다시 로딩 상태로 되돌리고 재호출한다(새 턴 추가 없이 제자리 재시도).
    setTurns((prev) =>
      prev.map((t) =>
        t.id === turn.id ? { ...t, status: "loading", error: null } : t,
      ),
    );
    void (async () => {
      try {
        const answer = await assistantApi.query(
          project.id,
          turn.question,
          getAccessToken(),
        );
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turn.id ? { ...t, status: "done", answer } : t,
          ),
        );
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "질문 처리 중 오류가 발생했습니다.";
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turn.id ? { ...t, status: "error", error: message } : t,
          ),
        );
      }
    })();
  };

  const clearAll = () => {
    setTurns([]);
    setInput("");
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 py-4">
      {/* 히어로 — 대화 시작 전에만 */}
      {!started && (
        <div className="text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-accent text-primary">
            <MessagesSquare className="size-7" />
          </span>
          <h2 className="mt-4 text-foreground text-xl">통합 질의응답 AI</h2>
          <p className="mt-2 text-muted-foreground text-sm">
            요구사항·리스크·일정·문서까지, 프로젝트 전반에 대해 자연어로 질문하세요.
            <br />
            AI가 관련 자료를 찾아 근거와 함께 답합니다.
          </p>
        </div>
      )}

      {/* 예시 질문 — 대화 시작 전에만 (긴 설명형 버튼) */}
      {!started && (
        <div className="space-y-2">
          <div className="text-center text-muted-foreground text-xs">예시 질문</div>
          {AI_SEARCH_EXAMPLES.map((q) => (
            <button
              key={q}
              onClick={() => void ask(q)}
              className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50"
            >
              <ArrowRight className="size-4 shrink-0 text-primary" />
              <span className="text-foreground">{q}</span>
            </button>
          ))}
        </div>
      )}

      {/* 대화 로그 — 위(오래된 질문)에서 아래(최신)로 누적, 새 턴이 생기면 자동으로 맨 아래로 스크롤 */}
      {started && (
        <div
          ref={logContainerRef}
          className="max-h-[65vh] space-y-6 overflow-y-auto scroll-smooth pr-1 print:max-h-none print:overflow-visible"
        >
          {turns.map((turn) => (
            <TurnBlock
              key={turn.id}
              turn={turn}
              onOpenRequirements={onOpenRequirements}
              onRetry={() => retry(turn)}
            />
          ))}

          <div className="flex justify-center pt-1 print:hidden">
            <Button variant="ghost" size="sm" onClick={clearAll} disabled={busy}>
              <Trash2 className="size-4" /> 대화 지우기
            </Button>
          </div>
        </div>
      )}

      {/* 질문창 — 화면 하단에 고정, 대화가 길어져도 항상 바로 이어서 질문 가능 (인쇄 시 숨김) */}
      <div className="sticky bottom-0 space-y-2 bg-background pb-2 pt-1 print:hidden">
        {/* 빠른 질문 칩 — 대화 중에도 계속 떠있음 (예시 질문의 축약 버전) */}
        {started && (
          <div className="flex flex-wrap gap-1.5">
            {AI_SEARCH_EXAMPLES.slice(0, 4).map((q) => (
              <button
                key={q}
                onClick={() => void ask(q)}
                disabled={busy}
                className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-muted-foreground text-xs transition-colors hover:bg-muted/50 disabled:opacity-50"
              >
                <Lightbulb className="size-3" />
                {q}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
          className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-sm"
        >
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={started ? "이어서 질문하기..." : "프로젝트에 대해 무엇이든 물어보세요..."}
            className="flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button type="submit" className="rounded-full" size="sm" disabled={busy}>
            질문
          </Button>
        </form>
      </div>
    </div>
  );
}

/** 대화 한 턴(질문 + 답변)을 렌더한다. */
function TurnBlock({
  turn,
  onOpenRequirements,
  onRetry,
}: {
  turn: Turn;
  onOpenRequirements?: () => void;
  onRetry: () => void;
}) {
  const { question, status, answer, error } = turn;
  const llmNote = answer ? assistantLlmStatusLabel(answer.llmStatus) : null;
  const hasRequirementSource =
    answer?.sources.some((s) => s.requirementId != null) ?? false;

  // 로딩 중일 때만 문구를 일정 주기로 바꿔가며 보여준다 (실제 진행 단계 아님, 연출용).
  const [thinkingIndex, setThinkingIndex] = useState(0);
  useEffect(() => {
    if (status !== "loading") return;
    const timer = setInterval(() => {
      setThinkingIndex((i) => (i + 1) % THINKING_MESSAGES.length);
    }, 1400);
    return () => clearInterval(timer);
  }, [status]);

  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (!answer?.answer) return;
    void navigator.clipboard.writeText(answer.answer).then(() => {
      setCopied(true);
      toast.success("답변을 복사했어요.");
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="space-y-3">
      {/* 질문 (사용자) */}
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {question}
        </div>
      </div>

      {/* 로딩 */}
      {status === "loading" && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin text-primary" />
          {THINKING_MESSAGES[thinkingIndex]}
        </div>
      )}

      {/* 오류 */}
      {status === "error" && (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <span className="flex items-center gap-2 text-muted-foreground text-sm">
              <AlertCircle className="size-4 text-red-500" />
              {error}
            </span>
            <Button variant="outline" size="sm" onClick={onRetry} className="print:hidden">
              다시 시도
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 답변 */}
      {status === "done" && answer && (
        <>
          <Card className="border-blue-100 bg-blue-50/40">
            <CardContent className="pt-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 text-blue-700 text-xs">
                  <Sparkles className="size-3.5" /> AI 답변
                </span>
                {llmNote && (
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 font-normal text-amber-700">
                    {llmNote}
                  </Badge>
                )}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="ml-auto flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground print:hidden"
                  title="PDF로 저장 (인쇄 창에서 '대상: PDF로 저장' 선택)"
                >
                  <Printer className="size-3.5" /> PDF로 저장
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground print:hidden"
                  title="답변 복사"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5 text-emerald-600" /> 복사됨
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" /> 복사
                    </>
                  )}
                </button>
              </div>
              <p className="mt-2 whitespace-pre-line text-foreground text-sm leading-relaxed">
                {answer.answer || "답변을 생성하지 못했습니다."}
              </p>
              {hasRequirementSource && onOpenRequirements && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 bg-card print:hidden"
                  onClick={onOpenRequirements}
                >
                  요구사항에서 자세히 보기 <ArrowRight className="size-3.5" />
                </Button>
              )}
            </CardContent>
          </Card>

          {answer.sources.length > 0 && (
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-foreground text-xs">
                <FileText className="size-3.5 text-primary" />
                이 답변의 근거 {answer.sources.length}건
              </div>
              <div className="divide-y divide-border">
                {answer.sources.map((s, i) => (
                  <div
                    key={`${s.documentId ?? s.requirementId ?? s.wbsId ?? "src"}-${i}`}
                    className="flex items-start gap-2.5 py-2.5"
                  >
                    <span className="mt-0.5 shrink-0 text-muted-foreground text-xs">
                      {i + 1}.
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-foreground text-sm">{sourceTitle(s)}</span>
                        {s.page != null && (
                          <span className="shrink-0 text-muted-foreground text-xs">p.{s.page}</span>
                        )}
                        {s.reviewStatus && (
                          <Badge variant="secondary" className="shrink-0 font-normal">
                            {s.reviewStatus}
                          </Badge>
                        )}
                      </div>
                      {s.excerpt && (
                        <p className="mt-0.5 line-clamp-2 text-muted-foreground text-xs leading-relaxed">
                          {s.excerpt}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}