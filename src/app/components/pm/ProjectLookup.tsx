import { useEffect, useState } from "react";
import {
  FileSearch,
  FileText,
  Network,
  Users,
  Calendar,
  FolderOpen,
  ChevronDown,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/app/components/ui/card";
import { Popover, PopoverTrigger, PopoverContent } from "@/app/components/ui/popover";
import { Badge } from "@/app/components/ui/badge";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/app/components/ui/utils";
import { type ProjectSummary, type TeamMember, projectMembers } from "@/app/data/demoData";
import {
  projectRepository,
  ApiError,
  type WbsTask,
  type ProjectDocumentUploadItem,
} from "@/app/api/projectRepository";
import { PmRequirements } from "@/app/components/pm/PmRequirements";

/**
 * [프로젝트 조회] 페이지.
 * 프로젝트를 하나 골라 요구사항 / WBS / 담당자 / 일정 / 문서함을 한 화면에서 훑어볼 수 있다.
 * 요구사항 탭은 실제 편집 기능이 있는 기존 PmRequirements를 그대로 재사용한다.
 */

const TABS = [
  { key: "requirements", label: "요구사항", icon: FileText },
  { key: "wbs", label: "WBS", icon: Network },
  { key: "assignee", label: "담당자", icon: Users },
  { key: "schedule", label: "일정", icon: Calendar },
  { key: "documents", label: "문서함", icon: FolderOpen },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const EMPTY_HINT: Record<TabKey, string> = {
  requirements: "요구사항을",
  wbs: "WBS를",
  assignee: "담당자를",
  schedule: "일정을",
  documents: "문서함을",
};

function projectListErrorMessage(caught: unknown) {
  if (caught instanceof ApiError) {
    if (caught.status === 401) return "로그인이 만료되었습니다. 다시 로그인해주세요.";
    if (caught.status === 403) return "프로젝트 목록을 조회할 권한이 없습니다.";
    return caught.message || "프로젝트 목록을 불러오지 못했습니다.";
  }
  return "프로젝트 목록을 불러오지 못했습니다.";
}

export function ProjectLookup() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectStatus, setProjectStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [projectError, setProjectError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("requirements");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    let ignore = false;
    setProjectStatus("loading");
    setProjectError("");
    projectRepository
      .listProjects()
      .then((items) => {
        if (ignore) return;
        setProjects(items);
        setProjectStatus("ready");
      })
      .catch((caught) => {
        if (ignore) return;
        setProjectError(projectListErrorMessage(caught));
        setProjectStatus("error");
      });
    return () => {
      ignore = true;
    };
  }, []);

  const selected = projects.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      {/* 프로젝트 선택 */}
      <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex min-w-56 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          >
            <FolderOpen className="size-4 text-muted-foreground" />
            <span className="flex-1 text-left">{selected ? selected.name : "프로젝트 선택"}</span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 max-h-72 overflow-y-auto p-1">
          {projectStatus === "loading" && (
            <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" /> 불러오는 중…
            </div>
          )}
          {projectStatus === "error" && (
            <div className="px-3 py-2 text-red-600 text-sm">{projectError}</div>
          )}
          {projectStatus === "ready" && projects.length === 0 && (
            <div className="px-3 py-2 text-muted-foreground text-sm">프로젝트가 없습니다.</div>
          )}
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setSelectedId(p.id);
                setDropdownOpen(false);
              }}
              className={cn(
                "block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted/60",
                p.id === selectedId && "bg-muted",
              )}
            >
              {p.name}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <Card>
        <CardContent className="p-0">
          {/* 탭바 */}
          <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-3">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = t.key === tab;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-sm transition-colors",
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" /> {t.label}
                </button>
              );
            })}
          </div>

          <div className={tab === "requirements" && selected ? "" : "p-6"}>
            {!selected ? (
              <EmptyState tab={tab} />
            ) : tab === "requirements" ? (
              <div className="p-6 pt-5">
                <PmRequirements project={selected} onBackToGeneration={() => setTab("wbs")} />
              </div>
            ) : tab === "wbs" ? (
              <WbsTabContent project={selected} />
            ) : tab === "assignee" ? (
              <AssigneeTabContent project={selected} />
            ) : tab === "schedule" ? (
              <ScheduleTabContent project={selected} />
            ) : (
              <DocumentsTabContent project={selected} />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState({ tab }: { tab: TabKey }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <div className="mb-2 flex size-16 items-center justify-center rounded-full bg-muted/60">
        <FileSearch className="size-7 text-muted-foreground" />
      </div>
      <p className="text-foreground text-sm">프로젝트를 선택해주세요.</p>
      <p className="text-muted-foreground text-xs">
        프로젝트를 선택하면 {EMPTY_HINT[tab]} 조회할 수 있습니다.
      </p>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <AlertCircle className="size-5 text-red-500" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}

/* ==================================================================== */
/* WBS 탭 (읽기 전용)                                                     */
/* ==================================================================== */

const DIFFICULTY_LABELS: Record<string, string> = {
  LOW: "낮음",
  MEDIUM: "보통",
  HIGH: "높음",
};

function WbsTabContent({ project }: { project: ProjectSummary }) {
  const [tasks, setTasks] = useState<WbsTask[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError("");
    projectRepository
      .getWbs(project.id)
      .then((result) => {
        if (ignore) return;
        const sorted = [...result.finalTasks].sort((a, b) => a.orderIndex - b.orderIndex);
        setTasks(sorted);
      })
      .catch((caught) => {
        if (ignore) return;
        if (caught instanceof ApiError && caught.status === 404) {
          setTasks([]);
        } else {
          setError(caught instanceof ApiError ? caught.message : "WBS를 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [project.id]);

  if (loading) return <LoadingRows />;
  if (error) return <ErrorNote message={error} />;
  if (!tasks || tasks.length === 0) {
    return (
      <p className="py-10 text-center text-muted-foreground text-sm">
        아직 생성된 WBS가 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <div key={t.externalTaskId} className="rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="font-normal">
              {t.taskCode || "-"}
            </Badge>
            {t.phase && (
              <Badge variant="outline" className="font-normal">
                {t.phase}
              </Badge>
            )}
            <Badge variant="outline" className="font-normal">
              난이도 {DIFFICULTY_LABELS[t.difficulty] ?? t.difficulty}
            </Badge>
            <span className="text-muted-foreground text-xs">{t.estimatedHours}시간</span>
          </div>
          <p className="mt-1.5 text-foreground text-sm">{t.taskName}</p>
          {t.description && (
            <p className="mt-0.5 text-muted-foreground text-xs">{t.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ==================================================================== */
/* 담당자 탭                                                              */
/* ==================================================================== */

function AssigneeTabContent({ project }: { project: ProjectSummary }) {
  const members: TeamMember[] = projectMembers(project.id);

  if (members.length === 0) {
    return (
      <p className="py-10 text-center text-muted-foreground text-sm">
        배정된 담당자가 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {members.map((m) => {
        const pct = m.total > 0 ? Math.round((m.done / m.total) * 100) : 0;
        return (
          <div
            key={m.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
          >
            <div>
              <p className="text-foreground text-sm">{m.name}</p>
              <p className="text-muted-foreground text-xs">{m.role}</p>
            </div>
            <div className="text-right">
              <p className="text-foreground text-sm">{pct}%</p>
              <p className="text-muted-foreground text-xs">
                완료 {m.done}건 / 전체 {m.total}건
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ==================================================================== */
/* 일정 탭                                                                */
/* ==================================================================== */

function ScheduleTabContent({ project }: { project: ProjectSummary }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="rounded-lg border border-border p-4">
        <p className="text-muted-foreground text-xs">진행 상태</p>
        <p className="mt-1 text-foreground text-sm">{project.status}</p>
      </div>
      <div className="rounded-lg border border-border p-4">
        <p className="text-muted-foreground text-xs">진행률</p>
        <p className="mt-1 text-foreground text-sm">{project.progress}%</p>
      </div>
      <div className="rounded-lg border border-border p-4">
        <p className="text-muted-foreground text-xs">마감일</p>
        <p className="mt-1 text-foreground text-sm">{project.dueDate || "-"}</p>
      </div>
      <div className="rounded-lg border border-border p-4">
        <p className="text-muted-foreground text-xs">최근 업데이트</p>
        <p className="mt-1 text-foreground text-sm">{project.updatedAt || "-"}</p>
      </div>
    </div>
  );
}

/* ==================================================================== */
/* 문서함 탭                                                              */
/* ==================================================================== */

function formatFileSize(bytes: number) {
  if (!bytes) return "-";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)}KB`;
  return `${(kb / 1024).toFixed(1)}MB`;
}

function DocumentsTabContent({ project }: { project: ProjectSummary }) {
  const [documents, setDocuments] = useState<ProjectDocumentUploadItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError("");
    projectRepository
      .listProjectDocuments(project.id)
      .then((result) => {
        if (!ignore) setDocuments(result.documents);
      })
      .catch((caught) => {
        if (ignore) return;
        setError(caught instanceof ApiError ? caught.message : "문서함을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [project.id]);

  if (loading) return <LoadingRows />;
  if (error) return <ErrorNote message={error} />;
  if (!documents || documents.length === 0) {
    return (
      <p className="py-10 text-center text-muted-foreground text-sm">
        업로드된 문서가 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((d) => (
        <div
          key={d.documentId}
          className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
        >
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-foreground text-sm">{d.originalFileName}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-muted-foreground text-xs">{formatFileSize(d.fileSize)}</span>
            <Badge variant="outline" className="font-normal">
              {d.status}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
