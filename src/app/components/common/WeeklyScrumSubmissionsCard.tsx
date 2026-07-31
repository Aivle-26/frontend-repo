import { useCallback, useEffect, useState } from "react";
import { CalendarCheck2, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Skeleton } from "@/app/components/ui/skeleton";
import {
  projectRepository,
  ApiError,
  type ProjectDocumentUploadItem,
} from "@/app/api/projectRepository";
import { parseTaggedFileName } from "@/app/components/common/weeklyScrumSubmission";

interface WeeklyScrumSubmissionsCardProps {
  projectId: string;
}

export function WeeklyScrumSubmissionsCard({ projectId }: WeeklyScrumSubmissionsCardProps) {
  const [documents, setDocuments] = useState<ProjectDocumentUploadItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await projectRepository.listProjectDocuments(projectId);
      setDocuments(result.documents);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "제출 현황을 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submissions = (documents ?? [])
    .map((d) => ({ doc: d, tag: parseTaggedFileName(d.originalFileName) }))
    .filter((x) => x.tag !== null)
    .sort((a, b) => b.doc.documentId - a.doc.documentId);

  const download = async (doc: ProjectDocumentUploadItem) => {
    try {
      const blob = await projectRepository.getProjectDocumentContent(projectId, doc.documentId);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck2 className="size-4" /> 위클리 스크럼 제출 현황
        </CardTitle>
        <CardDescription>팀원들이 제출한 주간 스크럼 문서예요.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}
        {!loading && error && <p className="text-red-600 text-sm">{error}</p>}
        {!loading && !error && submissions.length === 0 && (
          <p className="py-6 text-center text-muted-foreground text-sm">
            아직 제출된 위클리 스크럼이 없습니다.
          </p>
        )}
        {!loading &&
          !error &&
          submissions.map(({ doc, tag }) => (
            <button
              key={doc.documentId}
              onClick={() => void download(doc)}
              className="flex w-full items-center justify-between gap-2 rounded-md border border-border p-3 text-left hover:bg-muted/50"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-foreground text-sm">
                    {tag?.authorName} · {tag?.week}
                  </p>
                  <p className="truncate text-muted-foreground text-xs">{tag?.originalName}</p>
                </div>
              </div>
              <Download className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
      </CardContent>
    </Card>
  );
}