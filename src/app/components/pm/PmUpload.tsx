import { useCallback, useEffect, useRef, useState } from "react";
import {
  ClipboardList,
  Download,
  FileText,
  Loader2,
  RefreshCw,
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
  type RequirementResponse,
  type RequirementsResult,
} from "@/app/api/projectRepository";
import {
  PROJECT_DOCUMENT_ACCEPT,
  validateProjectDocumentFiles,
} from "@/app/components/pm/projectDocumentUpload";
import type { UploadedRfp } from "@/app/data/demoData";
import type { ProjectSummary } from "@/app/projects/projectTypes";

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

function requirementStatusLabel(status: RequirementResponse["status"]) {
  if (status === "CONFIRMED") return "확정";
  if (status === "REJECTED") return "반려";
  return "검토 전";
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
  const [analyzingDocumentId, setAnalyzingDocumentId] = useState<string | null>(
    null,
  );
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isReadjusting, setIsReadjusting] = useState(false);
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
          : "프로젝트 문서 목록을 불러오지 못했습니다.",
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
              : "요구사항을 불러오지 못했습니다.",
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

  const reanalyze = async (id: string) => {
    if (analyzingDocumentId || isReadjusting) return;

    const documentId = Number(id);
    if (!Number.isSafeInteger(documentId) || documentId <= 0) {
      toast.error("분석할 프로젝트 문서를 확인해 주세요.");
      return;
    }

    const previous = files.find((file) => file.id === id);
    setAnalysisError("");
    setAnalyzingDocumentId(id);
    setFiles((current) =>
      current.map((file) =>
        file.id === id ? { ...file, status: "분석 중" } : file,
      ),
    );

    try {
      await projectRepository.analyzeProjectRequirements(project.id, {
        documentIds: [documentId],
      });
      const persisted = await projectRepository.getRequirements(project.id);
      const persistedRequirements = finalRequirements(persisted);
      setRequirements(persistedRequirements);
      setRequirementsLoadError("");
      const requirementCount = persistedRequirements.filter(
        (requirement) => requirement.sourceDocumentId === documentId,
      ).length;

      setFiles((current) =>
        current.map((file) =>
          file.id === id
            ? { ...file, status: "분석 완료", requirementCount }
            : file,
        ),
      );
      toast.success("요구사항 분석을 완료했습니다.");
      onAnalysisComplete?.();
    } catch (error) {
      setFiles((current) =>
        current.map((file) =>
          file.id === id && previous
            ? { ...file, status: previous.status }
            : file,
        ),
      );
      const message = analysisErrorMessage(error);
      setAnalysisError(message);
      toast.error(message);
    } finally {
      setAnalyzingDocumentId(null);
    }
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
    if (isReadjusting || analyzingDocumentId) return;

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
    setAnalysisError("");
    setIsReadjusting(true);
    setFiles((current) =>
      current.map((file) =>
        activeDocumentIds.has(file.id)
          ? { ...file, status: "분석 중" }
          : file,
      ),
    );

    try {
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
          return { ...file, status: "분석 완료", requirementCount };
        }),
      );

      toast.success(
        isInitialAnalysis
          ? "요구사항 분석을 완료했습니다."
          : `선택 문서 ${documentIds.length}개를 반영해 요구사항을 재조정했습니다.`,
      );
      setSelectedDocumentIds(new Set());
      onAnalysisComplete?.();
    } catch (error) {
      await loadDocuments();
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
    toast("파일을 목록에서 제거했습니다.");
  };

  const analysisInProgress =
    analyzingDocumentId !== null || isReadjusting;
  const projectDataLoading =
    isLoadingDocuments || isLoadingRequirements;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>프로젝트 문서 업로드</CardTitle>
          <CardDescription>
            프로젝트 계획과 요구사항 조정에 사용할 문서를 안전하게 등록합니다.
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
          <CardTitle>업로드된 문서</CardTitle>
          <CardDescription>
            업로드한 프로젝트 문서 목록과 요구사항 분석 상태입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>파일명</TableHead>
                  <TableHead className="w-24">용량</TableHead>
                  <TableHead className="w-40">업로드</TableHead>
                  <TableHead className="w-24">추출 요구사항</TableHead>
                  <TableHead className="w-24">상태</TableHead>
                  <TableHead className="w-32 text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 items-center justify-center rounded-md bg-red-50 text-red-600">
                        <FileText className="size-4" />
                      </span>
                      <span className="text-sm text-foreground">{file.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {file.size}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {file.uploadedAt}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {file.requirementCount > 0 ? `${file.requirementCount}건` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("font-normal", statusClass(file.status))}
                    >
                      {file.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1 text-muted-foreground">
                      <button
                        disabled={analyzingDocumentId !== null || isReadjusting}
                        onClick={() => void reanalyze(file.id)}
                        className="rounded p-1 hover:bg-muted hover:text-foreground disabled:opacity-50"
                        aria-label="다시 분석"
                        title="다시 분석"
                      >
                        {analyzingDocumentId === file.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <RefreshCw className="size-4" />
                        )}
                      </button>
                      {mode === "demo" ? (
                        <>
                          <button
                            onClick={() => toast(`"${file.name}" 다운로드`)}
                            className="rounded p-1 hover:bg-muted hover:text-foreground"
                            aria-label="다운로드"
                            title="다운로드"
                          >
                            <Download className="size-4" />
                          </button>
                          <button
                            onClick={() => remove(file.id)}
                            className="rounded p-1 hover:bg-muted hover:text-destructive"
                            aria-label="삭제"
                            title="삭제"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {isLoadingDocuments && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      프로젝트 문서를 불러오는 중입니다.
                    </span>
                  </TableCell>
                </TableRow>
              )}

              {!isLoadingDocuments && loadError && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-destructive">
                    {loadError}
                  </TableCell>
                </TableRow>
              )}

              {!isLoadingDocuments && !loadError && files.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    업로드된 문서가 없습니다.
                  </TableCell>
                </TableRow>
              )}
              </TableBody>
            </Table>
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
              <CardTitle>도출된 요구사항</CardTitle>
              <CardDescription className="mt-1">
                서버에 저장된 요구사항 제목·설명·검토 상태를 표시합니다.
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
              요구사항을 분석 중입니다. 완료될 때까지 다시 실행할 수 없습니다.
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
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-52">제목</TableHead>
                    <TableHead className="min-w-72">설명</TableHead>
                    <TableHead className="w-32">유형</TableHead>
                    <TableHead className="w-24">상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requirements.map((requirement) => (
                    <TableRow key={requirement.requirementId}>
                      <TableCell className="font-medium text-foreground">
                        {requirement.title}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {requirement.description}
                      </TableCell>
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
                    </TableRow>
                  ))}
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
                  아직 도출된 요구사항이 없습니다.
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  업로드한 문서를 선택하고 요구사항 분석을 실행해 주세요.
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
                  <RefreshCw className="size-4" />
                )}
                {isReadjusting ? "요구사항 분석 중" : "전체 문서 분석"}
              </Button>
            </div>
          ) : !requirementsLoadError ? (
            <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed border-border p-5">
              <div>
                <div className="font-medium text-foreground">
                  요구사항을 분석하려면 먼저 프로젝트 문서를 업로드해 주세요.
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  위 업로드 영역에서 분석할 문서를 등록할 수 있습니다.
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

      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <SlidersHorizontal className="size-5" />
            </div>
            <div>
              <CardTitle>
                {requirements.length > 0 ? "요구사항 재조정" : "요구사항 분석"}
              </CardTitle>
              <CardDescription className="mt-1">
                {requirements.length > 0
                  ? "프로젝트 계획 조정 과정에서 추가 문서를 선택해 기존 요구사항을 다시 분석하고 반영합니다."
                  : "업로드한 문서를 선택해 프로젝트 요구사항을 분석합니다."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-3">
            <div>
              <div className="text-sm font-medium text-foreground">
                재조정에 반영할 문서 선택
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                선택한 모든 문서를 한 번에 분석해 요구사항을 갱신합니다.
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
                ? "전체 해제"
                : "전체 선택"}
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
                    {file.size} · {file.status}
                  </div>
                </div>
              </label>
            ))}

            {!isLoadingDocuments && files.length === 0 && (
              <div className="md:col-span-2 rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                먼저 재조정에 사용할 문서를 업로드하세요.
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">
              선택 문서 {selectedDocumentIds.size}개
            </span>
            <Button
              type="button"
              disabled={selectedDocumentIds.size === 0 || analysisInProgress}
              onClick={() => void readjustRequirements()}
            >
              {isReadjusting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {isReadjusting
                ? "요구사항 분석 중"
                : requirements.length > 0
                  ? "선택 문서로 요구사항 재조정"
                  : "선택 문서로 요구사항 분석"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
