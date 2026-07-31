import { useCallback, useEffect, useRef, useState } from "react";
import { Send, UploadCloud, Download, FileText, AlertCircle, CheckCircle2, X } from "lucide-react";
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
import { Skeleton } from "@/app/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { type ProjectSummary } from "@/app/data/demoData";
import {
  projectRepository,
  ApiError,
  type ProjectDocumentUploadItem,
} from "@/app/api/projectRepository";
import {
  buildTaggedFileName,
  parseTaggedFileName,
  weekOfDate,
} from "@/app/components/common/weeklyScrumSubmission";

/**
 * 개인 위클리 스크럼 제출 화면.
 *
 * 산출물 문서 저장은 프로젝트 문서함과 동일한 실제 API(uploadProjectDocuments /
 * listProjectDocuments / getProjectDocumentContent)를 그대로 재사용한다. 분류
 * 방식은 weeklyScrumSubmission.ts 참고.
 */

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatFileSize(bytes: number) {
  if (!bytes) return "-";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)}KB`;
  return `${(kb / 1024).toFixed(1)}MB`;
}

interface StaffSubmitProps {
  project: ProjectSummary | null;
  currentUserName: string;
}

export function StaffSubmit({ project, currentUserName }: StaffSubmitProps) {
  const today = todayValue();
  const [submitDate, setSubmitDate] = useState(today);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<ProjectDocumentUploadItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!project) return;
    setLoading(true);
    setError("");
    try {
      const result = await projectRepository.listProjectDocuments(project.id);
      setDocuments(result.documents);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "제출 현황을 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, [project]);

  useEffect(() => {
    void load();
  }, [load]);

  const mySubmissions = (documents ?? [])
    .map((d) => ({ doc: d, tag: parseTaggedFileName(d.originalFileName) }))
    .filter((x) => x.tag && x.tag.authorName === currentUserName)
    .sort((a, b) => b.doc.documentId - a.doc.documentId);

  const submit = async () => {
    if (!project) {
      toast.error("프로젝트 정보를 불러오지 못했습니다.");
      return;
    }
    if (!file) {
      toast.error("제출할 파일을 선택하세요.");
      return;
    }
    if (!submitDate) {
      toast.error("제출일을 선택하세요.");
      return;
    }
    if (submitDate < today) {
      toast.error("제출일은 오늘 이후 날짜만 선택할 수 있어요.");
      return;
    }
    setUploading(true);
    try {
      const taggedName = buildTaggedFileName(submitDate, currentUserName || "직원", file.name);
      const taggedFile = new File([file], taggedName, { type: file.type });
      await projectRepository.uploadProjectDocuments(project.id, [taggedFile]);
      toast.success(`${submitDate} 위클리 스크럼을 제출했습니다.`);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      await load();
    } catch (caught) {
      toast.error(
        caught instanceof ApiError ? caught.message : "제출에 실패했습니다.",
      );
    } finally {
      setUploading(false);
    }
  };

  const download = async (doc: ProjectDocumentUploadItem) => {
    if (!project) return;
    try {
      const blob = await projectRepository.getProjectDocumentContent(
        project.id,
        doc.documentId,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = parseTaggedFileName(doc.originalFileName)?.originalName ?? doc.originalFileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("다운로드에 실패했습니다.");
    }
  };

  if (!project) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <AlertCircle className="size-6 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">
          프로젝트 정보를 불러오는 중이거나, 접근 가능한 프로젝트가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="size-4" /> 위클리 스크럼 제출
          </CardTitle>
          <CardDescription>
            {project.name} · 이번 주 진행 상황을 정리해 파일로 제출하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs space-y-2">
            <label className="text-sm text-foreground" htmlFor="scrum-date">
              제출일
            </label>
            <input
              id="scrum-date"
              type="date"
              min={today}
              value={submitDate}
              onChange={(e) => setSubmitDate(e.target.value)}
              className="flex h-9 w-full rounded-md border border-border bg-transparent px-3 py-1 text-sm outline-none"
            />
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="flex w-full items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                <div className="min-w-0">
                  <p className="truncate text-emerald-900 text-sm">{file.name}</p>
                  <p className="text-emerald-700/80 text-xs">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="shrink-0 rounded-md p-1.5 text-emerald-700 hover:bg-emerald-100"
                title="선택 취소"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 py-8 text-center hover:bg-muted"
            >
              <UploadCloud className="size-6 text-muted-foreground" />
              <span className="text-foreground text-sm">파일을 클릭해 선택하세요</span>
              <span className="text-muted-foreground text-xs">
                PDF · DOCX · PPTX · XLSX · TXT
              </span>
            </button>
          )}
          {file && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-primary text-xs hover:underline"
            >
              다른 파일로 바꾸기
            </button>
          )}

          <Button onClick={() => void submit()} disabled={uploading}>
            {uploading ? "제출 중…" : "위클리 스크럼 제출"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>내 제출 현황</CardTitle>
          <CardDescription>
            내가 제출한 위클리 스크럼 목록이에요. 파일명을 누르면 다운로드돼요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {!loading && error && <p className="text-red-600 text-sm">{error}</p>}

          {!loading && !error && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>파일명</TableHead>
                  <TableHead>프로젝트</TableHead>
                  <TableHead>제출일</TableHead>
                  <TableHead>주차</TableHead>
                  <TableHead>상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mySubmissions.length === 0 &&
                  DUMMY_SUBMISSIONS.map((d) => (
                    <TableRow key={d.id} className="opacity-70" title="아직 실제 제출 데이터가 없어 예시로 보여드려요.">
                      <TableCell className="flex items-center gap-2">
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        {d.fileName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{project.name}</TableCell>
                      <TableCell className="text-muted-foreground">{d.date}</TableCell>
                      <TableCell className="text-muted-foreground">{weekOfDate(d.date)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {d.status} · 예시
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}

                {mySubmissions.map(({ doc, tag }) => (
                  <TableRow key={doc.documentId}>
                    <TableCell>
                      <button
                        onClick={() => void download(doc)}
                        className="flex items-center gap-2 text-foreground hover:underline"
                      >
                        <Download className="size-4 shrink-0 text-muted-foreground" />
                        {tag?.originalName}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{project.name}</TableCell>
                    <TableCell className="text-muted-foreground">{tag?.week}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {tag ? weekOfDate(tag.week) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {doc.status || "확인 대기"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}

                {mySubmissions.length === 0 && DUMMY_SUBMISSIONS.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      아직 제출한 위클리 스크럼이 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** 실제 제출 데이터가 아직 없을 때 화면 확인용으로 보여주는 예시 데이터 (다운로드 불가). */
const DUMMY_SUBMISSIONS = [
  { id: "d1", date: "2026-07-11", fileName: "위클리스크럼_0711.docx", status: "확인 완료" },
  { id: "d2", date: "2026-07-18", fileName: "위클리스크럼_0718.docx", status: "확인 완료" },
  { id: "d3", date: "2026-07-25", fileName: "위클리스크럼_0725.docx", status: "확인 대기" },
];