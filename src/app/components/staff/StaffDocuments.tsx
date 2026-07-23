import { useMemo, useState } from "react";
import {
  Layers,
  FileText,
  Search,
  LayoutGrid,
  List,
  Download,
  Bot,
  Upload,
  CheckCircle2,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import { cn } from "@/app/components/ui/utils";
import {
  DOC_CATEGORIES,
  PROJECT_DOCS,
  type DocCategory,
  type DocItem,
  type DocStatus,
  type DocTone,
} from "@/app/data/demoData";

const TONE_BG: Record<DocTone, string> = {
  green: "bg-emerald-100",
  teal: "bg-teal-100",
  purple: "bg-purple-100",
  yellow: "bg-amber-100",
  red: "bg-red-100",
  orange: "bg-orange-100",
  blue: "bg-blue-100",
};

function statusClass(s: DocStatus) {
  const map: Record<DocStatus, string> = {
    "AI 생성": "bg-purple-50 text-purple-700 border-purple-200",
    "PM 승인": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "최종 확정": "bg-teal-50 text-teal-700 border-teal-200",
    "검토 대기": "bg-amber-50 text-amber-700 border-amber-200",
    "재생성 필요": "bg-red-50 text-red-700 border-red-200",
    "PM 수정": "bg-blue-50 text-blue-700 border-blue-200",
  };
  return map[s];
}

function ribbon(s: DocStatus) {
  if (s === "최종 확정")
    return { label: "확정", cls: "bg-emerald-600 text-white", icon: CheckCircle2 };
  if (s === "AI 생성")
    return { label: "AI 생성", cls: "bg-purple-600 text-white", icon: Sparkles };
  if (s === "재생성 필요")
    return { label: "재생성 필요", cls: "bg-red-600 text-white", icon: RefreshCw };
  return null;
}

function downloadDocument(doc: DocItem) {
  const fileName = `${doc.title.replace(/[\\/:*?"<>|]/g, "_").trim()}_${doc.version}.txt`;
  const content = [
    `문서명: ${doc.title}`,
    `분류: ${doc.category}`,
    `상태: ${doc.status}`,
    `버전: ${doc.version}`,
    `최종 수정일: ${doc.updatedAt}`,
    "",
    "현재 문서함은 데모 데이터로 구성되어 문서 메타데이터를 내려받습니다.",
  ].join("\n");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  toast.success(`“${doc.title}” 다운로드를 시작했습니다.`);
}

export function StaffDocuments() {
  const [category, setCategory] = useState<"전체" | DocCategory>("전체");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  const docs = PROJECT_DOCS;

  const counts = useMemo(() => {
    const c = new Map<DocCategory, number>();
    DOC_CATEGORIES.forEach((k) => c.set(k, 0));
    docs.forEach((d) => c.set(d.category, (c.get(d.category) ?? 0) + 1));
    return c;
  }, [docs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter((d) => {
      const byCat = category === "전체" || d.category === category;
      const byQ = !q || d.title.toLowerCase().includes(q);
      return byCat && byQ;
    });
  }, [docs, category, query]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-4">
      {/* 문서 분류 */}
      <Card className="h-fit">
        <CardContent className="pt-5">
          <div className="mb-3 text-foreground text-sm">문서 분류</div>
          <div className="space-y-0.5">
            <CategoryRow
              icon={<Layers className="size-4" />}
              label="전체 문서"
              count={docs.length}
              active={category === "전체"}
              onClick={() => setCategory("전체")}
            />
            {DOC_CATEGORIES.map((c) => (
              <CategoryRow
                key={c}
                icon={<FileText className="size-4" />}
                label={c}
                count={counts.get(c) ?? 0}
                active={category === c}
                onClick={() => setCategory(c)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 문서 목록 */}
      <div className="space-y-4">
        {/* 직원 액션 바 */}
        <Card>
          <CardContent className="flex flex-col gap-4 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText className="size-5" />
              </span>
              <div>
                <div className="text-sm font-medium text-foreground">내가 접근 가능한 프로젝트 문서</div>
                <div className="text-xs text-muted-foreground">
                  산출물을 열람·다운로드하고, 문서 기반 챗봇으로 질문하세요.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <Button variant="outline" onClick={() => toast("산출물 제출 화면으로 이동합니다.")}>
                <Upload className="size-4" /> 내 산출물 제출
              </Button>
              <Button onClick={() => toast.success("문서 챗봇으로 가져왔습니다.")}>
                <Bot className="size-4" /> 챗봇으로 가져오기
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="leading-tight">
            <h2 className="text-foreground">문서함</h2>
            <p className="text-muted-foreground text-sm">
              {category === "전체" ? "전체 산출물" : category} {filtered.length}건
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="문서 검색"
                className="h-9 w-56 pl-8"
              />
            </div>
            <div className="flex rounded-lg border border-border p-0.5">
              <button
                onClick={() => setView("grid")}
                aria-label="그리드 보기"
                className={cn(
                  "rounded-md p-1.5",
                  view === "grid" ? "bg-muted text-foreground" : "text-muted-foreground",
                )}
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                onClick={() => setView("list")}
                aria-label="리스트 보기"
                className={cn(
                  "rounded-md p-1.5",
                  view === "list" ? "bg-muted text-foreground" : "text-muted-foreground",
                )}
              >
                <List className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {filtered.length === 0 && (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground text-sm">
              조건에 맞는 문서가 없습니다.
            </CardContent>
          </Card>
        )}

        {view === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((d) => (
              <DocCard key={d.id} doc={d} onDownload={() => downloadDocument(d)} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="divide-y divide-border pt-2">
              {filtered.map((d) => (
                <div key={d.id} className="flex items-center gap-3 py-3">
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-md",
                      TONE_BG[d.tone],
                    )}
                  >
                    <FileText className="size-4 text-foreground/60" />
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
                  <Badge variant="outline" className={cn("font-normal", statusClass(d.status))}>
                    {d.status}
                  </Badge>
                  <Button size="sm" onClick={() => downloadDocument(d)}>
                    <Download className="size-4" /> 다운로드
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function CategoryRow({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <span className={active ? "text-primary" : ""}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      <span className="text-muted-foreground text-xs">{count}</span>
    </button>
  );
}

function DocCard({ doc: d, onDownload }: { doc: DocItem; onDownload: () => void }) {
  const rb = ribbon(d.status);
  const RibbonIcon = rb?.icon;
  return (
    <article className="group overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-md">
      <button
        type="button"
        onClick={() => toast(`“${d.title}” 열기`)}
        className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <div className={cn("relative flex h-32 items-center justify-center", TONE_BG[d.tone])}>
          <FileText className="size-9 text-foreground/25" />
          {rb && RibbonIcon && (
            <span
              className={cn(
                "absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                rb.cls,
              )}
            >
              <RibbonIcon className="size-3" /> {rb.label}
            </span>
          )}
        </div>
        <div className="p-3.5">
          <div className="truncate text-foreground text-sm">{d.title}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="font-normal">
              {d.category}
            </Badge>
            <Badge variant="outline" className={cn("font-normal", statusClass(d.status))}>
              {d.status}
            </Badge>
          </div>
          <div className="mt-2 flex items-center justify-between text-muted-foreground text-xs">
            <span>{d.version}</span>
            <span>{d.updatedAt}</span>
          </div>
        </div>
      </button>
      <div className="border-t border-border p-3">
        <Button size="sm" className="w-full" onClick={onDownload}>
          <Download className="size-4" /> 다운로드
        </Button>
      </div>
    </article>
  );
}
