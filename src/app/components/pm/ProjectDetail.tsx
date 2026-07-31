import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  FileSpreadsheet,
  FileText,
  FileType2,
  Loader2,
  Presentation,
  Sparkles,
  TrendingUp,
  UploadCloud,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
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
import { DocPicker } from "@/app/components/pm/DocPicker";
import {
  ApiError,
  projectRepository,
  type ProjectDocumentUploadItem,
  type RequirementsResult,
} from "@/app/api/projectRepository";
import type { PendingProjectDocument } from "@/app/components/pm/projectDocumentUpload";
import type { ProjectDoc, ProjectStatus, ProjectSummary } from "@/app/projects/projectTypes";

function statusClass(s: ProjectStatus) {
  const map: Record<ProjectStatus, string> = {
    분석중: "bg-muted text-muted-foreground",
    준비: "bg-amber-50 text-amber-700 border-amber-200",
    승인대기: "bg-orange-50 text-orange-700 border-orange-200",
    진행중: "bg-blue-50 text-blue-700 border-blue-200",
    완료: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  return map[s];
}

type ProjectDetailMenu = "requirements" | "risk" | "assign";

interface ProjectDetailProps {
  project: ProjectSummary;
  onBack: () => void;
  onUpdateDocs: (docs: ProjectDoc[]) => void;
  onNavigate: (menu: ProjectDetailMenu) => void;
}

function getRequirementCount(result: RequirementsResult | null) {
  if (!result) return null;
  const finalCount = Array.isArray(result.finalRequirements)
    ? result.finalRequirements.length
    : 0;
  const suggestionCount = Array.isArray(result.aiSuggestions)
    ? result.aiSuggestions.length
    : 0;
  return finalCount > 0 ? finalCount : suggestionCount;
}

function getDaysRemaining(dueDate: string) {
  if (!dueDate || dueDate === "-") return null;
  const due = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
}

function formatRemainingDays(days: number | null) {
  if (days === null) return "마감일 정보 없음";
  if (days > 0) return `D-${days}`;
  if (days === 0) return "D-Day";
  return `마감 ${Math.abs(days)}일 경과`;
}

function fileExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.trim().toUpperCase();
  return extension && extension !== fileName.toUpperCase() ? extension : "FILE";
}

function documentIcon(fileName: string) {
  const extension = fileExtension(fileName);
  if (extension === "XLSX" || extension === "XLS" || extension === "CSV") {
    return <FileSpreadsheet className="size-4" />;
  }
  if (extension === "PPTX" || extension === "PPT") {
    return <Presentation className="size-4" />;
  }
  if (extension === "DOCX" || extension === "DOC") {
    return <FileType2 className="size-4" />;
  }
  return <FileText className="size-4" />;
}

function documentIconClass(fileName: string) {
  const extension = fileExtension(fileName);
  if (extension === "PDF") return "bg-red-50 text-red-600";
  if (["XLSX", "XLS", "CSV"].includes(extension)) return "bg-emerald-50 text-emerald-700";
  if (["PPTX", "PPT"].includes(extension)) return "bg-orange-50 text-orange-700";
  if (["DOCX", "DOC"].includes(extension)) return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-600";
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size < 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectDetail({ project: p, onBack, onNavigate }: ProjectDetailProps) {
  const [docOpen, setDocOpen] = useState(false);
  const [docDraft, setDocDraft] = useState<PendingProjectDocument[]>([]);
  const [docError, setDocError] = useState("");
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);
  const [documents, setDocuments] = useState<ProjectDocumentUploadItem[]>([]);
  const [requirements, setRequirements] = useState<RequirementsResult | null>(null);
  const [isLoadingProjectData, setIsLoadingProjectData] = useState(true);
  const [projectDataError, setProjectDataError] = useState("");

  const loadProjectData = useCallback(async () => {
    setIsLoadingProjectData(true);
    setProjectDataError("");
    const [documentResult, requirementResult] = await Promise.allSettled([
      projectRepository.listProjectDocuments(p.id),
      projectRepository.getRequirements(p.id),
    ]);

    if (documentResult.status === "fulfilled") {
      setDocuments(Array.isArray(documentResult.value.documents) ? documentResult.value.documents : []);
    } else {
      setDocuments([]);
    }

    if (requirementResult.status === "fulfilled") {
      setRequirements(requirementResult.value);
    } else {
      setRequirements(null);
    }

    if (documentResult.status === "rejected" || requirementResult.status === "rejected") {
      setProjectDataError("일부 프로젝트 정보를 불러오지 못했습니다.");
    }
    setIsLoadingProjectData(false);
  }, [p.id]);

  useEffect(() => {
    void loadProjectData();
  }, [loadProjectData]);

  const requirementCount = getRequirementCount(requirements);
  const remainingDays = useMemo(() => getDaysRemaining(p.dueDate), [p.dueDate]);

  const uploadDocuments = async () => {
    if (isUploadingDocuments) return;
    if (docDraft.length === 0) {
      setDocError("추가할 문서를 선택하세요.");
      return;
    }

    setIsUploadingDocuments(true);
    setDocError("");
    try {
      await projectRepository.uploadProjectDocuments(
        p.id,
        docDraft.map((document) => document.file),
      );
      await loadProjectData();
      setDocDraft([]);
      setDocOpen(false);
      toast.success("문서를 업로드했습니다.");
    } catch (caught) {
      const message = caught instanceof ApiError && caught.message.trim()
        ? caught.message
        : "문서 업로드에 실패했습니다. 다시 시도해 주세요.";
      setDocError(message);
      toast.error(message);
    } finally {
      setIsUploadingDocuments(false);
    }
  };

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
        <ArrowLeft className="size-4" /> 프로젝트 목록
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="leading-tight">
          <div className="flex items-center gap-2">
            <h2 className="text-foreground text-lg">{p.name}</h2>
            <Badge variant="outline" className={cn("font-normal", statusClass(p.status))}>
              {p.status}
            </Badge>
          </div>
          <div className="text-muted-foreground text-sm mt-0.5">
            {p.client} · 업데이트 {p.updatedAt}
          </div>
        </div>
      </div>

      {projectDataError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {projectDataError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">전체 진행률</span>
              <TrendingUp className="size-4 text-muted-foreground" />
            </div>
            {p.status === "완료" ? (
              <>
                <div className="mt-2 text-foreground text-2xl"><CountUp value="100%" /></div>
                <Progress value={100} className="mt-3" />
              </>
            ) : (
              <div className="mt-2 text-sm text-muted-foreground">진행률 데이터가 제공되지 않았습니다.</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">마감일</span>
              <CalendarClock className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-foreground text-2xl">{p.dueDate}</div>
            <div className={cn("mt-1 text-sm", remainingDays !== null && remainingDays < 0 ? "text-destructive" : "text-muted-foreground")}>{formatRemainingDays(remainingDays)}</div>
          </CardContent>
        </Card>
        <KpiCard icon={<AlertTriangle className="size-4 text-destructive" />} label="고위험 항목" value="연동 데이터 없음" raw />
        <KpiCard
          icon={<FileText className="size-4 text-muted-foreground" />}
          label="요구사항"
          value={isLoadingProjectData ? "조회 중" : requirementCount === null ? "조회 실패" : `${requirementCount}건`}
          raw
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="size-4" /> AI 분석 요약</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <SummaryRow
              text={isLoadingProjectData
                ? "요구사항 정보를 조회하고 있습니다."
                : requirementCount === null
                  ? "요구사항 정보를 불러오지 못했습니다."
                  : requirementCount === 0
                    ? "아직 요구사항이 추출되지 않았습니다."
                    : `실제 추출된 요구사항은 ${requirementCount}건입니다.`}
              buttonLabel="요구사항 바로가기"
              icon={<FileText className="size-3.5" />}
              onClick={() => onNavigate("requirements")}
            />
            <SummaryRow
              text="업무 배정 정보는 업무 배정 화면에서 확인할 수 있습니다."
              buttonLabel="업무 배정 바로가기"
              icon={<Users className="size-3.5" />}
              onClick={() => onNavigate("assign")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-destructive" /> 상위 리스크</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">이 프로젝트에 연결된 리스크 정보가 있을 때 표시됩니다.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => onNavigate("risk")}>
              리스크 관리 바로가기 <ArrowRight className="size-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2"><FileText className="size-4" /> 문서 {documents.length}건</CardTitle>
            <Button variant="outline" size="sm" onClick={() => { setDocDraft([]); setDocError(""); setDocOpen(true); }}>
              <UploadCloud className="size-3.5" /> 문서 업로드
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingProjectData ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> 문서를 불러오는 중입니다.</div>
          ) : documents.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {documents.map((document) => (
                <div key={document.documentId} className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", documentIconClass(document.originalFileName))}>
                    {documentIcon(document.originalFileName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{document.originalFileName}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{formatFileSize(document.fileSize)}</div>
                  </div>
                  <Badge variant="secondary" className="font-normal">{fileExtension(document.originalFileName)}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">업로드된 문서가 없습니다.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={docOpen} onOpenChange={(open) => { if (!isUploadingDocuments) setDocOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>문서 업로드</DialogTitle>
            <DialogDescription>{p.name} 프로젝트에 실제 문서를 업로드합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <DocPicker documents={docDraft} onChange={setDocDraft} onError={setDocError} disabled={isUploadingDocuments} />
            {docError && <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>{docError}</span></div>}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={isUploadingDocuments} onClick={() => setDocOpen(false)}>취소</Button>
            <Button disabled={isUploadingDocuments} onClick={() => void uploadDocuments()}>
              {isUploadingDocuments ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
              {isUploadingDocuments ? "업로드 중" : "문서 업로드"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryRow({ text, buttonLabel, icon, onClick }: { text: string; buttonLabel: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" /><span className="text-foreground text-sm leading-6">{text}</span></div>
      <Button type="button" variant="outline" size="sm" className="w-full justify-between gap-2 self-start sm:w-[180px] sm:min-w-[180px] sm:self-auto" onClick={onClick}>
        {icon}{buttonLabel}<ArrowRight className="size-3.5" />
      </Button>
    </div>
  );
}

function KpiCard({ icon, label, value, raw }: { icon: React.ReactNode; label: string; value: string; raw?: boolean }) {
  return (
    <Card><CardContent className="pt-5"><div className="flex items-center justify-between"><span className="text-muted-foreground text-sm">{label}</span><span>{icon}</span></div><div className="mt-2 text-foreground text-2xl">{raw ? value : <CountUp value={value} />}</div></CardContent></Card>
  );
}
