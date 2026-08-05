import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  FileType2,
  LayoutTemplate,
  ListTree,
  Loader2,
  Presentation,
  TrendingUp,
  UploadCloud,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Progress } from "@/app/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/app/components/ui/collapsible";
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
import { OrganizationChartArtifactCard } from "@/app/components/common/OrganizationChartArtifactCard";
import {
  ApiError,
  projectRepository,
  type ProjectDocumentUploadItem,
  type RequirementsResult,
  type WbsTask,
  type ProjectScheduleDetail,
  type TaskAssignmentResponse,
  type FinalCostEstimateResponse,
} from "@/app/api/projectRepository";
import type { PendingProjectDocument } from "@/app/components/pm/projectDocumentUpload";
import type { ProjectDoc, ProjectStatus, ProjectSummary } from "@/app/projects/projectTypes";
import { isProjectUiPrototypeCompleted } from "@/app/projects/projectProgress";

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
  /** [프로젝트] 탭 카드와 같은 기준으로 계산된 기획 완료 여부. true면 상태 배지를 "진행 중"으로 통일해서 보여준다. */
  planningComplete?: boolean;
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

export function ProjectDetail({ project: p, planningComplete, onBack, onNavigate }: ProjectDetailProps) {
  const [docOpen, setDocOpen] = useState(false);
  const [docDraft, setDocDraft] = useState<PendingProjectDocument[]>([]);
  const [docError, setDocError] = useState("");
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);
  const [documents, setDocuments] = useState<ProjectDocumentUploadItem[]>([]);
  const [requirements, setRequirements] = useState<RequirementsResult | null>(null);
  const [wbsTasks, setWbsTasks] = useState<WbsTask[]>([]);
  const [scheduleRows, setScheduleRows] = useState<ProjectScheduleDetail[]>([]);
  const [assignments, setAssignments] = useState<TaskAssignmentResponse[]>([]);
  const [finalBudget, setFinalBudget] = useState<FinalCostEstimateResponse | null>(null);
  const [progressRate, setProgressRate] = useState<number | null>(null);
  const [isLoadingProjectData, setIsLoadingProjectData] = useState(true);
  const [projectDataError, setProjectDataError] = useState("");

  const loadProjectData = useCallback(async () => {
    setIsLoadingProjectData(true);
    setProjectDataError("");
    const [
      documentResult,
      requirementResult,
      wbsResult,
      scheduleResult,
      assignmentResult,
      budgetResult,
      progressResult,
    ] = await Promise.allSettled([
      projectRepository.listProjectDocuments(p.id),
      projectRepository.getRequirements(p.id),
      projectRepository.getWbs(p.id),
      projectRepository.getSchedules(p.id),
      projectRepository.getProjectAssignments(p.id),
      projectRepository.getFinalCostEstimate(p.id),
      projectRepository.getProjectProgress(p.id),
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

    setWbsTasks(
      wbsResult.status === "fulfilled" ? (wbsResult.value?.finalTasks ?? []) : [],
    );
    setScheduleRows(
      scheduleResult.status === "fulfilled" ? (scheduleResult.value?.schedules ?? []) : [],
    );
    setAssignments(assignmentResult.status === "fulfilled" ? assignmentResult.value : []);
    setFinalBudget(budgetResult.status === "fulfilled" ? budgetResult.value : null);
    setProgressRate(
      progressResult.status === "fulfilled" ? Number(progressResult.value.progressRate ?? 0) : null,
    );

    if (documentResult.status === "rejected" || requirementResult.status === "rejected") {
      setProjectDataError("일부 프로젝트 정보를 불러오지 못했습니다.");
    }
    setIsLoadingProjectData(false);
  }, [p.id]);

  useEffect(() => {
    void loadProjectData();
  }, [loadProjectData]);

  const requirementCount = getRequirementCount(requirements);
  const uiPrototypeCompleted = isProjectUiPrototypeCompleted(p.id);
  const remainingDays = useMemo(() => getDaysRemaining(p.dueDate), [p.dueDate]);

  const [openStages, setOpenStages] = useState<Set<string>>(new Set());
  const toggleStage = (key: string) => {
    setOpenStages((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const planningStages = [
    {
      key: "requirements",
      label: "요구사항",
      count: requirements?.finalRequirements?.length ?? 0,
      icon: <FileText className="size-4" />,
    },
    {
      key: "wbs",
      label: "WBS",
      count: wbsTasks.length,
      icon: <ListTree className="size-4" />,
    },
    {
      key: "schedule",
      label: "일정",
      count: scheduleRows.length,
      icon: <CalendarClock className="size-4" />,
    },
    {
      key: "assign",
      label: "담당자 배정",
      count: assignments.length,
      icon: <Users className="size-4" />,
    },
    {
      key: "budget",
      label: "예산",
      count: finalBudget ? 1 : 0,
      icon: <Wallet className="size-4" />,
    },
    {
      key: "uiPrototype",
      label: "UI 프로토타입",
      count: uiPrototypeCompleted ? 1 : 0,
      icon: <LayoutTemplate className="size-4" />,
    },
  ] as const;

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
            <Badge
              variant="outline"
              className={cn(
                "font-normal",
                planningComplete
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : statusClass(p.status),
              )}
            >
              {planningComplete ? "진행 중" : p.status}
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
            {progressRate !== null ? (
              <>
                <div className="mt-2 text-foreground text-2xl"><CountUp value={`${progressRate}%`} /></div>
                <Progress value={progressRate} className="mt-3" />
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

      {/* 계획 5단계 결과 확인 (세로 진행도 + 토글로 펼쳐서 확인, 조회 전용) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-4" /> 계획 단계 결과 확인
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingProjectData ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" /> 불러오는 중입니다.
            </div>
          ) : (
            <div className="space-y-0">
              {planningStages.map((stage, i) => {
                const open = openStages.has(stage.key);
                return (
                  <div key={stage.key} className="flex gap-3">
                    {/* 세로 진행도 점 + 선 — 각 행과 같은 flex 컨테이너 안에 둬서 높이가 항상 맞는다. */}
                    <div className="flex flex-col items-center">
                      <span className="mt-2.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <CheckCircle2 className="size-3.5" />
                      </span>
                      {i < planningStages.length - 1 && (
                        <span className="my-1 w-0.5 flex-1 bg-emerald-200" />
                      )}
                    </div>

                    <div className="flex-1 pb-2.5">
                      <Collapsible open={open} onOpenChange={() => toggleStage(stage.key)}>
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2.5 text-left hover:bg-muted/50"
                          >
                            <span className="flex items-center gap-2 text-foreground text-sm">
                              {stage.icon}
                              {stage.label}
                              <Badge variant="outline" className="font-normal">
                                {stage.count}건
                              </Badge>
                            </span>
                            <ChevronDown
                              className={cn(
                                "size-4 text-muted-foreground transition-transform",
                                open && "rotate-180",
                              )}
                            />
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-1.5 rounded-lg border border-border bg-muted/20 p-3">
                            <PlanningStagePreview
                              stageKey={stage.key}
                              requirements={requirements}
                              wbsTasks={wbsTasks}
                              scheduleRows={scheduleRows}
                              assignments={assignments}
                              finalBudget={finalBudget}
                              uiPrototypeCompleted={uiPrototypeCompleted}
                            />
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OrganizationChartArtifactCard projectId={p.id} canGenerate />

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
              <div className="max-h-80 space-y-2 overflow-y-auto">
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
      </div>


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


function KpiCard({ icon, label, value, raw }: { icon: React.ReactNode; label: string; value: string; raw?: boolean }) {
  return (
    <Card><CardContent className="pt-5"><div className="flex items-center justify-between"><span className="text-muted-foreground text-sm">{label}</span><span>{icon}</span></div><div className="mt-2 text-foreground text-2xl">{raw ? value : <CountUp value={value} />}</div></CardContent></Card>
  );
}

/** 계획 단계별 AI 생성 결과를 조회 전용으로 요약해서 보여준다 (수정 불가, 확인만). */
function PlanningStagePreview({
  stageKey,
  requirements,
  wbsTasks,
  scheduleRows,
  assignments,
  finalBudget,
  uiPrototypeCompleted,
}: {
  stageKey: "requirements" | "wbs" | "schedule" | "assign" | "budget" | "uiPrototype";
  requirements: RequirementsResult | null;
  wbsTasks: WbsTask[];
  scheduleRows: ProjectScheduleDetail[];
  assignments: TaskAssignmentResponse[];
  finalBudget: FinalCostEstimateResponse | null;
  uiPrototypeCompleted: boolean;
}) {
  if (stageKey === "requirements") {
    const list = requirements?.finalRequirements ?? [];
    if (list.length === 0) return <EmptyStage text="확정된 요구사항이 없습니다." />;
    return (
      <ul className="max-h-80 space-y-2 overflow-y-auto">
        {list.map((r) => (
          <li key={r.requirementId} className="flex items-start gap-2 text-sm">
            <Badge variant="outline" className="shrink-0 font-normal">{r.type}</Badge>
            <span className="text-foreground">{r.title}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (stageKey === "wbs") {
    if (wbsTasks.length === 0) return <EmptyStage text="확정된 WBS가 없습니다." />;
    return (
      <ul className="max-h-80 space-y-2 overflow-y-auto">
        {wbsTasks.map((t) => (
          <li key={t.externalTaskId} className="flex items-start gap-2 text-sm">
            <Badge variant="outline" className="shrink-0 font-normal">{t.phase}</Badge>
            <span className="text-foreground">{t.taskName}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (stageKey === "schedule") {
    if (scheduleRows.length === 0) return <EmptyStage text="생성된 일정이 없습니다." />;
    return (
      <ul className="max-h-80 space-y-2 overflow-y-auto">
        {scheduleRows.map((s) => (
          <li key={s.scheduleId} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-foreground">{s.wbsName}</span>
            <span className="shrink-0 text-muted-foreground text-xs">
              {s.recommended.startDate} ~ {s.recommended.endDate}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  if (stageKey === "assign") {
    if (assignments.length === 0) return <EmptyStage text="배정된 담당자가 없습니다." />;
    return (
      <ul className="max-h-80 space-y-2 overflow-y-auto">
        {assignments.map((a) => (
          <li key={a.assignmentId} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-foreground">{a.taskName}</span>
            <span className="shrink-0 text-muted-foreground text-xs">{a.employeeNumber}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (stageKey === "uiPrototype") {
    if (!uiPrototypeCompleted) {
      return <EmptyStage text="아직 UI 프로토타입 단계를 완료 처리하지 않았습니다." />;
    }
    return (
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle2 className="size-4 text-emerald-600" />
        <span className="text-foreground">UI 프로토타입 단계가 완료 처리되었습니다.</span>
      </div>
    );
  }

  // budget
  if (!finalBudget) return <EmptyStage text="확정된 예산이 없습니다." />;
  return (
    <div className="space-y-1.5 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">최종 예상 금액</span>
        <span className="text-foreground">
          {Math.round(finalBudget.estimate.totalAmount).toLocaleString("ko-KR")}원
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">공급가액</span>
        <span className="text-foreground">
          {Math.round(finalBudget.estimate.supplyAmount).toLocaleString("ko-KR")}원
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">인건비</span>
        <span className="text-foreground">
          {Math.round(finalBudget.costSummary.laborCost).toLocaleString("ko-KR")}원
        </span>
      </div>
    </div>
  );
}

function EmptyStage({ text }: { text: string }) {
  return <p className="text-muted-foreground text-sm">{text}</p>;
}