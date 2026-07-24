import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  FileText,
  Globe2,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
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
import { Checkbox } from "@/app/components/ui/checkbox";
import { Input } from "@/app/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { projectRepository } from "@/app/api/projectRepository";
import {
  projectRequirements,
  type ProjectSummary,
} from "@/app/data/demoData";

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

function priorityVariant(priority: string) {
  if (priority === "높음") return "destructive" as const;
  if (priority === "중간") return "secondary" as const;
  return "outline" as const;
}

function similarityBadgeVariant(similarity: number) {
  if (similarity >= 90) return "default" as const;
  if (similarity >= 80) return "secondary" as const;
  return "outline" as const;
}

const SNAPSHOT_LIMIT = 6;

export function PmAnalysis({
  project,
  onOpenRequirements,
}: {
  project: ProjectSummary;
  onOpenRequirements?: () => void;
}) {
  const { risks } = projectRepository.getPmAnalysis();
  const requirements = projectRequirements(project);
  const snapshot = requirements.slice(0, SNAPSHOT_LIMIT);
  const remaining = requirements.length - snapshot.length;

  const [selectedId, setSelectedId] = useState<number | null>(
    requirements[0]?.id ?? null,
  );
  const [query, setQuery] = useState(project.name);
  const [isCrawling, setIsCrawling] = useState(false);
  const [lastCrawledAt, setLastCrawledAt] = useState("방금 전");
  const [similarProjects, setSimilarProjects] = useState<SimilarProject[]>(
    INITIAL_SIMILAR_PROJECTS,
  );

  const selectedRequirement = useMemo(
    () => requirements.find((requirement) => requirement.id === selectedId),
    [requirements, selectedId],
  );

  const handleCrawl = async () => {
    if (!query.trim()) {
      toast.error("검색어를 입력하세요.");
      return;
    }

    setIsCrawling(true);

    // UI 확인용 임시 동작입니다.
    // 실제 크롤링 연결 시 이 부분을 백엔드 API 호출로 교체합니다.
    await new Promise((resolve) => window.setTimeout(resolve, 900));

    const keyword = selectedRequirement?.text ?? query;
    setSimilarProjects(
      INITIAL_SIMILAR_PROJECTS.map((item, index) => ({
        ...item,
        similarity: Math.max(72, item.similarity - index),
        summary:
          index === 0
            ? `선택 요구사항 “${keyword.slice(0, 24)}${keyword.length > 24 ? "…" : ""}”과 가장 유사한 참고 사례입니다.`
            : item.summary,
      })),
    );
    setLastCrawledAt("방금 전");
    setIsCrawling(false);
    toast.success("유사 프로젝트 검색을 완료했습니다.");
  };

  return (
    <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
      {/* 기존 AI 분석 영역: 우측 패널 공간 확보를 위해 폭과 여백을 축소 */}
      <div className="min-w-0 space-y-5">
        {/* 공고문 정보 */}
        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <FileText className="size-5 text-muted-foreground" />
              </div>

              <div className="min-w-0 leading-tight">
                <div className="truncate font-medium text-foreground">
                  사내-협업툴-개발-rfp-2026.pdf
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  4.2MB · 24개 요구사항 추출 완료
                </div>
              </div>
            </div>

            <div className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await projectRepository.uploadRfp();
                  toast("공고문 업로드 흐름을 다시 시작했습니다.");
                }}
              >
                다시 업로드
              </Button>

              <Button
                size="sm"
                onClick={async () => {
                  await projectRepository.reanalyzeRfp();
                  toast.success("AI 재분석을 시작했습니다.");
                }}
              >
                <RefreshCw className="size-4" />
                다시 분석
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* AI 추출 요구사항 (스냅샷) */}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
            <div>
              <CardTitle>AI 추출 요구사항</CardTitle>
              <CardDescription>
                AI가 방금 추출한 결과 스냅샷입니다. 항목을 선택하면 우측 추천 검색에 반영돼요. 필터·상태 관리는 요구사항 화면에서.
              </CardDescription>
            </div>
            {onOpenRequirements && (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={onOpenRequirements}
              >
                요구사항 전체 보기
                <ArrowRight className="size-4" />
              </Button>
            )}
          </CardHeader>

          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>요구사항</TableHead>
                    <TableHead className="w-20">분류</TableHead>
                    <TableHead className="w-20">우선순위</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {snapshot.map((requirement) => (
                    <TableRow
                      key={requirement.id}
                      data-state={
                        selectedId === requirement.id ? "selected" : undefined
                      }
                      className="cursor-pointer"
                      onClick={() => setSelectedId(requirement.id)}
                    >
                      <TableCell className="py-2.5">
                        <Checkbox
                          checked={selectedId === requirement.id}
                          onCheckedChange={() => setSelectedId(requirement.id)}
                        />
                      </TableCell>
                      <TableCell className="py-2.5 text-muted-foreground">
                        {requirement.id}
                      </TableCell>
                      <TableCell className="py-2.5 text-sm">
                        {requirement.text}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Badge variant="outline">{requirement.category}</Badge>
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Badge variant={priorityVariant(requirement.priority)}>
                          {requirement.priority}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {remaining > 0 && (
              <button
                type="button"
                onClick={onOpenRequirements}
                className="mt-3 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/40"
              >
                외 {remaining}건 · 요구사항 전체 보기
                <ArrowRight className="size-3.5" />
              </button>
            )}
          </CardContent>
        </Card>

        {/* AI 리스크 분석 */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            <h2 className="font-medium text-foreground">AI 리스크 분석</h2>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {risks.map((risk) => (
              <Card key={risk.id}>
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base">{risk.title}</CardTitle>
                    <Badge
                      variant={
                        risk.level === "높음" ? "destructive" : "secondary"
                      }
                    >
                      {risk.level}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <p className="text-sm leading-6 text-muted-foreground">
                    {risk.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>

      {/* 우측: 유사 프로젝트 참고 추천 */}
      <aside className="min-w-0">
        <Card className="2xl:sticky 2xl:top-6">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                <Globe2 className="size-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">
                  유사 프로젝트 참고 추천
                </CardTitle>
                <CardDescription className="mt-1">
                  공개 발주·사업 데이터를 검색합니다.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleCrawl();
                  }}
                  placeholder="프로젝트명 또는 핵심 요구사항"
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={handleCrawl}
                  disabled={isCrawling}
                  aria-label="유사 프로젝트 검색"
                >
                  {isCrawling ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Search className="size-4" />
                  )}
                </Button>
              </div>

              <div className="rounded-md border border-border bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground">
                  선택 요구사항
                </div>
                <div className="mt-1 line-clamp-2 text-sm text-foreground">
                  {selectedRequirement?.text ?? "요구사항을 선택하세요."}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-border pb-3 text-xs text-muted-foreground">
              <span>추천 {similarProjects.length}건</span>
              <span>최근 검색 {lastCrawledAt}</span>
            </div>

            <div className="space-y-3">
              {similarProjects.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-border p-3 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="line-clamp-2 text-sm font-medium leading-5 text-foreground">
                        {item.title}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {item.organization} · {item.year}
                      </div>
                    </div>
                    <Badge
                      className="shrink-0"
                      variant={similarityBadgeVariant(item.similarity)}
                    >
                      {item.similarity}%
                    </Badge>
                  </div>

                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    {item.summary}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[11px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      출처: {item.source}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() =>
                        toast("백엔드 크롤링 API 연결 후 원문을 엽니다.")
                      }
                    >
                      원문 보기
                      <ExternalLink className="size-3" />
                    </Button>
                  </div>
                </article>
              ))}
            </div>

            <div className="rounded-lg bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
              현재 코드는 UI 확인용입니다. 실제 크롤링은 브라우저에서 직접 실행하지 않고,
              Spring Boot 백엔드가 수집한 결과를 API로 받아 표시해야 합니다.
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}