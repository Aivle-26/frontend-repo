import { useState } from "react";
import {
  Search,
  ArrowRight,
  Cpu,
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

interface SearchResult {
  question: string;
  answer: string;
  docs: DocItem[];
}

/** 질문에서 키워드를 뽑아 관련 문서를 고르고 요약 답변을 만든다(데모). */
function runSearch(question: string, projectName: string): SearchResult {
  const q = question.toLowerCase();
  const pick = (fn: (d: DocItem) => boolean) => PROJECT_DOCS.filter(fn);

  let docs: DocItem[];
  let answer: string;

  if (q.includes("요구사항") && q.includes("wbs")) {
    docs = pick((d) => d.category === "요구사항" || d.category === "일정 및 WBS" || d.title.includes("WBS"));
    answer =
      "요구사항 문서와 WBS를 대조한 결과, 결제 단계(2단계 vs 3단계)와 성능 테스트 기간이 WBS에 반영되지 않은 것으로 보입니다. 해당 항목을 WBS에 추가하거나 요구사항을 확정해 주세요.";
  } else if (q.includes("보안")) {
    docs = pick((d) => d.category === "구조도" || d.category === "리스크" || d.category === "요구사항");
    answer =
      "보안 관련 내용은 요구사항 문서와 리스크 분석 보고서에 존재하지만, 시스템 아키텍처 산출물에는 암호화 계층이 아직 반영되지 않았습니다. 아키텍처 재생성이 필요합니다.";
  } else if (q.includes("화면") || q.includes("설계")) {
    docs = pick((d) => d.category === "화면 설계" || d.category === "구조도");
    answer =
      "가장 최신 화면 설계 문서는 '사용자 흐름도 v2.0'(2025-07-12, PM 승인)입니다. 기능 구조도와 함께 보면 화면 흐름을 파악하기 좋습니다.";
  } else if (q.includes("리스크")) {
    docs = pick((d) => d.category === "리스크" || d.status === "재생성 필요");
    answer =
      "리스크가 가장 높은 산출물은 '시스템 아키텍처'입니다. 보안 요구사항 미반영으로 재생성이 필요하며, 리스크 분석 보고서도 검토 대기 상태입니다.";
  } else if (q.includes("핵심") || q.includes("기능")) {
    docs = pick((d) => d.category === "요구사항" || d.category === "구조도");
    answer =
      "핵심 기능 요구사항은 'PM 확정 요구사항 v1.0'에 정리되어 있습니다. 기능 구조도와 함께 확인하면 범위를 빠르게 파악할 수 있습니다.";
  } else {
    const term = question.trim();
    docs = PROJECT_DOCS.filter(
      (d) => d.title.includes(term) || d.category.includes(term),
    );
    if (docs.length === 0) docs = PROJECT_DOCS.slice(0, 3);
    answer = `'${term}'와 관련해 ${projectName}의 산출물 ${docs.length}건을 찾았습니다. 아래 문서를 확인해 보세요.`;
  }

  return { question, answer, docs };
}

export function AiDocSearch({ project }: { project: ProjectSummary }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);

  const search = (question: string) => {
    const q = question.trim();
    if (!q) return;
    setInput(q);
    setLoading(true);
    setResult(null);
    setTimeout(() => {
      setResult(runSearch(q, project.name));
      setLoading(false);
    }, 900);
  };

  const reset = () => {
    setResult(null);
    setInput("");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-4">
      {/* 히어로 */}
      {!result && !loading && (
        <div className="text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-accent text-primary">
            <Cpu className="size-7" />
          </span>
          <h2 className="mt-4 text-foreground text-xl">문서관리 AI</h2>
          <p className="mt-2 text-muted-foreground text-sm">
            프로젝트 문서에 대해 자연어로 질문하세요.
            <br />
            AI가 관련 문서를 찾고 분석 결과를 제공합니다.
          </p>
        </div>
      )}

      {/* 검색창 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search(input);
        }}
        className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-sm"
      >
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="문서에 대해 질문하세요..."
          className="flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" className="rounded-full" size="sm" disabled={loading}>
          검색
        </Button>
      </form>

      {/* 예시 질문 */}
      {!result && !loading && (
        <div className="space-y-2">
          <div className="text-center text-muted-foreground text-xs">예시 질문</div>
          {AI_SEARCH_EXAMPLES.map((q) => (
            <button
              key={q}
              onClick={() => search(q)}
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
            <div className="text-foreground text-sm">문서를 분석하고 있어요…</div>
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
              <RotateCcw className="size-4" /> 새 검색
            </Button>
          </div>

          <Card className="border-blue-100 bg-blue-50/40">
            <CardContent className="pt-5">
              <div className="flex items-center gap-1.5 text-blue-700 text-xs">
                <Sparkles className="size-3.5" /> AI 분석 결과
              </div>
              <p className="mt-2 text-foreground text-sm leading-relaxed">{result.answer}</p>
            </CardContent>
          </Card>

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
        </div>
      )}
    </div>
  );
}
