import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  TrendingUp,
  CalendarClock,
  AlertTriangle,
  FileText,
  Sparkles,
  ListTodo,
  Pencil,
  Users,
  Loader2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
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
import { WeeklyScrumSubmissionsCard } from "@/app/components/common/WeeklyScrumSubmissionsCard";
import {
  ApiError,
  projectRepository,
} from "@/app/api/projectRepository";
import { demoRepository } from "@/app/data/demoRepository";
import {
  mapUploadedProjectDocuments,
  type PendingProjectDocument,
} from "@/app/components/pm/projectDocumentUpload";
import type {
  ProjectDoc,
  ProjectStatus,
  ProjectSummary,
} from "@/app/data/demoData";

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

interface SummaryAction {
  menu: ProjectDetailMenu;
  label: string;
  icon: typeof FileText;
}

function getSummaryAction(line: string): SummaryAction | null {
  if (line.includes("요구사항") || line.includes("추출")) {
    return {
      menu: "requirements",
      label: "요구사항 바로가기",
      icon: FileText,
    };
  }

  if (line.includes("고위험") || line.includes("리스크") || line.includes("위험")) {
    return {
      menu: "risk",
      label: "리스크 관리 바로가기",
      icon: AlertTriangle,
    };
  }

  if (line.includes("업무") || line.includes("분해") || line.includes("배정")) {
    return {
      menu: "assign",
      label: "업무 배정 바로가기",
      icon: Users,
    };
  }

  return null;
}

export function ProjectDetail({
  project: p,
  onBack,
  onUpdateDocs,
  onNavigate,
}: ProjectDetailProps) {
  const { aiSummary, risks } = demoRepository.getPmDashboard();
  const [docOpen, setDocOpen] = useState(false);
  const [docDraft, setDocDraft] = useState<PendingProjectDocument[]>([]);
  const [docError, setDocError] = useState("");
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);

  const openDocumentUpload = () => {
    setDocDraft([]);
    setDocError("");
    setDocOpen(true);
  };

  const uploadDocuments = async () => {
    if (isUploadingDocuments) return;
    if (docDraft.length === 0) {
      setDocError("추가할 문서를 선택하세요.");
      return;
    }

    setIsUploadingDocuments(true);
    setDocError("");

    try {
      const response = await projectRepository.uploadProjectDocuments(
        p.id,
        docDraft.map((document) => document.file),
      );
      const uploadedDocuments = mapUploadedProjectDocuments(
        response.documents,
        docDraft,
      );
      onUpdateDocs([...p.docs, ...uploadedDocuments]);
      setDocDraft([]);
      setDocOpen(false);
      toast.success("문서를 업로드했습니다.");
    } catch (caught) {
      const message =
        caught instanceof ApiError && caught.message.trim()
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

      {/* 프로젝트 헤더 */}
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

      {/* KPI (프로젝트 실제 데이터) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">전체 진행률</span>
              <TrendingUp className="size-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-foreground text-2xl">
              <CountUp value={`${p.progress}%`} />
            </div>
            <Progress value={p.progress} className="mt-3" />
          </CardContent>
        </Card>
        <KpiCard
          icon={<CalendarClock className="size-4 text-muted-foreground" />}
          label="마감일"
          value={p.dueDate}
          raw
        />
        <KpiCard
          icon={<AlertTriangle className="size-4 text-destructive" />}
          label="고위험 항목"
          value={`${p.riskCount}건`}
        />
        <KpiCard
          icon={<FileText className="size-4 text-muted-foreground" />}
          label="요구사항"
          value={`${p.reqCount}건`}
        />
      </div>

      <WeeklyScrumSubmissionsCard projectId={p.id} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* AI 분석 요약 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4" /> AI 분석 요약
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {aiSummary.map((line) => {
                const action = getSummaryAction(line);
                const ActionIcon = action?.icon;

                return (
                  <li
                    key={line}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                      <span className="text-foreground text-sm leading-6">
                        {line}
                      </span>
                    </div>

                    {action && ActionIcon && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full justify-between gap-2 self-start sm:w-[170px] sm:min-w-[170px] sm:self-auto"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onNavigate(action.menu);
                        }}
                      >
                        <ActionIcon className="size-3.5" />
                        {action.label}
                        <ArrowRight className="size-3.5" />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {/* 상위 리스크 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" /> 상위 리스크
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {risks.map((risk) => (
              <div key={risk.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-foreground text-sm">{risk.title}</span>
                  <Badge variant={risk.level === "높음" ? "destructive" : "secondary"}>
                    {risk.level}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm mt-1">{risk.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 초기 문서 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ListTodo className="size-4" /> 초기 문서 {p.docs.length}건
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={openDocumentUpload}
            >
              <Pencil className="size-3.5" /> 문서 관리
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {p.docs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {p.docs.map((d, i) => (
                <div
                  key={`${d.name}-${i}`}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
                >
                  <span className="flex size-8 items-center justify-center rounded-md bg-red-50 text-red-600">
                    <FileText className="size-4" />
                  </span>
                  <span className="flex-1 truncate text-foreground text-sm">{d.name}</span>
                  <Badge variant="secondary" className="font-normal">
                    {d.type}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">업로드된 문서가 없습니다.</p>
          )}
        </CardContent>
      </Card>

      {/* 문서 관리 다이얼로그 */}
      <Dialog
        open={docOpen}
        onOpenChange={(open) => {
          if (isUploadingDocuments) return;
          setDocOpen(open);
          if (!open) {
            setDocDraft([]);
            setDocError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>문서 관리</DialogTitle>
            <DialogDescription>
              {p.name} · 기존 문서는 유지하고 새 문서를 추가합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {p.docs.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-sm font-medium text-foreground">
                  등록된 문서
                </div>
                {p.docs.map((document, index) => (
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
              documents={docDraft}
              onChange={setDocDraft}
              onError={setDocError}
              disabled={isUploadingDocuments}
            />

            {docError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{docError}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isUploadingDocuments}
              onClick={() => {
                setDocOpen(false);
                setDocDraft([]);
                setDocError("");
              }}
            >
              취소
            </Button>
            <Button
              disabled={isUploadingDocuments}
              onClick={() => void uploadDocuments()}
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

function KpiCard({
  icon,
  label,
  value,
  raw,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  /** true면 CountUp 애니메이션 없이 값을 그대로 표시한다. 날짜처럼 숫자를 세는 게 어색한 값에 사용. */
  raw?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">{label}</span>
          <span>{icon}</span>
        </div>
        <div className="mt-2 text-foreground text-2xl">
          {raw ? value : <CountUp value={value} />}
        </div>
      </CardContent>
    </Card>
  );
}