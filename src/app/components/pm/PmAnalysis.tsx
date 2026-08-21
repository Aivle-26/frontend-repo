import { useState } from "react";
import { ExternalLink, Globe2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import type { ProjectSummary } from "@/app/data/demoData";

type SimilarProject = {
  id: number;
  title: string;
  organization: string;
  year: string;
  similarity: number;
  summary: string;
  tags: string[];
  source: string;
};

const INITIAL_SIMILAR_PROJECTS: SimilarProject[] = [
  {
    id: 1,
    title: "공공 클라우드 이중화 및 재해복구 체계 구축",
    organization: "한국지역정보개발원",
    year: "2025",
    similarity: 94,
    summary:
      "30분 이내 복구, 이중화 구성, 운영 로그 보관 요구사항이 현재 공고와 유사합니다.",
    tags: ["이중화", "재해복구", "로그관리"],
    source: "나라장터",
  },
  {
    id: 2,
    title: "통합 업무시스템 고도화 및 접근성 개선",
    organization: "공공기관 정보화사업",
    year: "2024",
    similarity: 88,
    summary:
      "WCAG 2.1 AA 준수, 다국어 지원, 감사 로그 요구사항을 참고할 수 있습니다.",
    tags: ["WCAG", "다국어", "감사로그"],
    source: "공공데이터포털",
  },
  {
    id: 3,
    title: "협업 플랫폼 연동 및 운영 자동화 구축",
    organization: "디지털서비스 발주기관",
    year: "2025",
    similarity: 81,
    summary:
      "Slack·Jira 연동과 알림 자동화 범위가 현재 프로젝트의 외부 협업 요구와 유사합니다.",
    tags: ["Slack", "Jira", "알림자동화"],
    source: "나라장터",
  },
];

function similarityBadgeVariant(similarity: number) {
  if (similarity >= 90) return "default" as const;
  if (similarity >= 80) return "secondary" as const;
  return "outline" as const;
}

export function PmAnalysis({
  project,
  variant = "full",
}: {
  project: ProjectSummary;
  /** "full": 독립 화면(3열 그리드) · "panel": 요구사항 화면 우측 사이드 패널(단일 열) */
  variant?: "full" | "panel";
}) {
  const isPanel = variant === "panel";
  const [query, setQuery] = useState(project.name);
  const [isCrawling, setIsCrawling] = useState(false);
  const [lastCrawledAt, setLastCrawledAt] = useState("방금 전");
  const [similarProjects, setSimilarProjects] = useState<SimilarProject[]>(
    INITIAL_SIMILAR_PROJECTS,
  );

  const handleCrawl = async () => {
    const keyword = query.trim();
    if (!keyword) {
      toast.error("검색어를 입력하세요.");
      return;
    }

    setIsCrawling(true);

    try {
      // 현재는 UI 확인용 동작입니다. 실제 검색 결과는 백엔드 API 응답으로 교체합니다.
      await new Promise((resolve) => window.setTimeout(resolve, 900));

      setSimilarProjects(
        INITIAL_SIMILAR_PROJECTS.map((item, index) => ({
          ...item,
          similarity: Math.max(72, item.similarity - index),
          summary:
            index === 0
              ? `“${keyword.slice(0, 28)}${keyword.length > 28 ? "…" : ""}”와 가장 유사한 참고 사례입니다.`
              : item.summary,
        })),
      );
      setLastCrawledAt("방금 전");
      toast.success("유사 프로젝트 검색을 완료했습니다.");
    } finally {
      setIsCrawling(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
              <Globe2 className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle>유사 프로젝트 참고 추천</CardTitle>
              <CardDescription className="mt-1">
                공개 발주·사업 데이터에서 현재 프로젝트와 유사한 참고 사례를 찾습니다.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleCrawl();
              }}
              placeholder="프로젝트명 또는 핵심 키워드"
            />
            <Button
              type="button"
              onClick={() => void handleCrawl()}
              disabled={isCrawling}
              className="shrink-0"
            >
              {isCrawling ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              {isCrawling ? "검색 중" : "유사 프로젝트 검색"}
            </Button>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
            <span>추천 {similarProjects.length}건</span>
            <span>최근 검색 {lastCrawledAt}</span>
          </div>
        </CardContent>
      </Card>

      <div
        className={
          isPanel
            ? "grid grid-cols-1 gap-3"
            : "grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3"
        }
      >
        {similarProjects.map((item) => (
          <Card key={item.id} className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base leading-6">
                    {item.title}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {item.organization} · {item.year}
                  </CardDescription>
                </div>
                <Badge
                  className="shrink-0"
                  variant={similarityBadgeVariant(item.similarity)}
                >
                  {item.similarity}%
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="flex h-full flex-col pt-0">
              <p className="text-sm leading-6 text-muted-foreground">
                {item.summary}
              </p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {item.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[11px]">
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
                <span className="text-xs text-muted-foreground">
                  출처: {item.source}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() =>
                    toast("백엔드 검색 API 연결 후 원문을 엽니다.")
                  }
                >
                  원문 보기
                  <ExternalLink className="size-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}