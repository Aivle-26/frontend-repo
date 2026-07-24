import { useState } from "react";
import {
  Search,
  ArrowRight,
  MessagesSquare,
  Sparkles,
  FileText,
  Loader2,
  RotateCcw,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { cn } from "@/app/components/ui/utils";
import {
  AI_SEARCH_EXAMPLES,
  PROJECT_DOCS,
  type DocItem,
  type ProjectSummary,
} from "@/app/data/demoData";

type QaTopic = "요구사항" | "리스크" | "일정/WBS" | "문서" | "일반";

interface QaResult {
  question: string;
  topic: QaTopic;
  answer: string;
  docs: DocItem[];
  jumpTo?: "requirements" | "risk";
}

const TOPIC_CLASS: Record<QaTopic, string> = {
  요구사항: "border-blue-200 bg-blue-50 text-blue-700",
  리스크: "border-red-200 bg-red-50 text-red-700",
  "일정/WBS": "border-purple-200 bg-purple-50 text-purple-700",
  문서: "border-emerald-200 bg-emerald-50 text-emerald-700",
  일반: "border-border bg-muted/40 text-muted-foreground",
};

/**
 * 질문 의도를 파악해 요구사항·리스크·일정·문서 전반에서 답변을 구성합니다(데모).
 * 백엔드 연동 시 이 함수를 통합 질의응답(RAG) API 호출로 교체합니다.
 */
function runQa(question: string, projectName: string): QaResult {
  const q = question.toLowerCase();
  const pick = (fn: (d: DocItem) => boolean) => PROJECT_DOCS.filter(fn);

  // 요구사항 ↔ WBS 정합성
  if (q.includes("요구사항") && (q.includes("wbs") || q.includes("일정"))) {
    return {
      question,
      topic: "일정/WBS",
      answer:
        "요구사항과 WBS를 대조한 결과, 결제 단계(2단계 vs 3단계)와 성능 테스트 기간이 WBS에 반영되지 않았습니다. 해당 항목을 WBS에 추가하거나 요구사항을 확정해 주세요.",
      docs: pick(
        (d) => d.category === "요구사항" || d.category === "일정 및 WBS" || d.title.includes("WBS"),
      ),
      jumpTo: "requirements",
    };
  }

  // 리스크 (시급/위험 포함)
  if (q.includes("리스크") || q.includes("시급") || q.includes("위험")) {
    return {
      question,
      topic: "리스크",
      answer:
        "현재 가장 시급한 리스크는 '시스템 아키텍처 보안 요구사항 미반영'입니다. 재생성이 필요하며, 결제 기능 범위 변경으로 인한 일정 지연 리스크도 검토 대기 상태입니다.",
      docs: pick((d) => d.category === "리스크" || d.status === "재생성 필요"),
      jumpTo: "risk",
    };
  }

  // 일정 / 지연
  if (q.includes("지연") || q.includes("일정") || q.includes("wbs") || q.includes("마일스톤")) {
    return {
      question,
      topic: "일정/WBS",
      answer:
        "일정상 '개발' 단계(8주)가 가장 길고, 성능 테스트 미반영으로 '시험' 단계에서 지연 위험이 있습니다. 개발 후반 일정에 버퍼를 두는 것을 권장합니다.",
      docs: pick((d) => d.category === "일정 및 WBS" || d.title.includes("WBS") || d.title.includes("간트")),
    };
  }

  // 보안 (문서 + 리스크 교차)
  if (q.includes("보안")) {
    return {
      question,
      topic: "문서",
      answer:
        "보안 관련 내용은 요구사항 문서와 리스크 분석 보고서에 있으나, 시스템 아키텍처 산출물에는 암호화 계층이 아직 반영되지 않았습니다. 아키텍처 재생성이 필요합니다.",
      docs: pick(
        (d) => d.category === "구조도" || d.category === "리스크" || d.category === "요구사항",
      ),
      jumpTo: "risk",
    };
  }

  // 요구사항 일반
  if (q.includes("요구사항") || q.includes("핵심") || q.includes("기능")) {
    return {
      question,
      topic: "요구사항",
      answer:
        "핵심 기능 요구사항은 'PM 확정 요구사항 v1.0'에 정리돼 있습니다. 전체 목록·상태는 요구사항 화면에서 확인할 수 있어요.",
      docs: pick((d) => d.category === "요구사항" || d.category === "구조도"),
      jumpTo: "requirements",
    };
  }

  // 화면/설계
  if (q.includes("화면") || q.includes("설계")) {
    return {
      question,
      topic: "문서",
      answer:
        "가장 최신 화면 설계 문서는 '사용자 흐름도 v2.0'(2025-07-12, PM 승인)입니다. 기능 구조도와 함께 보면 화면 흐름을 파악하기 좋습니다.",
      docs: pick((d) => d.category === "화면 설계" || d.category === "구조도"),
    };
  }

  // 그 외: 문서 검색 폴백
  const term = question.trim();
  let docs = PROJECT_DOCS.filter(
    (d) => d.title.includes(term) || d.category.includes(term),
  );
  if (docs.length === 0) docs = PROJECT_DOCS.slice(0, 3);
  return {
    question,
    topic: "문서",
    answer: `'${term}'와 관련해 ${projectName}의 자료 ${docs.length}건을 찾았습니다. 아래 항목을 확인해 보세요.`,
    docs,
  };
}

export function AiDocSearch({
  project,
  onOpenRequirements,
  onOpenRisk,
}: {
  project: ProjectSummary;
  onOpenRequirements?: () => void;
  onOpenRisk?: () => void;
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QaResult | null>(null);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    setInput(q);
    setLoading(true);
    setResult(null);
    setTimeout(() => {
      setResult(runQa(q, project.name));
      setLoading(false);
    }, 900);
  };

  const reset = () => {
    setResult(null);
    setInput("");
  };

  const jump =
    result?.jumpTo === "requirements"
      ? { label: "요구사항에서 자세히 보기", onClick: onOpenRequirements }
      : result?.jumpTo === "risk"
        ? { label: "리스크 관리에서 보기", onClick: onOpenRisk }
        : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-4">
      {/* 히어로 */}
      {!result && !loading && (
        <div className="text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-accent text-primary">
            <MessagesSquare className="size-7" />
          </span>
          <h2 className="mt-4 text-foreground text-xl">통합 질의응답 AI</h2>
          <p className="mt-2 text-muted-foreground text-sm">
            요구사항·리스크·일정·문서까지, 프로젝트 전반에 대해 자연어로 질문하세요.
            <br />
            AI가 관련 정보를 찾아 답하고, 해당 화면으로 바로 안내합니다.
          </p>
        </div>
      )}

      {/* 질문창 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-sm"
      >
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="프로젝트에 대해 무엇이든 물어보세요..."
          className="flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" className="rounded-full" size="sm" disabled={loading}>
          질문
        </Button>
      </form>

      {/* 예시 질문 */}
      {!result && !loading && (
        <div className="space-y-2">
          <div className="text-center text-muted-foreground text-xs">예시 질문</div>
          {AI_SEARCH_EXAMPLES.map((q) => (
            <button
              key={q}
              onClick={() => ask(q)}
              className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50"
            >
              <ArrowRight className="size-4 shrink-0 text-primary" />
              <span className="text-foreground">{q}</span>
            </button>
          ))}
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Loader2 className="size-6 animate-spin text-primary" />
            <div className="text-foreground text-sm">프로젝트 정보를 분석하고 있어요…</div>
            <div className="text-muted-foreground text-xs">{input}</div>
          </CardContent>
        </Card>
      )}

      {/* 결과 */}
      {result && !loading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-muted-foreground text-sm">
              질문 · <span className="text-foreground">{result.question}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw className="size-4" /> 새 질문
            </Button>
          </div>

          <Card className="border-blue-100 bg-blue-50/40">
            <CardContent className="pt-5">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-blue-700 text-xs">
                  <Sparkles className="size-3.5" /> AI 답변
                </span>
                <Badge variant="outline" className={cn("font-normal", TOPIC_CLASS[result.topic])}>
                  {result.topic}
                </Badge>
              </div>
              <p className="mt-2 text-foreground text-sm leading-relaxed">{result.answer}</p>
              {jump && jump.onClick && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 bg-card"
                  onClick={jump.onClick}
                >
                  {jump.label} <ArrowRight className="size-3.5" />
                </Button>
              )}
            </CardContent>
          </Card>

          {result.docs.length > 0 && (
            <div>
              <div className="mb-2 text-muted-foreground text-sm">
                관련 문서 {result.docs.length}건
              </div>
              <div className="space-y-2">
                {result.docs.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                  >
                    <span className="flex size-9 items-center justify-center rounded-md bg-muted">
                      <FileText className="size-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-foreground text-sm">{d.title}</div>
                      <div className="text-muted-foreground text-xs">
                        {d.version} · {d.updatedAt}
                      </div>
                    </div>
                    <Badge variant="secondary" className="font-normal">
                      {d.category}
                    </Badge>
                    <ChevronRight className={cn("size-4 text-muted-foreground")} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
