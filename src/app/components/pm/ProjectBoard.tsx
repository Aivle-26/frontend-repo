import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  FolderPlus,
  Search,
  Loader2,
  Clock,
  Activity,
  CheckCircle2,
  PencilRuler,
  Play,
  Pencil,
  Trash2,
  ArrowRight,
  CalendarClock,
  AlertTriangle,
  FileText,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import { Progress } from "@/app/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { cn } from "@/app/components/ui/utils";
import { CountUp } from "@/app/components/common/CountUp";
import {
  ApiError,
  projectRepository,
  type CreateProjectDraftResponse,
} from "@/app/api/projectRepository";
import type {
  ProjectDoc,
  ProjectStatus,
  ProjectSummary,
} from "@/app/projects/projectTypes";
import { WIZARD_STEPS } from "@/app/projects/projectWorkflow";

import { DocPicker } from "@/app/components/pm/DocPicker";
import {
  mapUploadedProjectDocuments,
  type PendingProjectDocument,
} from "@/app/components/pm/projectDocumentUpload";
import { formatServerProjectStatus } from "@/app/projects/projectMapping";
import {
  getProjectPlanningProgress,
  type PlanningStage,
  type ProjectPlanningProgress,
} from "@/app/projects/projectProgress";

const STATUS_META: Record<
  ProjectStatus,
  { label: string; badge: string; icon: React.ComponentType<{ className?: string }> }
> = {
  분석중: { label: "분석중", badge: "bg-muted text-muted-foreground", icon: Loader2 },
  준비: { label: "준비", badge: "bg-amber-50 text-amber-700 border-amber-200", icon: PencilRuler },
  승인대기: { label: "승인대기", badge: "bg-orange-50 text-orange-700 border-orange-200", icon: Clock },
  진행중: { label: "진행중", badge: "bg-blue-50 text-blue-700 border-blue-200", icon: Activity },
  완료: { label: "완료", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
};

interface ProjectBoardProps {
  mode?: "demo" | "real";
  projects: ProjectSummary[];
  setProjects: Dispatch<SetStateAction<ProjectSummary[]>>;
  pmEmployeeNumber: string;
  onProjectCreated: (project: ProjectSummary) => void;
  onProjectDeleted: (projectId: string) => Promise<void>;
  onOpenOperational: (project: ProjectSummary) => void;
  onOpenWizard: (project: ProjectSummary) => void;
  onExtract: (project: ProjectSummary, stage?: PlanningStage) => void;
}

export function ProjectBoard({
  mode = "demo",
  projects,
  setProjects,
  pmEmployeeNumber,
  onProjectCreated,
  onProjectDeleted,
  onOpenOperational,
  onOpenWizard,
  onExtract,
}: ProjectBoardProps) {
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<ProjectSummary | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClient, setNewClient] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [pendingDocs, setPendingDocs] = useState<PendingProjectDocument[]>([]);
  const [createdDraft, setCreatedDraft] =
    useState<CreateProjectDraftResponse | null>(null);
  const [newProjectError, setNewProjectError] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [uploadFor, setUploadFor] = useState<ProjectSummary | null>(null);
  const [uploadDocs, setUploadDocs] = useState<PendingProjectDocument[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);
  const [projectPendingDeletion, setProjectPendingDeletion] =
    useState<ProjectSummary | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(
    null,
  );
  const deleteInFlightRef = useRef<string | null>(null);
  const [planningProgress, setPlanningProgress] = useState<
    Record<string, ProjectPlanningProgress>
  >({});
  const [progressLoading, setProgressLoading] = useState<
    Record<string, boolean>
  >({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visibleProjects = projects.filter((p) =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.client.toLowerCase().includes(q),
    );

    return mode === "real"
      ? [...visibleProjects].sort(compareByNearestPlannedEndDate)
      : visibleProjects;
  }, [mode, projects, query]);

  useEffect(() => {
    if (mode !== "real" || projects.length === 0) {
      return;
    }

    let cancelled = false;
    const projectIds = projects.map((project) => project.id);

    setProgressLoading((current) => {
      const next = { ...current };
      projectIds.forEach((projectId) => {
        next[projectId] = true;
      });
      return next;
    });

    void Promise.allSettled(
      projects.map(async (project) => ({
        projectId: project.id,
        progress: await getProjectPlanningProgress(project.id),
      })),
    ).then((results) => {
      if (cancelled) return;

      setPlanningProgress((current) => {
        const next = { ...current };
        results.forEach((result) => {
          if (result.status === "fulfilled") {
            next[result.value.projectId] = result.value.progress;
          }
        });
        return next;
      });

      setProgressLoading((current) => {
        const next = { ...current };
        projectIds.forEach((projectId) => {
          next[projectId] = false;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [mode, projects]);

  const startProject = (id: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: "진행중", progress: 5, updatedAt: "방금" } : p,
      ),
    );
    setDetail(null);
    toast.success("프로젝트를 시작했어요. 진행중으로 이동합니다.");
  };

  const requestProjectDeletion = (project: ProjectSummary) => {
    if (deleteInFlightRef.current) return;
    setProjectPendingDeletion(project);
  };

  const confirmProjectDeletion = async () => {
    const project = projectPendingDeletion;
    if (!project || deleteInFlightRef.current) return;

    deleteInFlightRef.current = project.id;
    setDeletingProjectId(project.id);

    try {
      await projectRepository.deleteProject(project.id);
      await onProjectDeleted(project.id);
      setDetail((current) => (current?.id === project.id ? null : current));
      setProjectPendingDeletion(null);
      toast.success("프로젝트를 삭제했어요.");
    } catch (caught) {
      toast.error(getProjectDeleteError(caught));
    } finally {
      deleteInFlightRef.current = null;
      setDeletingProjectId(null);
    }
  };

  const openNew = () => {
    setNewName("");
    setNewClient("");
    setNewStartDate("");
    setNewEndDate("");
    setPendingDocs([]);
    setCreatedDraft(null);
    setNewProjectError("");
    setNewOpen(true);
  };

  const resetNewProject = () => {
    setNewOpen(false);
    setNewName("");
    setNewClient("");
    setNewStartDate("");
    setNewEndDate("");
    setPendingDocs([]);
    setCreatedDraft(null);
    setNewProjectError("");
  };

  const createProject = async () => {
    if (isCreatingProject) return;

    if (!createdDraft && !newName.trim()) {
      setNewProjectError("프로젝트 이름을 입력하세요.");
      return;
    }
    if (!createdDraft && (!newStartDate || !newEndDate)) {
      setNewProjectError("프로젝트 시작일과 종료일을 입력하세요.");
      return;
    }
    if (!createdDraft && newEndDate < newStartDate) {
      setNewProjectError("프로젝트 종료일은 시작일보다 빠를 수 없습니다.");
      return;
    }

    setIsCreatingProject(true);
    setNewProjectError("");
    let draftCreatedThisAttempt = false;

    try {
      let draft = createdDraft;
      if (!draft) {
        draft = await projectRepository.createProjectDraft({
          name: newName.trim(),
          description: null,
          clientOrganization: newClient.trim() || null,
          pmEmployeeNumber,
          plannedStartDate: newStartDate,
          plannedEndDate: newEndDate,
        });
        draftCreatedThisAttempt = true;
        setCreatedDraft(draft);

        const createdProject = mapCreatedDraft(draft);
        setProjects((currentProjects) => [
          createdProject,
          ...currentProjects.filter(
            (project) => project.id !== createdProject.id,
          ),
        ]);
        onProjectCreated(createdProject);
      }

      const createdProject = mapCreatedDraft(draft);
      if (pendingDocs.length === 0) {
        resetNewProject();
        toast.success(
          `"${createdProject.name}" 프로젝트를 생성했습니다. 문서는 나중에 업로드할 수 있습니다.`,
        );
        return;
      }

      const uploadResponse = await projectRepository.uploadProjectDocuments(
        draft.projectId,
        pendingDocs.map((document) => document.file),
      );
      const uploadedProject: ProjectSummary = {
        ...createdProject,
        docs: mapUploadedProjectDocuments(
          uploadResponse.documents,
          pendingDocs,
        ),
        updatedAt: "방금",
      };

      setProjects((currentProjects) => [
        uploadedProject,
        ...currentProjects.filter(
          (project) => project.id !== uploadedProject.id,
        ),
      ]);
      resetNewProject();
      toast.success(
        `"${uploadedProject.name}" 프로젝트와 문서를 등록했습니다.`,
      );
      onExtract(uploadedProject);
    } catch (caught) {
      const message = getProjectActionError(
        caught,
        createdDraft || draftCreatedThisAttempt
          ? "문서 업로드에 실패했습니다. 다시 시도해 주세요."
          : "프로젝트 생성 또는 문서 업로드에 실패했습니다.",
      );
      setNewProjectError(message);
      toast.error(message);
    } finally {
      setIsCreatingProject(false);
    }
  };

  const openUpload = (p: ProjectSummary) => {
    setDetail(null);
    setUploadDocs([]);
    setUploadError("");
    setUploadFor(p);
  };

  const saveUpload = async () => {
    if (!uploadFor || isUploadingDocuments) return;
    if (uploadDocs.length === 0) {
      setUploadError("추가할 문서를 선택하세요.");
      return;
    }

    setIsUploadingDocuments(true);
    setUploadError("");

    try {
      const uploadResponse = await projectRepository.uploadProjectDocuments(
        uploadFor.id,
        uploadDocs.map((document) => document.file),
      );
      const uploadedDocuments = mapUploadedProjectDocuments(
        uploadResponse.documents,
        uploadDocs,
      );
      const updated: ProjectSummary = {
        ...uploadFor,
        docs: [...uploadFor.docs, ...uploadedDocuments],
        updatedAt: "방금",
      };

      setProjects((currentProjects) =>
        currentProjects.map((project) =>
          project.id === updated.id ? updated : project,
        ),
      );
      setUploadFor(null);
      setUploadDocs([]);
      toast.success(`"${updated.name}" 문서를 업로드했습니다.`);

      if (uploadFor.docs.length === 0) {
        onExtract(updated);
      }
    } catch (caught) {
      const message = getProjectActionError(
        caught,
        "문서 업로드에 실패했습니다. 다시 시도해 주세요.",
      );
      setUploadError(message);
      toast.error(message);
    } finally {
      setIsUploadingDocuments(false);
    }
  };

  const openWizard = (p: ProjectSummary) => {
    setDetail(null);
    onOpenWizard(p);
  };

  return (
    <div className="space-y-5">
      {/* 상단: 데모 필터 + 검색 + 새 프로젝트 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="프로젝트·고객사 검색"
            className="h-9 w-56 pl-8"
          />
        </div>
        <Button onClick={openNew}>
          <FolderPlus className="size-4" /> 새 프로젝트
        </Button>
      </div>

      {/* 카드 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((p) => (
          <ProjectCard
            key={p.id}
            mode={mode}
            project={p}
            onOpenName={() => setDetail(p)}
            onOpen={() => onOpenOperational(p)}
            onEdit={() => openWizard(p)}
            onDelete={() => requestProjectDeletion(p)}
            isDeleting={deletingProjectId === p.id}
            onStart={() => startProject(p.id)}
            planningProgress={planningProgress[p.id]}
            isProgressLoading={progressLoading[p.id] === true}
            onOpenReal={(stage) => onExtract(p, stage)}
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
            등록된 프로젝트가 없습니다.
          </div>
        )}
      </div>

      {/* 상세 다이얼로그 */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          {detail && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  {mode === "real" ? (
                    <RealStatusBadge status={detail.server?.status} />
                  ) : (
                    <StatusBadge status={detail.status} />
                  )}
                </div>
                <DialogTitle className="mt-1">{detail.name}</DialogTitle>
                <DialogDescription>{detail.client}</DialogDescription>
              </DialogHeader>

              {mode === "real" ? (
                <div className="grid grid-cols-1 gap-3 py-1 sm:grid-cols-2">
                  <DetailStat
                    label="서버 상태"
                    value={formatServerProjectStatus(detail.server?.status)}
                  />
                  <DetailStat label="고객사" value={detail.client} />
                  <DetailStat label="프로젝트 기간" value={detail.updatedAt} />
                  <DetailStat
                    label="설명"
                    value={detail.server?.description?.trim() || "등록된 설명 없음"}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 py-1">
                  <DetailStat label="상태" value={STATUS_META[detail.status].label} />
                  <DetailStat label="요구사항" value={`${detail.reqCount}건`} />
                  {detail.status === "진행중" || detail.status === "완료" ? (
                    <>
                      <DetailStat label="진행률" value={`${detail.progress}%`} />
                      <DetailStat label="마감" value={detail.dueDate} />
                      <DetailStat label="리스크" value={`${detail.riskCount}건`} />
                    </>
                  ) : (
                    <>
                      <DetailStat
                        label="준비 단계"
                        value={`${detail.wizardStep}/${WIZARD_STEPS.length}`}
                      />
                      <DetailStat label="견적" value={detail.estimate} />
                    </>
                  )}
                  <DetailStat label="업데이트" value={detail.updatedAt} />
                </div>
              )}

              {/* 초기 문서 */}
              {mode === "demo" ? (
                <div className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-foreground text-sm">
                    초기 문서 {detail.docs.length}건
                  </span>
                  {detail.status !== "완료" && (
                    <Button variant="outline" size="sm" onClick={() => openUpload(detail)}>
                      <UploadCloud className="size-3.5" /> 문서 업로드
                    </Button>
                  )}
                </div>
                {detail.docs.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {detail.docs.map((d, i) => (
                      <div key={`${d.name}-${i}`} className="flex items-center gap-2 text-sm">
                        <FileText className="size-3.5 text-muted-foreground" />
                        <span className="flex-1 truncate text-foreground">{d.name}</span>
                        <Badge variant="secondary" className="font-normal">
                          {d.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-muted-foreground text-xs">
                    아직 업로드된 문서가 없어요. 나중에 올릴 수 있어요.
                  </p>
                )}
                </div>
              ) : null}

              <DialogFooter>
                {mode === "real" ? (
                  <>
                    <Button
                      variant="outline"
                      disabled={deletingProjectId === detail.id}
                      onClick={() => requestProjectDeletion(detail)}
                    >
                      {deletingProjectId === detail.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                      삭제
                    </Button>
                    <Button
                      disabled={progressLoading[detail.id] === true}
                      onClick={() => {
                        const project = detail;
                        const stage =
                          planningProgress[project.id]?.stage ?? "requirements";
                        setDetail(null);
                        onExtract(project, stage);
                      }}
                    >
                      {progressLoading[detail.id] === true ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          진행도 확인 중
                        </>
                      ) : (
                        <>
                          {planningProgress[detail.id]?.buttonLabel ??
                            "요구사항 만들러 가기"}
                          <ArrowRight className="size-4" />
                        </>
                      )}
                    </Button>
                  </>
                ) : detail.status === "진행중" || detail.status === "완료" ? (
                  <Button
                    onClick={() => {
                      const d = detail;
                      setDetail(null);
                      onOpenOperational(d);
                    }}
                  >
                    운영 대시보드 열기 <ArrowRight className="size-4" />
                  </Button>
                ) : detail.status === "분석중" ? (
                  <Button disabled>
                    <Loader2 className="size-4 animate-spin" /> AI 분석 중…
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      disabled={deletingProjectId === detail.id}
                      onClick={() => requestProjectDeletion(detail)}
                    >
                      {deletingProjectId === detail.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                      삭제
                    </Button>
                    <Button variant="outline" onClick={() => openWizard(detail)}>
                      <Pencil className="size-4" /> 준비 마법사
                    </Button>
                    <Button
                      disabled={detail.wizardStep < WIZARD_STEPS.length}
                      onClick={() => startProject(detail.id)}
                    >
                      <Play className="size-4" /> 시작
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!projectPendingDeletion}
        onOpenChange={(open) => {
          if (!open && !deleteInFlightRef.current) {
            setProjectPendingDeletion(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>프로젝트 삭제</DialogTitle>
            <DialogDescription>
              {projectPendingDeletion
                ? `"${projectPendingDeletion.name}" 프로젝트를 삭제합니다. 관련 문서와 분석 결과도 함께 삭제됩니다.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={!!deletingProjectId}
              onClick={() => setProjectPendingDeletion(null)}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              disabled={!!deletingProjectId}
              onClick={confirmProjectDeletion}
            >
              {deletingProjectId ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {deletingProjectId ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 새 프로젝트 다이얼로그 */}
      <Dialog
        open={newOpen}
        onOpenChange={(open) => {
          if (isCreatingProject) return;
          if (open) {
            setNewOpen(true);
          } else {
            resetNewProject();
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl overflow-hidden sm:max-w-2xl">
          <DialogHeader className="min-w-0">
            <DialogTitle>새 프로젝트</DialogTitle>
            <DialogDescription>
              프로젝트를 등록한 뒤 선택한 초기 문서를 안전하게 업로드합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="min-w-0 space-y-4 overflow-hidden py-1">
            <div className="space-y-2">
              <label className="text-sm text-foreground">프로젝트 이름</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="예: 신규 커머스 플랫폼 구축"
                disabled={isCreatingProject || !!createdDraft}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-foreground">고객사</label>
              <Input
                value={newClient}
                onChange={(e) => setNewClient(e.target.value)}
                placeholder="예: 한국전력공사"
                disabled={isCreatingProject || !!createdDraft}
              />
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <label
                  htmlFor="new-project-start-date"
                  className="text-sm text-foreground"
                >
                  시작일
                </label>
                <Input
                  id="new-project-start-date"
                  type="date"
                  value={newStartDate}
                  onChange={(event) => setNewStartDate(event.target.value)}
                  disabled={isCreatingProject || !!createdDraft}
                />
              </div>
              <div className="min-w-0 space-y-2">
                <label
                  htmlFor="new-project-end-date"
                  className="text-sm text-foreground"
                >
                  종료일
                </label>
                <Input
                  id="new-project-end-date"
                  type="date"
                  value={newEndDate}
                  onChange={(event) => setNewEndDate(event.target.value)}
                  disabled={isCreatingProject || !!createdDraft}
                />
              </div>
            </div>

            <div className="min-w-0 space-y-2 overflow-hidden">
              <label className="text-sm text-foreground">초기 문서 업로드</label>
              <DocPicker
                documents={pendingDocs}
                onChange={setPendingDocs}
                onError={setNewProjectError}
                disabled={isCreatingProject}
              />
              <p className="text-muted-foreground text-xs">
                지금 문서가 없으면 그냥 생성하고 나중에 업로드해도 돼요.
              </p>
            </div>

            {createdDraft && (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                프로젝트는 생성되었습니다. 문서 업로드만 다시 시도할 수 있습니다.
              </div>
            )}

            {newProjectError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{newProjectError}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={isCreatingProject}
              onClick={resetNewProject}
            >
              취소
            </Button>
            <Button
              disabled={isCreatingProject}
              onClick={() => void createProject()}
            >
              {isCreatingProject ? (
                <Loader2 className="size-4 animate-spin" />
              ) : createdDraft ? (
                <UploadCloud className="size-4" />
              ) : (
                <FolderPlus className="size-4" />
              )}
              {isCreatingProject
                ? "처리 중"
                : createdDraft
                  ? "문서 업로드 재시도"
                  : "프로젝트 생성"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 문서 업로드(나중에) 다이얼로그 */}
      <Dialog
        open={!!uploadFor}
        onOpenChange={(open) => {
          if (!open && !isUploadingDocuments) {
            setUploadFor(null);
            setUploadDocs([]);
            setUploadError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>문서 업로드</DialogTitle>
            <DialogDescription>
              {uploadFor
                ? `${uploadFor.name} · 기존 문서는 유지하고 새 문서를 추가합니다.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {uploadFor && uploadFor.docs.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-sm font-medium text-foreground">
                  등록된 문서
                </div>
                {uploadFor.docs.map((document, index) => (
                  <div
                    key={`${document.name}-${index}`}
                    className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5"
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-sm text-foreground">
                      {document.name}
                    </span>
                    <Badge variant="secondary" className="font-normal">
                      {document.type}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            <DocPicker
              documents={uploadDocs}
              onChange={setUploadDocs}
              onError={setUploadError}
              disabled={isUploadingDocuments}
            />

            {uploadError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isUploadingDocuments}
              onClick={() => {
                setUploadFor(null);
                setUploadDocs([]);
                setUploadError("");
              }}
            >
              취소
            </Button>
            <Button
              disabled={isUploadingDocuments}
              onClick={() => void saveUpload()}
            >
              {isUploadingDocuments ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UploadCloud className="size-4" />
              )}
              {isUploadingDocuments ? "업로드 중" : "문서 업로드"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function mapCreatedDraft(
  draft: CreateProjectDraftResponse,
  docs: ProjectDoc[] = [],
): ProjectSummary {
  return {
    id: String(draft.projectId),
    server: {
      description: null,
      pmEmployeeNumber: draft.pmEmployeeNumber,
      status: draft.status,
      plannedStartDate: draft.plannedStartDate,
      plannedEndDate: draft.plannedEndDate,
    },
    name: draft.name,
    client: draft.clientOrganization?.trim() || "고객사 미지정",
    status: "준비",
    progress: 0,
    dueDate: draft.plannedEndDate,
    riskCount: 0,
    reqCount: 0,
    wizardStep: 0,
    estimate: "-",
    updatedAt: `${draft.plannedStartDate} ~ ${draft.plannedEndDate}`,
    docs,
    requirements: [],
  };
}

function ddayLabel(endDate?: string | null): {
  label: string;
  overdue: boolean;
  soon: boolean;
} {
  if (!endDate) return { label: "-", overdue: false, soon: false };
  const end = new Date(`${endDate}T00:00:00`).getTime();
  if (Number.isNaN(end)) return { label: "-", overdue: false, soon: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((end - today.getTime()) / 86_400_000);
  if (days === 0) return { label: "D-DAY", overdue: false, soon: true };
  if (days > 0) return { label: `D-${days}`, overdue: false, soon: days <= 7 };
  return { label: `D+${Math.abs(days)}`, overdue: true, soon: false };
}

function getProjectActionError(caught: unknown, fallback: string) {
  return caught instanceof ApiError && caught.message.trim()
    ? caught.message
    : fallback;
}

function getProjectDeleteError(caught: unknown) {
  if (caught instanceof ApiError) {
    if (caught.status === 403) {
      return "프로젝트를 삭제할 권한이 없습니다.";
    }
    if (caught.status === 404) {
      return caught.message || "프로젝트를 찾을 수 없습니다.";
    }
    if (caught.message.trim()) {
      return caught.message;
    }
  }

  return "프로젝트를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 font-normal", meta.badge)}>
      <Icon className={cn("size-3", status === "분석중" && "animate-spin")} />
      {meta.label}
    </Badge>
  );
}

function RealStatusBadge({ status }: { status?: string }) {
  return (
    <Badge variant="outline" className="font-normal">
      {formatServerProjectStatus(status)}
    </Badge>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-foreground text-sm mt-0.5">{value}</div>
    </div>
  );
}

interface ProjectCardProps {
  mode: "demo" | "real";
  project: ProjectSummary;
  onOpenName: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  onStart: () => void;
  planningProgress?: ProjectPlanningProgress;
  isProgressLoading?: boolean;
  onOpenReal: (stage: PlanningStage) => void;
}

function ProjectCard({
  mode,
  project: p,
  onOpenName,
  onOpen,
  onEdit,
  onDelete,
  isDeleting,
  onStart,
  planningProgress,
  isProgressLoading = false,
  onOpenReal,
}: ProjectCardProps) {
  const isActive = p.status === "진행중" || p.status === "완료";
  const isPrep = p.status === "준비" || p.status === "승인대기";
  const stepPct = Math.round((p.wizardStep / WIZARD_STEPS.length) * 100);
  const dday = ddayLabel(p.server?.plannedEndDate);

  return (
    <Card
      className="transition-shadow hover:shadow-md"
      data-testid={mode === "real" ? "real-project-card" : undefined}
      data-project-id={mode === "real" ? p.id : undefined}
    >
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-2">
          <button onClick={onOpenName} className="min-w-0 text-left">
            <div className="text-foreground truncate hover:underline">{p.name}</div>
            <div className="text-muted-foreground text-xs truncate">{p.client}</div>
          </button>
          {mode === "real" ? (
            <RealStatusBadge status={p.server?.status} />
          ) : (
            <StatusBadge status={p.status} />
          )}
        </div>

        {/* 상태별 본문 */}
        <div className="mt-4 min-h-[52px]">
          {mode === "real" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <CalendarClock className="size-3.5 shrink-0" />
                <span className="truncate">{p.updatedAt}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-2xl font-medium leading-none ${
                    dday.overdue
                      ? "text-red-600"
                      : dday.soon
                        ? "text-amber-600"
                        : "text-foreground"
                  }`}
                >
                  {dday.label}
                </span>
                <span className="text-muted-foreground text-xs">
                  {dday.overdue ? "마감 지남" : "마감까지"}
                </span>
              </div>
            </div>
          ) : isActive ? (
            <>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-muted-foreground">진행률</span>
                <span className="text-foreground">
                  <CountUp value={`${p.progress}%`} />
                </span>
              </div>
              <Progress value={p.progress} />
              <div className="mt-3 flex items-center gap-4 text-muted-foreground text-xs">
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="size-3.5" /> {p.dueDate}
                </span>
                <span className="inline-flex items-center gap-1">
                  <AlertTriangle className="size-3.5" /> 리스크 {p.riskCount}
                </span>
              </div>
            </>
          ) : null}

          {mode === "demo" && p.status === "준비" ? (
            <>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-muted-foreground">준비 단계</span>
                <span className="text-foreground">
                  {p.wizardStep}/{WIZARD_STEPS.length}
                </span>
              </div>
              <Progress value={stepPct} />
              <div className="mt-3 text-muted-foreground text-xs">
                요구사항 {p.reqCount}건 · AI 추천 검토 중
              </div>
            </>
          ) : null}

          {mode === "demo" && p.status === "승인대기" ? (
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">견적</span>
                <span className="text-foreground">{p.estimate}</span>
              </div>
              <div className="text-muted-foreground text-xs">
                요구사항 {p.reqCount}건 · 2사 승인 대기
              </div>
            </div>
          ) : null}

          {mode === "demo" && p.status === "분석중" ? (
            <div className="flex items-center gap-2 py-2 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" /> AI가 초기 문서를 분석하고 있어요…
            </div>
          ) : null}
        </div>

        {/* 액션 */}
        <div className="mt-4 flex items-center justify-end gap-1.5 border-t border-border pt-3">
          {mode === "real" ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={isDeleting}
                onClick={onDelete}
              >
                {isDeleting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                삭제
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isProgressLoading}
                onClick={() =>
                  onOpenReal(planningProgress?.stage ?? "requirements")
                }
              >
                {isProgressLoading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    진행도 확인 중
                  </>
                ) : (
                  <>
                    {planningProgress?.buttonLabel ?? "요구사항 만들러 가기"}
                    <ArrowRight className="size-3.5" />
                  </>
                )}
              </Button>
            </>
          ) : isActive ? (
            <Button variant="outline" size="sm" onClick={onOpen}>
              열기 <ArrowRight className="size-3.5" />
            </Button>
          ) : null}
          {mode === "demo" && isPrep ? (
            <>
              <Button variant="ghost" size="sm" onClick={onEdit}>
                <Pencil className="size-3.5" /> 수정
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={isDeleting}
                onClick={onDelete}
              >
                {isDeleting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                삭제
              </Button>
              <Button
                size="sm"
                disabled={p.wizardStep < WIZARD_STEPS.length}
                onClick={onStart}
              >
                <Play className="size-3.5" /> 시작
              </Button>
            </>
          ) : null}
          {mode === "demo" && p.status === "분석중" ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              disabled={isDeleting}
              onClick={onDelete}
            >
              {isDeleting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              삭제
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function compareByNearestPlannedEndDate(
  first: ProjectSummary,
  second: ProjectSummary,
) {
  const firstEndDate = parsePlannedEndDate(first.server?.plannedEndDate);
  const secondEndDate = parsePlannedEndDate(second.server?.plannedEndDate);

  if (firstEndDate !== secondEndDate) {
    return firstEndDate - secondEndDate;
  }

  return first.name.localeCompare(second.name, "ko");
}

function parsePlannedEndDate(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}
