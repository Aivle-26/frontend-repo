import { useCallback, useEffect, useRef, useState } from "react";
import {
  UploadCloud,
  RefreshCw,
  Download,
  Trash2,
  FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
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
} from "@/app/api/projectRepository";
import {
  PROJECT_DOCUMENT_ACCEPT,
  validateProjectDocumentFiles,
} from "@/app/components/pm/projectDocumentUpload";
import type { ProjectSummary, UploadedRfp } from "@/app/data/demoData";

function statusClass(s: UploadedRfp["status"]) {
  if (s === "분석 완료") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "분석 중") return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
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

export function PmUpload({
  project,
  onDocumentsUploaded,
  onAnalysisComplete,
}: {
  project: ProjectSummary;
  onDocumentsUploaded?: (documents: ProjectDocumentUploadItem[]) => void;
  onAnalysisComplete?: () => void;
}) {
  const [files, setFiles] = useState<UploadedRfp[]>([]);
  const [dragging, setDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [analyzingDocumentId, setAnalyzingDocumentId] = useState<string | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    setIsLoadingDocuments(true);
    setLoadError("");
    try {
      const response = await projectRepository.listProjectDocuments(project.id);
      setFiles(response.documents.map(toUploadRow));
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
      toast.success(`${response.documents.length}개 프로젝트 원본 문서를 업로드했습니다.`);
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

  const onSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? []);
    e.target.value = "";
    void addFiles(selectedFiles);
  };

  const reanalyze = async (id: string) => {
    if (analyzingDocumentId) return;
    const documentId = Number(id);
    if (!Number.isSafeInteger(documentId) || documentId <= 0) {
      toast.error("분석할 프로젝트 문서를 확인해 주세요.");
      return;
    }

    const previous = files.find((file) => file.id === id);
    setAnalyzingDocumentId(id);
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: "분석 중" } : f)),
    );
    try {
      await projectRepository.analyzeProjectRequirements(project.id, {
        documentIds: [documentId],
      });
      const persisted = await projectRepository.getRequirements(project.id);
      const requirementCount = persisted.finalRequirements.filter(
        (requirement) => requirement.sourceDocumentId === documentId,
      ).length;
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, status: "분석 완료", requirementCount }
            : f,
        ),
      );
      toast.success("요구사항 분석을 완료했습니다.");
      onAnalysisComplete?.();
    } catch (error) {
      setFiles((prev) =>
        prev.map((file) =>
          file.id === id && previous
            ? { ...file, status: previous.status }
            : file,
        ),
      );
      toast.error(analysisErrorMessage(error));
    } finally {
      setAnalyzingDocumentId(null);
    }
  };

  const remove = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    toast("파일을 목록에서 제거했습니다.");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>프로젝트 원본 문서 업로드</CardTitle>
          <CardDescription>
            프로젝트에 사용할 원본 문서를 안전하게 등록합니다.
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
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!isUploading) {
                void addFiles(Array.from(e.dataTransfer.files));
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
            <div className="text-muted-foreground text-xs">
              PDF · DOCX · XLSX · PPTX · TXT · 파일당 최대 10MB
            </div>
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>업로드된 공고문</CardTitle>
          <CardDescription>업로드한 RFP 목록과 분석 상태입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
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
              {files.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 items-center justify-center rounded-md bg-red-50 text-red-600">
                        <FileText className="size-4" />
                      </span>
                      <span className="text-foreground text-sm">{f.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{f.size}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{f.uploadedAt}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {f.requirementCount > 0 ? `${f.requirementCount}건` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("font-normal", statusClass(f.status))}>
                      {f.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1 text-muted-foreground">
                      <button
                        disabled={analyzingDocumentId !== null}
                        onClick={() => void reanalyze(f.id)}
                        className="rounded p-1 hover:bg-muted hover:text-foreground"
                        aria-label="다시 분석"
                        title="다시 분석"
                      >
                        {analyzingDocumentId === f.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <RefreshCw className="size-4" />
                        )}
                      </button>
                      <button
                        onClick={() => toast(`"${f.name}" 다운로드`)}
                        className="rounded p-1 hover:bg-muted hover:text-foreground"
                        aria-label="다운로드"
                        title="다운로드"
                      >
                        <Download className="size-4" />
                      </button>
                      <button
                        onClick={() => remove(f.id)}
                        className="rounded p-1 hover:bg-muted hover:text-destructive"
                        aria-label="삭제"
                        title="삭제"
                      >
                        <Trash2 className="size-4" />
                      </button>
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
                    업로드된 공고문이 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
