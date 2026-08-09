import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClipboardList,
  Download,
  Eye,
  FileText,
  Loader2,
  SlidersHorizontal,
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

function statusClass(status: UploadedRfp["status"]) {
  if (status === "ë¶„ì„ ?„ë£Œ") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "ë¶„ì„ ì¤?) {
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
      ? "ë¶„ì„ ?„ë£Œ"
      : document.status === "ANALYZING"
        ? "ë¶„ì„ ì¤?
        : "?€ê¸?;

  return {
    id: String(document.documentId),
    name: document.originalFileName,
    size: formatFileSize(document.fileSize),
    uploadedAt: "?œë²„ ?€?¥ë¨",
    status,
    requirementCount: 0,
  };
}

function analysisErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) {
    return "?”êµ¬?¬í•­ ë¶„ì„ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.";
  }

  const messages: Partial<Record<number, string>> = {
    400: "ë¶„ì„???„ë¡œ?íŠ¸ ë¬¸ì„œë¥??•ì¸??ì£¼ì„¸??",
    403: "???„ë¡œ?íŠ¸ë¥?ë¶„ì„??ê¶Œí•œ???†ìŠµ?ˆë‹¤.",
    409: "?™ì¼??ë¬¸ì„œ ë¶„ì„ ê²°ê³¼ê°€ ?´ë? ì¡´ì¬?˜ê±°??ë¶„ì„ ì¤‘ì…?ˆë‹¤.",
    422: "ë¬¸ì„œ ?•ì‹??ë¶„ì„ ?œë²„ê°€ ì²˜ë¦¬?????†ìŠµ?ˆë‹¤.",
    502: "ë¶„ì„ ê²°ê³¼ ?•ì‹???¬ë°”ë¥´ì? ?ŠìŠµ?ˆë‹¤. ? ì‹œ ???¤ì‹œ ?œë„??ì£¼ì„¸??",
    503: "ë¶„ì„ ?œë²„???°ê²°?????†ìŠµ?ˆë‹¤. ? ì‹œ ???¤ì‹œ ?œë„??ì£¼ì„¸??",
    504: "ë¬¸ì„œ ë¶„ì„ ?œê°„??ì´ˆê³¼?˜ì—ˆ?µë‹ˆ?? ? ì‹œ ???¤ì‹œ ?œë„??ì£¼ì„¸??",
  };

  return messages[error.status] ?? error.message;
}

function requirementStatusLabel(status: RequirementResponse["status"]) {
  if (status === "CONFIRMED") return "?•ì •";
  if (status === "REJECTED") return "ë°˜ë ¤";
  return "ê²€????;
}

function requirementStatusClass(status: RequirementResponse["status"]) {
  if (status === "CONFIRMED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "REJECTED") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function finalRequirements(result: RequirementsResult) {
  return Array.isArray(result.finalRequirements)
    ? result.finalRequirements
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
  const [files, setFiles] = useState<UploadedRfp[]>([]);
  const [dragging, setDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [requirements, setRequirements] = useState<RequirementResponse[]>([]);
  const [isLoadingRequirements, setIsLoadingRequirements] = useState(true);
  const [requirementsLoadError, setRequirementsLoadError] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isReadjusting, setIsReadjusting] = useState(false);
  const [changeCandidates, setChangeCandidates] = useState<
    RequirementChangeCandidate[]
  >([]);
  const [evidenceRequirement, setEvidenceRequirement] =
    useState<RequirementResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    setIsLoadingDocuments(true);
    setLoadError("");

    try {
      const response = await projectRepository.listProjectDocuments(project.id);
      setFiles(response.documents.map(toUploadRow));
      setSelectedDocumentIds((current) => {
        const availableIds = new Set(
          response.documents.map((document) => String(document.documentId)),
        );
        return new Set([...current].filter((id) => availableIds.has(id)));
      });
    } catch (error) {
      setLoadError(
        error instanceof ApiError
          ? error.message
          : "?„ë¡œ?íŠ¸ ë¬¸ì„œ ëª©ë¡??ë¶ˆëŸ¬?¤ì? ëª»í–ˆ?µë‹ˆ??",
      );
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [project.id]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    let ignore = false;
    setIsLoadingRequirements(true);
    setRequirementsLoadError("");

    projectRepository
      .getRequirements(project.id)
      .then((result) => {
        if (!ignore) {
          setRequirements(finalRequirements(result));
        }
      })
      .catch((error) => {
        if (!ignore) {
          setRequirementsLoadError(
            error instanceof ApiError
              ? error.message
              : "?”êµ¬?¬í•­??ë¶ˆëŸ¬?¤ì? ëª»í–ˆ?µë‹ˆ??",
          );
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingRequirements(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [project.id]);

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
      toast.success(`${response.documents.length}ê°??„ë¡œ?íŠ¸ ë¬¸ì„œë¥??…ë¡œ?œí–ˆ?µë‹ˆ??`);
    } catch (caught) {
      const message =
        caught instanceof ApiError
          ? caught.message
          : "?Œì¼ ?…ë¡œ??ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.";
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

    const activeDocumentIds = new Set(
      documentIdsOverride ?? [...selectedDocumentIds],
    );
    if (activeDocumentIds.size === 0) return;

    const documentIds = [...activeDocumentIds]
      .map(Number)
      .filter((id) => Number.isSafeInteger(id) && id > 0);

    if (documentIds.length === 0) {
      toast.error("?¬ì¡°?•ì— ?¬ìš©??ë¬¸ì„œë¥??•ì¸??ì£¼ì„¸??");
      return;
    }

    const isInitialAnalysis = requirements.length === 0;
    const previousFileStates = new Map(
      files
        .filter((file) => activeDocumentIds.has(file.id))
        .map((file) => [
          file.id,
          {
            status: file.status,
            requirementCount: file.requirementCount,
          },
        ] as const),
    );
    setAnalysisError("");
    setIsReadjusting(true);
    setFiles((current) =>
      current.map((file) =>
        activeDocumentIds.has(file.id)
          ? { ...file, status: "ë¶„ì„ ì¤? }
          : file,
      ),
    );

    try {
      if (isInitialAnalysis) {
        await projectRepository.analyzeProjectRequirements(project.id, {
          documentIds,
        });
        const persisted = await projectRepository.getRequirements(project.id);
        const persistedRequirements = finalRequirements(persisted);
        setRequirements(persistedRequirements);
        setRequirementsLoadError("");
        setFiles((current) =>
          current.map((file) => {
            if (!activeDocumentIds.has(file.id)) return file;
            const documentId = Number(file.id);
            const requirementCount = persistedRequirements.filter(
              (requirement) => requirement.sourceDocumentId === documentId,
            ).length;
            return { ...file, status: "ë¶„ì„ ?„ë£Œ", requirementCount };
          }),
        );
        toast.success("?”êµ¬?¬í•­ ë¶„ì„???„ë£Œ?ˆìŠµ?ˆë‹¤.");
        onAnalysisComplete?.();
      } else {
        const result = await projectRepository.readjustProjectRequirements(
          project.id,
          { documentIds },
        );
        setChangeCandidates(
          Array.isArray(result.changeCandidates)
            ? result.changeCandidates
            : [],
        );
        await loadDocuments();
        toast.success(
          `ë³€ê²??„ë³´ ${result.changeCandidates.length}ê±´ì„ ?ì„±?ˆìŠµ?ˆë‹¤. ?¹ì¸ ?„ì—??ê¸°ì¡´ ?”êµ¬?¬í•­??ë°”ë€Œì? ?ŠìŠµ?ˆë‹¤.`,
        );
      }
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
      setIsReadjusting(false);
    }
  };

  const remove = (id: string) => {
    setFiles((current) => current.filter((file) => file.id !== id));
    setSelectedDocumentIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    toast("?Œì¼??ëª©ë¡?ì„œ ?œê±°?ˆìŠµ?ˆë‹¤.");
  };

  const analysisInProgress = isReadjusting;
  const projectDataLoading =
    isLoadingDocuments || isLoadingRequirements;

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
            ?„ë¡œ?íŠ¸ ë¬¸ì„œ ?…ë¡œ??
          </CardTitle>
          <CardDescription className="text-sm leading-5">
            ë¶„ì„???„ë¡œ?íŠ¸ ë¬¸ì„œë¥??±ë¡?˜ì„¸??
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
                ? "?„ë¡œ?íŠ¸ ë¬¸ì„œë¥??…ë¡œ?œí•˜??ì¤‘ì…?ˆë‹¤."
                : "?Œì¼???Œì–´???“ê±°???´ë¦­?˜ì—¬ ?…ë¡œ??}
            </div>
            <div className="text-xs text-muted-foreground">
              PDF Â· DOCX Â· XLSX Â· PPTX Â· TXT Â· ?Œì¼??ìµœë? 10MB
            </div>
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1.5">
          <CardTitle className="text-xl font-semibold tracking-tight">
            ?…ë¡œ?œëœ ë¬¸ì„œ
          </CardTitle>
          <CardDescription className="text-sm leading-5">
            ë¬¸ì„œë³?ë¶„ì„ ?íƒœ?€ ì¶”ì¶œ ê²°ê³¼ë¥??•ì¸?˜ì„¸??
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-border/80">
            <div className="hidden grid-cols-[minmax(0,2.2fr)_0.7fr_1fr_0.9fr_0.8fr_1.25fr] items-center gap-4 border-b bg-muted/35 px-4 py-3 text-xs font-semibold text-muted-foreground md:grid">
              <div>?Œì¼ëª?/div>
              <div>?©ëŸ‰</div>
              <div>?…ë¡œ??/div>
              <div>ì¶”ì¶œ ?”êµ¬?¬í•­</div>
              <div>?íƒœ</div>
              <div className="text-right">?‘ì—…</div>
            </div>

            <div className="divide-y divide-border/70">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="grid gap-3 px-4 py-4 transition-colors hover:bg-muted/20 md:grid-cols-[minmax(0,2.2fr)_0.7fr_1fr_0.9fr_0.8fr_1.25fr] md:items-center md:gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-rose-200/80 bg-rose-50 text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/35 dark:text-rose-300">
                        <FileText className="size-4" />
                      </span>
                      <span className="min-w-0 break-all text-sm font-medium leading-5 text-foreground">
                        {file.name}
                      </span>
                    </div>
                  </div>

                  <DocumentMeta label="?©ëŸ‰" value={file.size} />
                  <DocumentMeta label="?…ë¡œ?? value={file.uploadedAt} />
                  <DocumentMeta
                    label="ì¶”ì¶œ ?”êµ¬?¬í•­"
                    value={file.requirementCount > 0 ? `${file.requirementCount}ê±? : "?†ìŒ"}
                    emphasize={file.requirementCount > 0}
                  />

                  <div className="flex items-center justify-between gap-3 md:block">
                    <span className="text-xs font-medium text-muted-foreground md:hidden">?íƒœ</span>
                    <Badge
                      variant="outline"
                      className={cn("font-medium", statusClass(file.status))}
                    >
                      {file.status}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-1.5">`r`n                    {mode === "demo" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => toast(`"${file.name}" ?¤ìš´ë¡œë“œ`)}
                          className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
                          aria-label="?¤ìš´ë¡œë“œ"
                          title="?¤ìš´ë¡œë“œ"
                        >
                          <Download className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(file.id)}
                          className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:hover:border-rose-900/60 dark:hover:bg-rose-950/30 dark:hover:text-rose-300"
                          aria-label="?? œ"
                          title="?? œ"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}

              {isLoadingDocuments && (
                <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  ?„ë¡œ?íŠ¸ ë¬¸ì„œë¥?ë¶ˆëŸ¬?¤ëŠ” ì¤‘ì…?ˆë‹¤.
                </div>
              )}

              {!isLoadingDocuments && loadError && (
                <div className="px-4 py-10 text-center text-sm text-destructive">
                  {loadError}
                </div>
              )}

              {!isLoadingDocuments && !loadError && files.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  ?…ë¡œ?œëœ ë¬¸ì„œê°€ ?†ìŠµ?ˆë‹¤.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ClipboardList className="size-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold tracking-tight">
                ?„ì¶œ???”êµ¬?¬í•­
              </CardTitle>
              <CardDescription className="mt-1 text-sm leading-5">
                ë¶„ì„???”êµ¬?¬í•­ê³?ê²€???íƒœë¥??•ì¸?˜ì„¸??
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
              ?”êµ¬?¬í•­??ë¶„ì„?˜ê³  ?ˆìŠµ?ˆë‹¤. ? ì‹œë§?ê¸°ë‹¤??ì£¼ì„¸??
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
              ?„ë¡œ?íŠ¸ ë¬¸ì„œ?€ ?”êµ¬?¬í•­??ë¶ˆëŸ¬?¤ëŠ” ì¤‘ì…?ˆë‹¤.
            </div>
          ) : requirements.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table className={mode === "real" ? "table-fixed" : undefined}>
                <TableHeader>
                  <TableRow className="bg-teal-50/85 hover:bg-teal-50/85 dark:bg-teal-950/30 dark:hover:bg-teal-950/30">
                    <TableHead
                      className={cn("font-semibold text-teal-950 dark:text-teal-100", mode === "real" ? "w-auto" : "min-w-52")}
                    >
                      ?œëª©
                    </TableHead>
                    {mode === "demo" ? (
                      <TableHead className="min-w-72 font-semibold text-teal-950 dark:text-teal-100">?¤ëª…</TableHead>
                    ) : null}
                    <TableHead className="w-32 font-semibold text-teal-950 dark:text-teal-100">? í˜•</TableHead>
                    <TableHead className="w-24 font-semibold text-teal-950 dark:text-teal-100">?íƒœ</TableHead>
                    <TableHead className="w-20 text-right font-semibold text-teal-950 dark:text-teal-100">ê·¼ê±°</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requirements.map((requirement) => {
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
                        className={cn(
                          "font-medium text-foreground",
                          mode === "real" &&
                            "whitespace-normal break-words leading-5",
                        )}
                      >
                        {requirement.title}
                      </TableCell>
                      {mode === "demo" ? (
                        <TableCell className="text-sm text-muted-foreground">
                          {requirement.description}
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {requirement.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-normal",
                            requirementStatusClass(requirement.status),
                          )}
                        >
                          {requirementStatusLabel(requirement.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          disabled={!canOpenEvidence}
                          title="?ë¬¸ ê·¼ê±° ?•ì¸"
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
            </div>
          ) : !requirementsLoadError && loadError ? (
            <Alert variant="destructive">
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          ) : !requirementsLoadError && files.length > 0 ? (
            <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed border-border p-5">
              <div>
                <div className="font-medium text-foreground">
                  ?„ì§ ?„ì¶œ???”êµ¬?¬í•­???†ìŠµ?ˆë‹¤.
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  ?…ë¡œ??ë¬¸ì„œë¥?? íƒ????ë¶„ì„???œì‘?˜ì„¸??
                </p>
              </div>
              <Button
                type="button"
                disabled={analysisInProgress}
                onClick={() =>
                  void readjustRequirements(files.map((file) => file.id))
                }
              >
                {isReadjusting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                )}
                {isReadjusting ? "?”êµ¬?¬í•­ ë¶„ì„ ì¤? : "?„ì²´ ë¬¸ì„œ ë¶„ì„"}
              </Button>
            </div>
          ) : !requirementsLoadError ? (
            <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed border-border p-5">
              <div>
                <div className="font-medium text-foreground">
                  ë¶„ì„???„ë¡œ?íŠ¸ ë¬¸ì„œê°€ ?„ìš”?©ë‹ˆ??
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  ???ì—­?ì„œ ë¬¸ì„œë¥?ë¨¼ì? ?±ë¡?˜ì„¸??
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={isUploading}
                onClick={handlePick}
              >
                <UploadCloud className="size-4" />
                ë¬¸ì„œ ?…ë¡œ??
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <SlidersHorizontal className="size-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold tracking-tight">
                {requirements.length > 0 ? "?”êµ¬?¬í•­ ?¬ì¡°?? : "?”êµ¬?¬í•­ ë¶„ì„"}
              </CardTitle>
              <CardDescription className="mt-1 text-sm leading-5">
                {requirements.length > 0
                  ? "ì¶”ê? ë¬¸ì„œë¡?ë³€ê²??„ë³´ë¥?ë§Œë“  ???¹ì¸???´ìš©ë§?ë°˜ì˜?©ë‹ˆ??"
                  : "ë¶„ì„??ë¬¸ì„œë¥?? íƒ???”êµ¬?¬í•­???ì„±?˜ì„¸??"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
            <div>
              <div className="text-sm font-medium text-foreground">
                ë¶„ì„???¬ìš©??ë¬¸ì„œ
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                ê¸°ì¡´ ?”êµ¬?¬í•­?€ ë°”ë¡œ ë°”ë€Œì? ?Šê³  ë³€ê²??„ë³´ë¡??ì„±?©ë‹ˆ??
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={files.length === 0 || analysisInProgress}
              onClick={toggleAllDocuments}
            >
              {selectedDocumentIds.size === files.length && files.length > 0
                ? "?„ì²´ ?´ì œ"
                : "?„ì²´ ? íƒ"}
            </Button>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            {files.map((file) => (
              <label
                key={file.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                  selectedDocumentIds.has(file.id)
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-background hover:bg-muted/40",
                )}
              >
                <Checkbox
                  checked={selectedDocumentIds.has(file.id)}
                  disabled={analysisInProgress}
                  onCheckedChange={() => toggleDocument(file.id)}
                />
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {file.name}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {file.size} Â· {file.status}
                  </div>
                </div>
              </label>
            ))}

            {!isLoadingDocuments && files.length === 0 && (
              <div className="md:col-span-2 rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                ë¶„ì„???¬ìš©??ë¬¸ì„œë¥?ë¨¼ì? ?…ë¡œ?œí•˜?¸ìš”.
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">
              ? íƒ ë¬¸ì„œ {selectedDocumentIds.size}ê°?
            </span>
            <Button
              type="button"
              disabled={selectedDocumentIds.size === 0 || analysisInProgress}
              onClick={() => void readjustRequirements()}
            >
              {isReadjusting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
              )}
              {isReadjusting
                ? "?”êµ¬?¬í•­ ë¶„ì„ ì¤?
                : requirements.length > 0
                  ? "? íƒ ë¬¸ì„œë¡??”êµ¬?¬í•­ ?¬ì¡°??
                  : "? íƒ ë¬¸ì„œë¡??”êµ¬?¬í•­ ë¶„ì„"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {changeCandidates.length > 0 ? (
        <Card>
          <CardHeader className="space-y-1.5">
            <CardTitle className="text-xl font-semibold tracking-tight">
              AI ?¬ì¡°??ê²€??
            </CardTitle>
            <CardDescription className="text-sm leading-5">
              ë³€ê²??„ë³´ë¥??•ì¸?˜ê³  ?ìš©????ª©???¹ì¸?˜ì„¸??
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RequirementChangeReview
              projectId={project.id}
              candidates={changeCandidates}
              onCandidatesChange={setChangeCandidates}
              onApplied={(result) => {
                setRequirements(finalRequirements(result));
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
        requirementTitle={evidenceRequirement?.title ?? "?”êµ¬?¬í•­ ê·¼ê±°"}
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


