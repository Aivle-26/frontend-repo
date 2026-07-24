import { useRef, useState } from "react";
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
import type { ProjectSummary, UploadedRfp } from "@/app/data/demoData";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_REQUEST_SIZE = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "xlsx", "pptx", "txt"]);
const FILE_ACCEPT =
  ".pdf,.docx,.xlsx,.pptx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain";

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

export function PmUpload({
  project,
  onDocumentsUploaded,
}: {
  project: ProjectSummary;
  onDocumentsUploaded?: (documents: ProjectDocumentUploadItem[]) => void;
}) {
  const [files, setFiles] = useState<UploadedRfp[]>(() =>
    project.docs.map((d, i) => ({
      id: `doc-${i}`,
      name: d.name,
      size: "—",
      uploadedAt: `${d.type} · 업로드됨`,
      status: "분석 완료",
      requirementCount: project.reqCount,
    })),
  );
  const [dragging, setDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = async (selectedFiles: File[]) => {
    if (isUploading || selectedFiles.length === 0) return;

    const invalidType = selectedFiles.find((file) => {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      return !ALLOWED_EXTENSIONS.has(extension);
    });
    if (invalidType) {
      toast.error(`"${invalidType.name}"은 지원하지 않는 파일 형식입니다.`);
      return;
    }

    const oversized = selectedFiles.find((file) => file.size > MAX_FILE_SIZE);
    if (oversized) {
      toast.error(`"${oversized.name}"은 파일당 최대 10MB를 초과합니다.`);
      return;
    }

    const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_REQUEST_SIZE) {
      toast.error("한 번에 업로드할 수 있는 전체 용량은 최대 50MB입니다.");
      return;
    }

    setIsUploading(true);
    try {
      const response = await projectRepository.uploadProjectDocuments(
        project.id,
        selectedFiles,
      );
      const now = new Date().toLocaleString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const uploaded: UploadedRfp[] = response.documents.map((document) => ({
        id: String(document.documentId),
        name: document.originalFileName,
        size: formatFileSize(document.fileSize),
        uploadedAt: `방금 · ${now}`,
        status: "대기",
        requirementCount: 0,
      }));

      setFiles((prev) => [...uploaded, ...prev]);
      onDocumentsUploaded?.(response.documents);
      toast.success(`${uploaded.length}개 프로젝트 원본 문서를 업로드했습니다.`);
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
    await projectRepository.reanalyzeRfp();
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: "분석 중" } : f)),
    );
    toast("AI 재분석을 시작했습니다.");
    setTimeout(() => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, status: "분석 완료" } : f,
        ),
      );
    }, 1200);
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
            accept={FILE_ACCEPT}
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
                        onClick={() => reanalyze(f.id)}
                        className="rounded p-1 hover:bg-muted hover:text-foreground"
                        aria-label="다시 분석"
                        title="다시 분석"
                      >
                        <RefreshCw className="size-4" />
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
              {files.length === 0 && (
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
