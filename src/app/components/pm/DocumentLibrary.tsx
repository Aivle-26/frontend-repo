import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  Layers,
  LayoutGrid,
  List,
  Search,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { Checkbox } from "@/app/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { cn } from "@/app/components/ui/utils";
import {
  DOC_CATEGORIES,
  PROJECT_DOCS,
  projectMembers,
  type DocCategory,
  type DocItem,
  type DocStatus,
  type DocTone,
  type ProjectSummary,
  type TeamMember,
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

/** 썸네일 위 리본으로 강조할 상태 */
function ribbon(s: DocStatus) {
  if (s === "최종 확정")
    return { label: "확정", cls: "bg-emerald-600 text-white", icon: CheckCircle2 };
  if (s === "AI 생성")
    return { label: "AI 생성", cls: "bg-purple-600 text-white", icon: Sparkles };
  if (s === "재생성 필요")
    return { label: "재생성 필요", cls: "bg-red-600 text-white", icon: RefreshCw };
  return null;
}

interface DocumentLibraryProps {
  project: ProjectSummary;
  onOpenAiGeneration: () => void;
}

export function DocumentLibrary({
  project,
  onOpenAiGeneration,
}: DocumentLibraryProps) {
  const [category, setCategory] = useState<"전체" | DocCategory>("전체");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  const docs = PROJECT_DOCS;
  const members = useMemo(() => projectMembers(project.id), [project.id]);

  const [reportAssigneeId, setReportAssigneeId] = useState(
    () => projectMembers(project.id)[0]?.id ?? "",
  );
  const [accessByDocument, setAccessByDocument] = useState<Record<string, string[]>>(
    () => createInitialAccess(PROJECT_DOCS, projectMembers(project.id)),
  );
  const [permissionDocument, setPermissionDocument] = useState<DocItem | null>(null);
  const [permissionDraft, setPermissionDraft] = useState<string[]>([]);

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

  const openPermissionDialog = (doc: DocItem) => {
    setPermissionDocument(doc);
    setPermissionDraft(accessByDocument[doc.id] ?? []);
  };

  const togglePermission = (memberId: string, checked: boolean) => {
    setPermissionDraft((current) =>
      checked
        ? Array.from(new Set([...current, memberId]))
        : current.filter((id) => id !== memberId),
    );
  };

  const savePermissions = () => {
    if (!permissionDocument) return;
    setAccessByDocument((current) => ({
      ...current,
      [permissionDocument.id]: permissionDraft,
    }));
    toast.success(
      `“${permissionDocument.title}” 열람 권한을 ${permissionDraft.length}명에게 부여했습니다.`,
    );
    setPermissionDocument(null);
  };

  const requestReport = () => {
    const assignee = members.find((member) => member.id === reportAssigneeId);
    if (!assignee) {
      toast.error("보고서 생성을 요청할 직원을 선택해 주세요.");
      return;
    }
    toast.success(`${assignee.name}님에게 보고서 생성을 요청했습니다.`);
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* 문서 분류 */}
        <Card className="h-fit">
          <CardContent className="pt-5">
            <div className="mb-3 text-sm text-foreground">문서 분류</div>
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

        {/* 보고서 생성 요청 + 문서 목록 */}
        <div className="space-y-4">
          <ReportRequestPanel
            members={members}
            assigneeId={reportAssigneeId}
            onAssigneeChange={setReportAssigneeId}
            onRequest={requestReport}
            onOpenAiGeneration={onOpenAiGeneration}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="leading-tight">
              <h2 className="text-foreground">문서함</h2>
              <p className="text-sm text-muted-foreground">
                {project.name} · {category === "전체" ? "전체 산출물" : category}{" "}
                {filtered.length}건
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
                  type="button"
                  onClick={() => setView("grid")}
                  aria-label="그리드 보기"
                  className={cn(
                    "rounded-md p-1.5 transition-colors hover:bg-muted/70 hover:text-foreground",
                    view === "grid"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  <LayoutGrid className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  aria-label="리스트 보기"
                  className={cn(
                    "rounded-md p-1.5 transition-colors hover:bg-muted/70 hover:text-foreground",
                    view === "list"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  <List className="size-4" />
                </button>
              </div>
            </div>
          </div>

          {filtered.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                조건에 맞는 문서가 없습니다.
              </CardContent>
            </Card>
          )}

          {view === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((d) => (
                <DocCard
                  key={d.id}
                  doc={d}
                  accessCount={(accessByDocument[d.id] ?? []).length}
                  onDownload={() => downloadDocument(d, project)}
                  onManageAccess={() => openPermissionDialog(d)}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="divide-y divide-border pt-2">
                {filtered.map((d) => (
                  <div key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                    <button
                      type="button"
                      onClick={() => toast(`“${d.title}” 열기`)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-md",
                          TONE_BG[d.tone],
                        )}
                      >
                        <FileText className="size-4 text-foreground/60" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-foreground">
                          {d.title}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {d.version} · {d.updatedAt}
                        </span>
                      </span>
                    </button>
                    <Badge
                      variant="outline"
                      className="min-w-14 justify-center font-mono text-[11px] font-semibold"
                    >
                      {d.fileType}
                    </Badge>
                    <Badge variant="secondary" className="font-normal">
                      {d.category}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn("font-normal", statusClass(d.status))}
                    >
                      {d.status}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPermissionDialog(d)}
                    >
                      <ShieldCheck className="size-4" />
                      열람 권한 {(accessByDocument[d.id] ?? []).length}명
                    </Button>
                    <Button size="sm" onClick={() => downloadDocument(d, project)}>
                      <Download className="size-4" />
                      다운로드
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog
        open={Boolean(permissionDocument)}
        onOpenChange={(open) => {
          if (!open) setPermissionDocument(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>문서 열람 권한</DialogTitle>
            <DialogDescription>
              “{permissionDocument?.title}”을 열람할 수 있는 {project.name} 참여 직원을
              선택하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
            <span className="text-sm text-muted-foreground">
              선택된 직원 {permissionDraft.length}명
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPermissionDraft(members.map((member) => member.id))}
              >
                전체 선택
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPermissionDraft([])}
              >
                전체 해제
              </Button>
            </div>
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {members.map((member) => {
              const checked = permissionDraft.includes(member.id);
              return (
                <label
                  key={member.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-muted/60"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) =>
                      togglePermission(member.id, value === true)
                    }
                    aria-label={`${member.name} 열람 권한`}
                  />
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">
                      {member.name.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-foreground">{member.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {member.role}
                    </span>
                  </span>
                  <Badge variant={checked ? "secondary" : "outline"} className="font-normal">
                    {checked ? "열람 가능" : "권한 없음"}
                  </Badge>
                </label>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionDocument(null)}>
              취소
            </Button>
            <Button onClick={savePermissions}>권한 저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReportRequestPanel({
  members,
  assigneeId,
  onAssigneeChange,
  onRequest,
  onOpenAiGeneration,
}: {
  members: TeamMember[];
  assigneeId: string;
  onAssigneeChange: (value: string) => void;
  onRequest: () => void;
  onOpenAiGeneration: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText className="size-5" />
          </span>
          <div>
            <div className="text-sm font-medium text-foreground">보고서 생성 요청</div>
            <div className="text-xs text-muted-foreground">
              프로젝트 담당 직원에게 보고서 작성을 요청합니다.
            </div>
          </div>
          <Button onClick={onRequest} disabled={members.length === 0}>
            보고서 생성 요청
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" />
            <Select
              value={assigneeId}
              onValueChange={onAssigneeChange}
              disabled={members.length === 0}
            >
              <SelectTrigger className="h-9 w-44">
                <SelectValue placeholder="직원 선택" />
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name} · {member.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={onOpenAiGeneration}>
            <Sparkles className="size-4" />
            AI 생성 바로가기
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
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
      type="button"
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
      <span className="text-xs text-muted-foreground">{count}</span>
    </button>
  );
}

function DocCard({
  doc: d,
  accessCount,
  onDownload,
  onManageAccess,
}: {
  doc: DocItem;
  accessCount: number;
  onDownload: () => void;
  onManageAccess: () => void;
}) {
  const rb = ribbon(d.status);
  const RibbonIcon = rb?.icon;

  return (
    <article className="group overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-md">
      <button
        type="button"
        onClick={() => toast(`“${d.title}” 열기`)}
        className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        {/* 썸네일 */}
        <div
          className={cn(
            "relative flex h-32 items-center justify-center transition-transform group-hover:scale-[1.01]",
            TONE_BG[d.tone],
          )}
        >
          <FileText className="size-9 text-foreground/25" />
          <span className="absolute bottom-2 left-2 rounded-md border border-border/70 bg-background/90 px-2 py-1 font-mono text-[11px] font-bold text-foreground shadow-sm">
            {d.fileType}
          </span>
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
          <div className="truncate text-sm text-foreground">{d.title}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="font-normal">
              {d.category}
            </Badge>
            <Badge variant="outline" className={cn("font-normal", statusClass(d.status))}>
              {d.status}
            </Badge>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{d.version}</span>
            <span>{d.updatedAt}</span>
          </div>
        </div>
      </button>

      <div className="grid grid-cols-2 gap-2 border-t border-border p-3">
        <Button variant="outline" size="sm" onClick={onManageAccess}>
          <ShieldCheck className="size-4" />
          열람 권한 {accessCount}명
        </Button>
        <Button size="sm" onClick={onDownload}>
          <Download className="size-4" />
          다운로드
        </Button>
      </div>
    </article>
  );
}

function createInitialAccess(docs: DocItem[], members: TeamMember[]) {
  return docs.reduce<Record<string, string[]>>((result, doc) => {
    result[doc.id] = members.map((member) => member.id);
    return result;
  }, {});
}

function downloadDocument(doc: DocItem, project: ProjectSummary) {
  const fileName = `${sanitizeFileName(doc.title)}_${doc.version}.txt`;
  const content = [
    `프로젝트: ${project.name}`,
    `문서명: ${doc.title}`,
    `분류: ${doc.category}`,
    `상태: ${doc.status}`,
    `파일 형식: ${doc.fileType}`,
    `버전: ${doc.version}`,
    `최종 수정일: ${doc.updatedAt}`,
    "",
    "현재 문서함은 데모 데이터로 구성되어 있어 문서 메타데이터를 내려받습니다.",
    "백엔드 문서 API가 연결되면 실제 파일 URL로 교체할 수 있습니다.",
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

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_").trim();
}