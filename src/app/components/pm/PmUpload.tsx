import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Checkbox } from "@/app/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { cn } from "@/app/components/ui/utils";
import {
  ApiError,
  projectRepository,
  type ProjectDocumentUploadItem,
  type RequirementChangeCandidate,
  type RequirementResponse,
  type RequirementsResult,
} from "@/app/api/projectRepository";
import { RequirementEvidenceViewer } from "./RequirementEvidenceViewer";
import { RequirementChangeReview } from "./RequirementChangeReview";
import { OrganizationChartArtifactCard } from "@/app/components/common/OrganizationChartArtifactCard";
import {
  PROJECT_DOCUMENT_ACCEPT,
  validateProjectDocumentFiles,
} from "@/app/components/pm/projectDocumentUpload";
import type { UploadedRfp } from "@/app/data/demoData";
import type { ProjectSummary } from "@/app/projects/projectTypes";

const REQUIREMENTS_VISIBLE_STEP = 8;
const REQUIREMENTS_SCROLL_OFFSET = 72;

interface ActiveRequirementAnalysis {
  documentIds: Set<string>;
  promise: Promise<RequirementsResult>;
}

const activeRequirementAnalyses = new Map<string, ActiveRequirementAnalysis>();

function statusClass(status: UploadedRfp["status"]) {
  if (status === "분석 완료") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "분석 중") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function formatFileSize(fileSize: number) {
  if (fileSize < 1024) return `${fileSize}B`;
  if (fileSize < 1024 * 1024) return `${(fileSize / 1024).toFixed(1)}KB`;
  return `${(fileSize / (1024 * 1024)).toFixed(1)}MB`;
}

function toUploadRow(document: ProjectDocumentUploadItem): UploadedRfp {
  const status: UploadedRfp["status"] =
    document.status === "ANALYZED"
      ? "분석 완료"
      : document.status === "ANALYZING"
        ? "분석 중"
        : "대기";

  return {
    id: String(document.documentId),
    name: document.originalFileName,
    size: formatFileSize(document.fileSize),
    uploadedAt: "서버 저장됨",
    status,
    requirementCount: 0,
  };
}

function analysisErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) {
    return "요구사항 분석 중 오류가 발생했습니다.";
  }

  const messages: Partial<Record<number, string>> = {
    400: "분석할 프로젝트 문서를 확인해 주세요.",
    403: "이 프로젝트를 분석할 권한이 없습니다.",
    409: "동일한 문서 분석 결과가 이미 존재하거나 분석 중입니다.",
    422: "문서 형식을 분석 서버가 처리할 수 없습니다.",
    502: "분석 결과 형식이 올바르지 않습니다. 잠시 후 다시 시도해 주세요.",
    503: "분석 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    504: "문서 분석 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.",
  };

  return messages[error.status] ?? error.message;
}

function analyzedRequirements(result: RequirementsResult) {
  return Array.isArray(result.aiSuggestions)
    ? result.aiSuggestions
    : [];
}

function DocumentMeta({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 md:block">
      <span className="text-xs font-medium text-muted-foreground md:hidden">
        {label}
      </span>
      <span
        className={cn(
          "text-sm leading-5",
          emphasize ? "font-semibold text-primary" : "text-muted-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function PmUpload({
  mode = "demo",
  project,
  onDocumentsUploaded,
  onAnalysisComplete,
}: {
  mode?: "demo" | "real";
  project: ProjectSummary;
  onDocumentsUploaded?: (documents: ProjectDocumentUploadItem[]) => void;
  onAnalysisComplete?: () => void;
}) {
  const projectKey = String(project.id);
  const [files, setFiles] = useState<UploadedRfp[]>([]);
  const [dragging, setDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [requirements, setRequirements] = useState<RequirementResponse[]>([]);
  const [visibleRequirementCount, setVisibleRequirementCount] = useState(
    REQUIREMENTS_VISIBLE_STEP,
  );
  const [isLoadingRequirements, setIsLoadingRequirements] = useState(true);
  const [requirementsLoadError, setRequirementsLoadError] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [deletingDocumentIds, setDeletingDocumentIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [trackedAnalysisDocumentIds, setTrackedAnalysisDocumentIds] = useState<
    Set<string>
  >(
    () =>
      new Set(
        activeRequirementAnalyses.get(projectKey)?.documentIds ?? [],
      ),
  );
  const [isReadjusting, setIsReadjusting] = useState(false);
  const [changeCandidates, setChangeCandidates] = useState<
    RequirementChangeCandidate[]
  >([]);
  const [evidenceRequirement, setEvidenceRequirement] =
    useState<RequirementResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requirementsCardRef = useRef<HTMLDivElement>(null);
  const scrollAfterCollapseRef = useRef(false);
  const serverAnalysisInProgress = files.some(
    (file) => file.status === "분석 중",
  );
  const analysisInProgress =
    isReadjusting ||
    trackedAnalysisDocumentIds.size > 0 ||
    serverAnalysisInProgress;

  const loadDocuments = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoadingDocuments(true);
    setLoadError("");

    try {
      const response = await projectRepository.listProjectDocuments(project.id);
      const trackedDocumentIds =
        activeRequirementAnalyses.get(String(project.id))?.documentIds ??
        new Set<string>();
      const nextFiles = response.documents.map((document) => {
        const file = toUploadRow(document);
        if (trackedDocumentIds.size === 0) return file;
        return {
          ...file,
          status: trackedDocumentIds.has(file.id) ? "분석 중" : "대기",
          requirementCount: 0,
        } satisfies UploadedRfp;
      });
      setFiles(nextFiles);
      setTrackedAnalysisDocumentIds(new Set(trackedDocumentIds));
      setSelectedDocumentIds((current) => {
        const availableIds = new Set(
          response.documents.map((document) => String(document.documentId)),
        );
        const nextSelectedIds = new Set(
          [...current].filter((id) => availableIds.has(id)),
        );
        response.documents.forEach((document) => {
          if (
            document.status === "ANALYZING" ||
            trackedDocumentIds.has(String(document.documentId))
          ) {
            nextSelectedIds.add(String(document.documentId));
          }
        });
        return nextSelectedIds;
      });
      return nextFiles;
    } catch (error) {
      setLoadError(
        error instanceof ApiError
          ? error.message
          : "프로젝트 문서 목록을 불러오지 못했습니다.",
      );
      return null;
    } finally {
      if (showLoading) setIsLoadingDocuments(false);
    }
  }, [project.id]);

  const loadRequirements = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoadingRequirements(true);
    setRequirementsLoadError("");

    try {
      const result = await projectRepository.getRequirements(project.id);
      setRequirements(analyzedRequirements(result));
      return true;
    } catch (error) {
      setRequirementsLoadError(
        error instanceof ApiError
          ? error.message
          : "요구사항을 불러오지 못했습니다.",
      );
      return false;
    } finally {
      if (showLoading) setIsLoadingRequirements(false);
    }
  }, [project.id]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    void loadRequirements();
  }, [loadRequirements]);

  useEffect(() => {
    const activeAnalysis = activeRequirementAnalyses.get(projectKey);
    if (!activeAnalysis) return;

    let cancelled = false;
    const activeDocumentIds = new Set(activeAnalysis.documentIds);
    setTrackedAnalysisDocumentIds(activeDocumentIds);
    setSelectedDocumentIds(activeDocumentIds);

    void activeAnalysis.promise
      .then((result) => {
        if (cancelled) return;

        const latestRequirements = analyzedRequirements(result).filter(
          (requirement) =>
            requirement.sourceDocumentId != null &&
            activeDocumentIds.has(String(requirement.sourceDocumentId)),
        );
        setRequirements(latestRequirements);
        setRequirementsLoadError("");
        setChangeCandidates([]);
        setFiles((current) =>
          current.map((file) => {
            if (!activeDocumentIds.has(file.id)) {
              return { ...file, status: "대기", requirementCount: 0 };
            }
            const documentId = Number(file.id);
            const requirementCount = latestRequirements.filter(
              (requirement) => requirement.sourceDocumentId === documentId,
            ).length;
            return { ...file, status: "분석 완료", requirementCount };
          }),
        );
        setSelectedDocumentIds(new Set());
      })
      .catch((error) => {
        if (cancelled) return;
        setAnalysisError(analysisErrorMessage(error));
        void loadDocuments(false);
      })
      .finally(() => {
        if (!cancelled) setTrackedAnalysisDocumentIds(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [loadDocuments, projectKey]);

  useEffect(() => {
    setVisibleRequirementCount(REQUIREMENTS_VISIBLE_STEP);
  }, [project.id, requirements]);

  useEffect(() => {
    if (
      !scrollAfterCollapseRef.current ||
      visibleRequirementCount !== REQUIREMENTS_VISIBLE_STEP
    ) {
      return;
    }

    scrollAfterCollapseRef.current = false;
    const frameId = window.requestAnimationFrame(() => {
      const card = requirementsCardRef.current;
      if (!card) return;

      const scrollContainer = card.closest("main");
      if (scrollContainer instanceof HTMLElement) {
        const containerTop = scrollContainer.getBoundingClientRect().top;
        const cardTop = card.getBoundingClientRect().top;
        scrollContainer.scrollTo({
          top:
            scrollContainer.scrollTop +
            cardTop -
            containerTop -
            REQUIREMENTS_SCROLL_OFFSET,
          behavior: "smooth",
        });
        return;
      }

      window.scrollTo({
        top:
          window.scrollY +
          card.getBoundingClientRect().top -
          REQUIREMENTS_SCROLL_OFFSET,
        behavior: "smooth",
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [visibleRequirementCount]);

  useEffect(() => {
    if (!serverAnalysisInProgress || isReadjusting) return;

    let cancelled = false;
    let polling = false;

    const refreshAnalysisState = async () => {
      if (polling) return;
      polling = true;

      try {
        const latestFiles = await loadDocuments(false);
        if (
          !cancelled &&
          latestFiles &&
          !latestFiles.some((file) => file.status === "분석 중")
        ) {
          await loadRequirements(false);
          if (!cancelled) setSelectedDocumentIds(new Set());
        }
      } finally {
        polling = false;
      }
    };

    const pollTimer = window.setInterval(() => {
      void refreshAnalysisState();
    }, 2_000);

    return () => {
      cancelled = true;
      window.clearInterval(pollTimer);
    };
  }, [
    isReadjusting,
    loadDocuments,
    loadRequirements,
    serverAnalysisInProgress,
  ]);

  useEffect(() => {
    if (isLoadingDocuments || isLoadingRequirements) return;

    const requirementCounts = new Map<string, number>();
    requirements.forEach((requirement) => {
      if (requirement.sourceDocumentId == null) return;
      const documentId = String(requirement.sourceDocumentId);
      requirementCounts.set(
        documentId,
        (requirementCounts.get(documentId) ?? 0) + 1,
      );
    });
    setFiles((current) =>
      current.map((file) => ({
        ...file,
        requirementCount:
          file.status === "분석 완료"
            ? requirementCounts.get(file.id) ?? 0
            : 0,
      })),
    );
  }, [isLoadingDocuments, isLoadingRequirements, requirements]);

  useEffect(() => {
    let ignore = false;
    setChangeCandidates([]);
    if (mode !== "real") {
      return () => {
        ignore = true;
      };
    }
    projectRepository
      .listRequirementReadjustments(project.id)
      .then((result) => {
        if (!ignore) {
          setChangeCandidates(
            Array.isArray(result.changeCandidates)
              ? result.changeCandidates
              : [],
          );
        }
      })
      .catch(() => {
        // Initial deployments may not have candidates yet; the main page still loads.
      });
    return () => {
      ignore = true;
    };
  }, [mode, project.id]);

  const addFiles = async (selectedFiles: File[]) => {
    if (isUploading || selectedFiles.length === 0) return;

    const validationError = validateProjectDocumentFiles(selectedFiles);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsUploading(true);
    try {
      const response = await projectRepository.uploadProjectDocuments(
        project.id,
        selectedFiles,
      );
      await loadDocuments();
      onDocumentsUploaded?.(response.documents);
      toast.success(`${response.documents.length}개 프로젝트 문서를 업로드했습니다.`);
    } catch (caught) {
      const message =
        caught instanceof ApiError
          ? caught.message
          : "파일 업로드 중 오류가 발생했습니다.";
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePick = () => inputRef.current?.click();

  const onSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    void addFiles(selectedFiles);
  };

  const toggleDocument = (id: string) => {
    setSelectedDocumentIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllDocuments = () => {
    setSelectedDocumentIds((current) =>
      current.size === files.length
        ? new Set()
        : new Set(files.map((file) => file.id)),
    );
  };

  const readjustRequirements = async (documentIdsOverride?: string[]) => {
    if (analysisInProgress) return;

    const activeDocumentIds = new Set(
      documentIdsOverride ?? [...selectedDocumentIds],
    );
    if (activeDocumentIds.size === 0) return;

    const documentIds = [...activeDocumentIds]
      .map(Number)
      .filter((id) => Number.isSafeInteger(id) && id > 0);

    if (documentIds.length === 0) {
      toast.error("재조정에 사용할 문서를 확인해 주세요.");
      return;
    }

    const isInitialAnalysis = requirements.length === 0;
    const previousFileStates = new Map(
      files.map((file) => [
        file.id,
        {
          status: file.status,
          requirementCount: file.requirementCount,
        },
      ] as const),
    );
    setAnalysisError("");
    setIsReadjusting(true);
    setTrackedAnalysisDocumentIds(activeDocumentIds);
    setFiles((current) =>
      current.map((file) =>
        activeDocumentIds.has(file.id)
          ? { ...file, status: "분석 중", requirementCount: 0 }
          : { ...file, status: "대기", requirementCount: 0 },
      ),
    );

    const analysisPromise = projectRepository.analyzeProjectRequirements(
      project.id,
      { documentIds, force: true },
    );
    activeRequirementAnalyses.set(projectKey, {
      documentIds: activeDocumentIds,
      promise: analysisPromise,
    });

    try {
      const result = await analysisPromise;
      const latestRequirements = analyzedRequirements(result).filter(
        (requirement) =>
          requirement.sourceDocumentId != null &&
          activeDocumentIds.has(String(requirement.sourceDocumentId)),
      );
      setRequirements(latestRequirements);
      setRequirementsLoadError("");
      setChangeCandidates([]);
      setFiles((current) =>
        current.map((file) => {
          if (!activeDocumentIds.has(file.id)) {
            return { ...file, status: "대기", requirementCount: 0 };
          }
          const documentId = Number(file.id);
          const requirementCount = latestRequirements.filter(
            (requirement) => requirement.sourceDocumentId === documentId,
          ).length;
          return { ...file, status: "분석 완료", requirementCount };
        }),
      );
      toast.success(
        isInitialAnalysis
          ? "요구사항 분석을 완료했습니다."
          : "선택한 문서 기준으로 요구사항을 다시 분석했습니다.",
      );
      onAnalysisComplete?.();
      setSelectedDocumentIds(new Set());
    } catch (error) {
      setFiles((current) =>
        current.map((file) => {
          const previous = previousFileStates.get(file.id);
          return previous ? { ...file, ...previous } : file;
        }),
      );
      const message = analysisErrorMessage(error);
      setAnalysisError(message);
      toast.error(message);
    } finally {
      const activeAnalysis = activeRequirementAnalyses.get(projectKey);
      if (activeAnalysis?.promise === analysisPromise) {
        activeRequirementAnalyses.delete(projectKey);
      }
      setTrackedAnalysisDocumentIds(new Set());
      setIsReadjusting(false);
    }
  };

  const remove = async (id: string) => {
    if (deletingDocumentIds.has(id) || analysisInProgress) return;

    setDeletingDocumentIds((current) => new Set(current).add(id));
    try {
      await projectRepository.deleteProjectDocument(project.id, id);
      await loadDocuments();
      toast.success("프로젝트 문서를 삭제했습니다.");
    } catch (error) {
      const message =
        error instanceof ApiError && error.status === 409
          ? "도출된 요구사항에서 사용 중인 문서는 삭제할 수 없습니다."
          : error instanceof ApiError
            ? error.message
            : "프로젝트 문서를 삭제하지 못했습니다.";
      toast.error(message);
    } finally {
      setDeletingDocumentIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  const projectDataLoading =
    isLoadingDocuments || isLoadingRequirements;
  const visibleRequirements = requirements.slice(0, visibleRequirementCount);
  const hiddenRequirementCount = Math.max(
    0,
    requirements.length - visibleRequirementCount,
  );
  const collapseRequirements = () => {
    scrollAfterCollapseRef.current = true;
    setVisibleRequirementCount(REQUIREMENTS_VISIBLE_STEP);
  };

  return (
    <div className="space-y-6">
      {mode === "real" ? (
        <OrganizationChartArtifactCard
          projectId={project.id}
          canGenerate
        />
      ) : null}

      <Card>
        <CardHeader className="space-y-1.5">
          <CardTitle className="text-xl font-semibold tracking-tight">
            프로젝트 문서 업로드
          </CardTitle>
          <CardDescription className="text-sm leading-5">
            분석할 프로젝트 문서를 등록하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={inputRef}
            type="file"
            accept={PROJECT_DOCUMENT_ACCEPT}
            multiple
            disabled={isUploading}
            className="hidden"
            onChange={onSelected}
          />
          <button
            type="button"
            disabled={isUploading}
            onClick={handlePick}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (!isUploading) {
                void addFiles(Array.from(event.dataTransfer.files));
              }
            }}
            className={cn(
              "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center transition-colors",
              isUploading && "pointer-events-none opacity-60",
              dragging
                ? "border-primary bg-accent"
                : "border-border bg-muted/40 hover:bg-muted",
            )}
          >
            {isUploading ? (
              <Loader2 className="size-7 animate-spin text-primary" />
            ) : (
              <UploadCloud className="size-7 text-muted-foreground" />
            )}
            <div className="text-foreground">
              {isUploading
                ? "프로젝트 문서를 업로드하는 중입니다."
                : "파일을 끌어다 놓거나 클릭하여 업로드"}
            </div>
            <div className="text-xs text-muted-foreground">
              PDF · DOCX · XLSX · PPTX · TXT · 파일당 최대 10MB
            </div>
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <CardTitle className="text-xl font-semibold tracking-tight">
                업로드된 문서
              </CardTitle>
              <CardDescription className="text-sm leading-5">
                분석할 문서를 선택하고 요구사항을 생성하거나 재조정하세요.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="text-sm text-muted-foreground">
                선택 {selectedDocumentIds.size}개
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={files.length === 0 || analysisInProgress}
                onClick={toggleAllDocuments}
              >
                {selectedDocumentIds.size === files.length && files.length > 0
                  ? "전체 해제"
                  : "전체 선택"}
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={selectedDocumentIds.size === 0 || analysisInProgress}
                onClick={() => void readjustRequirements()}
              >
                {analysisInProgress ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                {analysisInProgress
                  ? "요구사항 분석 중"
                  : requirements.length > 0
                    ? "선택 문서로 요구사항 재조정"
                    : "선택 문서로 요구사항 분석"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-border/80">
            <div className="hidden grid-cols-[minmax(0,2.2fr)_0.7fr_1fr_0.9fr_0.8fr_1.25fr] items-center gap-4 border-b bg-muted/35 px-4 py-3 text-xs font-semibold text-muted-foreground md:grid">
              <div>파일명</div>
              <div>용량</div>
              <div>업로드</div>
              <div>추출 요구사항</div>
              <div>상태</div>
              <div className="text-right">작업</div>
            </div>

            <div className="divide-y divide-border/70">
              {files.map((file) => (
                <div
                  key={file.id}
                  data-document-id={file.id}
                  onClick={() => {
                    if (
                      !analysisInProgress &&
                      !deletingDocumentIds.has(file.id)
                    ) {
                      toggleDocument(file.id);
                    }
                  }}
                  className={cn(
                    "grid gap-3 px-4 py-4 transition-colors md:grid-cols-[minmax(0,2.2fr)_0.7fr_1fr_0.9fr_0.8fr_1.25fr] md:items-center md:gap-4",
                    analysisInProgress || deletingDocumentIds.has(file.id)
                      ? "cursor-not-allowed"
                      : "cursor-pointer hover:bg-muted/20",
                    selectedDocumentIds.has(file.id) && "bg-cyan-50/60",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedDocumentIds.has(file.id)}
                        disabled={
                          analysisInProgress || deletingDocumentIds.has(file.id)
                        }
                        onClick={(event) => event.stopPropagation()}
                        onCheckedChange={() => toggleDocument(file.id)}
                        aria-label={`${file.name} 분석 대상 선택`}
                      />
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-rose-200/80 bg-rose-50 text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/35 dark:text-rose-300">
                        <FileText className="size-4" />
                      </span>
                      <span className="min-w-0 break-all text-sm font-medium leading-5 text-foreground">
                        {file.name}
                      </span>
                    </div>
                  </div>

                  <DocumentMeta label="용량" value={file.size} />
                  <DocumentMeta label="업로드" value={file.uploadedAt} />
                  <DocumentMeta
                    label="추출 요구사항"
                    value={file.requirementCount > 0 ? `${file.requirementCount}건` : "없음"}
                    emphasize={file.requirementCount > 0}
                  />

                  <div className="flex items-center justify-between gap-3 md:block">
                    <span className="text-xs font-medium text-muted-foreground md:hidden">상태</span>
                    <Badge
                      variant="outline"
                      aria-live="polite"
                      className={cn(
                        "font-medium transition-colors duration-300",
                        statusClass(file.status),
                        file.status === "분석 중" && "animate-pulse",
                      )}
                    >
                      {file.status}
                    </Badge>
                  </div>

                  <div
                    className="flex flex-wrap items-center justify-end gap-1.5"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {mode === "demo" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => toast(`"${file.name}" 다운로드`)}
                          className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
                          aria-label="다운로드"
                          title="다운로드"
                        >
                          <Download className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={
                            analysisInProgress || deletingDocumentIds.has(file.id)
                          }
                          onClick={() => void remove(file.id)}
                          className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:border-rose-900/60 dark:hover:bg-rose-950/30 dark:hover:text-rose-300"
                          aria-label="삭제"
                          title="삭제"
                          aria-busy={deletingDocumentIds.has(file.id)}
                        >
                          {deletingDocumentIds.has(file.id) ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}

              {isLoadingDocuments && (
                <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  프로젝트 문서를 불러오는 중입니다.
                </div>
              )}

              {!isLoadingDocuments && loadError && (
                <div className="px-4 py-10 text-center text-sm text-destructive">
                  {loadError}
                </div>
              )}

              {!isLoadingDocuments && !loadError && files.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  업로드된 문서가 없습니다.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div ref={requirementsCardRef} data-testid="derived-requirements-card">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ClipboardList className="size-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-semibold tracking-tight">
                  도출된 요구사항
                </CardTitle>
                <CardDescription className="mt-1 text-sm leading-5">
                  분석된 요구사항과 원문 근거를 확인하세요.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
          {analysisError && (
            <Alert variant="destructive">
              <AlertDescription>{analysisError}</AlertDescription>
            </Alert>
          )}

          {analysisInProgress && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              <Loader2 className="size-4 animate-spin" />
              요구사항을 분석하고 있습니다. 잠시만 기다려 주세요.
            </div>
          )}

          {requirementsLoadError && (
            <Alert variant="destructive">
              <AlertDescription>{requirementsLoadError}</AlertDescription>
            </Alert>
          )}

          {projectDataLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              프로젝트 문서와 요구사항을 불러오는 중입니다.
            </div>
          ) : requirements.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border [&_[data-slot=table-container]]:overflow-x-hidden">
              <Table className="w-full table-fixed">
                <TableHeader>
                  <TableRow className="bg-teal-50/85 hover:bg-teal-50/85 dark:bg-teal-950/30 dark:hover:bg-teal-950/30">
                    <TableHead
                      className={cn(
                        "font-semibold text-teal-950 dark:text-teal-100",
                        mode === "demo" ? "w-[30%]" : "w-auto",
                      )}
                    >
                      제목
                    </TableHead>
                    {mode === "demo" ? (
                      <TableHead className="font-semibold text-teal-950 dark:text-teal-100">설명</TableHead>
                    ) : null}
                    <TableHead className="w-24 text-center font-semibold text-teal-950 dark:text-teal-100 sm:w-32">유형</TableHead>
                    <TableHead className="w-14 text-center font-semibold text-teal-950 dark:text-teal-100 sm:w-20">근거</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRequirements.map((requirement) => {
                    const canOpenEvidence =
                      (Array.isArray(requirement.evidences) &&
                        requirement.evidences.length > 0) ||
                      Boolean(requirement.sourceExcerpt);
                    return (
                      <TableRow
                        key={requirement.requirementId}
                        role={canOpenEvidence ? "button" : undefined}
                        tabIndex={canOpenEvidence ? 0 : undefined}
                        className={cn(
                          canOpenEvidence &&
                            "cursor-pointer hover:bg-primary/[0.035]",
                        )}
                        onClick={() => {
                          if (canOpenEvidence) {
                            setEvidenceRequirement(requirement);
                          }
                        }}
                        onKeyDown={(event) => {
                          if (
                            canOpenEvidence &&
                            (event.key === "Enter" || event.key === " ")
                          ) {
                            event.preventDefault();
                            setEvidenceRequirement(requirement);
                          }
                        }}
                      >
                      <TableCell
                        className="whitespace-normal break-words font-medium leading-5 text-foreground [overflow-wrap:anywhere]"
                      >
                        {requirement.title}
                      </TableCell>
                      {mode === "demo" ? (
                        <TableCell className="whitespace-normal break-words text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                          {requirement.description}
                        </TableCell>
                      ) : null}
                      <TableCell className="whitespace-normal break-words text-center [overflow-wrap:anywhere]">
                        <Badge variant="outline" className="mx-auto max-w-full whitespace-normal break-all text-center font-normal leading-4">
                          {requirement.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          disabled={!canOpenEvidence}
                          title="원문 근거 확인"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEvidenceRequirement(requirement);
                          }}
                        >
                          <Eye className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {requirements.length > REQUIREMENTS_VISIBLE_STEP ? (
                <div className="flex justify-center gap-2 border-t border-border/70 bg-muted/15 px-4 py-3">
                  {hiddenRequirementCount > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setVisibleRequirementCount((current) =>
                          Math.min(
                            current + REQUIREMENTS_VISIBLE_STEP,
                            requirements.length,
                          ),
                        )
                      }
                    >
                      더보기 ({hiddenRequirementCount}개)
                      <ChevronDown className="size-4" />
                    </Button>
                  ) : null}
                  {visibleRequirementCount > REQUIREMENTS_VISIBLE_STEP ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={collapseRequirements}
                    >
                      접기
                      <ChevronUp className="size-4" />
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : !requirementsLoadError && loadError ? (
            <Alert variant="destructive">
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          ) : !requirementsLoadError && files.length > 0 ? (
            <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed border-border p-5">
              <div>
                <div className="font-medium text-foreground">
                  아직 도출된 요구사항이 없습니다.
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  업로드 문서를 선택한 뒤 분석을 시작하세요.
                </p>
              </div>
              <Button
                type="button"
                disabled={analysisInProgress}
                onClick={() =>
                  void readjustRequirements(files.map((file) => file.id))
                }
              >
                {analysisInProgress ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                {analysisInProgress ? "요구사항 분석 중" : "전체 문서 분석"}
              </Button>
            </div>
          ) : !requirementsLoadError ? (
            <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed border-border p-5">
              <div>
                <div className="font-medium text-foreground">
                  분석할 프로젝트 문서가 필요합니다.
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  위 영역에서 문서를 먼저 등록하세요.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={isUploading}
                onClick={handlePick}
              >
                <UploadCloud className="size-4" />
                문서 업로드
              </Button>
            </div>
          ) : null}
          </CardContent>
        </Card>
      </div>

      {changeCandidates.length > 0 ? (
        <Card>
          <CardHeader className="space-y-1.5">
            <CardTitle className="text-xl font-semibold tracking-tight">
              AI 재조정 검토
            </CardTitle>
            <CardDescription className="text-sm leading-5">
              변경 후보를 확인하고 적용할 항목을 승인하세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RequirementChangeReview
              projectId={project.id}
              candidates={changeCandidates}
              onCandidatesChange={setChangeCandidates}
              onApplied={(result) => {
                setRequirements(analyzedRequirements(result));
                setRequirementsLoadError("");
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      <RequirementEvidenceViewer
        open={evidenceRequirement !== null}
        onOpenChange={(open) => {
          if (!open) setEvidenceRequirement(null);
        }}
        projectId={project.id}
        requirementTitle={evidenceRequirement?.title ?? "요구사항 근거"}
        evidences={
          Array.isArray(evidenceRequirement?.evidences)
            ? evidenceRequirement.evidences
            : []
        }
        fallbackSourceDocument={evidenceRequirement?.sourceDocumentName}
        fallbackExcerpt={evidenceRequirement?.sourceExcerpt}
      />
    </div>
  );
}
