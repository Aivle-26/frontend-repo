import { useEffect, useState } from "react";
import {
  ListTodo,
  Eye,
  CheckCircle2,
  FileText,
  ListTree,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/app/components/ui/utils";
import type { Task, TaskColumn } from "@/app/data/demoData";
import { useTasks, loadTasks, isTasksDemoData } from "@/app/state/taskStore";
import { CountUp } from "@/app/components/common/CountUp";
import {
  projectRepository,
  type RequirementResponse,
  type WbsTask,
} from "@/app/api/projectRepository";

const COLUMNS: { key: TaskColumn; label: string }[] = [
  { key: "todo", label: "할 일" },
  { key: "doing", label: "진행 중" },
  { key: "done", label: "완료" },
];

function priorityVariant(p: string) {
  if (p === "높음") return "destructive" as const;
  if (p === "중간") return "secondary" as const;
  return "outline" as const;
}

interface StaffDashboardProps {
  projectId: string;
  projectName: string;
  onOpenTask: (taskId: string) => void;
}

/** 실제 요구사항/WBS를 못 가져올 때(권한 없음 등) 보여줄 예시 데이터. */
const DEMO_REQUIREMENTS: RequirementResponse[] = [
  {
    requirementId: -1,
    analysisResultId: null,
    sourceDocumentId: null,
    externalReferenceId: null,
    type: "기능",
    title: "사용자 로그인 및 권한 관리 기능 구현",
    description: "",
    acceptanceCriteria: null,
    dueDate: null,
    deliverableName: null,
    securityCondition: null,
    sourceDocumentName: null,
    sourceExcerpt: null,
    priority: "높음",
    status: "확정",
  } as RequirementResponse,
  {
    requirementId: -2,
    analysisResultId: null,
    sourceDocumentId: null,
    externalReferenceId: null,
    type: "비기능",
    title: "동시 접속 500명 기준 응답속도 2초 이내 유지",
    description: "",
    acceptanceCriteria: null,
    dueDate: null,
    deliverableName: null,
    securityCondition: null,
    sourceDocumentName: null,
    sourceExcerpt: null,
    priority: "중간",
    status: "확정",
  } as RequirementResponse,
  {
    requirementId: -3,
    analysisResultId: null,
    sourceDocumentId: null,
    externalReferenceId: null,
    type: "기능",
    title: "관리자용 대시보드 통계 화면 제공",
    description: "",
    acceptanceCriteria: null,
    dueDate: null,
    deliverableName: null,
    securityCondition: null,
    sourceDocumentName: null,
    sourceExcerpt: null,
    priority: "낮음",
    status: "확정",
  } as RequirementResponse,
];

const DEMO_WBS_TASKS: WbsTask[] = [
  {
    taskId: -1,
    externalTaskId: "demo-1",
    parentExternalTaskId: null,
    taskCode: "1.1",
    taskName: "요구사항 정의 및 화면 설계",
    description: "",
    phase: "설계",
    requiredSkills: [],
    difficulty: "중",
    estimatedHours: 24,
    orderIndex: 1,
    requirementIds: [],
    confirmed: true,
  },
  {
    taskId: -2,
    externalTaskId: "demo-2",
    parentExternalTaskId: null,
    taskCode: "2.1",
    taskName: "API 연동 구현",
    description: "",
    phase: "개발",
    requiredSkills: [],
    difficulty: "상",
    estimatedHours: 40,
    orderIndex: 2,
    requirementIds: [],
    confirmed: true,
  },
  {
    taskId: -3,
    externalTaskId: "demo-3",
    parentExternalTaskId: null,
    taskCode: "3.1",
    taskName: "통합 테스트 및 배포",
    description: "",
    phase: "테스트",
    requiredSkills: [],
    difficulty: "중",
    estimatedHours: 16,
    orderIndex: 3,
    requirementIds: [],
    confirmed: true,
  },
];

export function StaffDashboard({ projectId, projectName, onOpenTask }: StaffDashboardProps) {
  // 업무 보드는 taskStore(실제 백엔드 API 연동)를 그대로 쓴다.
  // 업무 상세 화면에서 "완료 처리"를 누르면 즉시 여기에도 반영된다.
  const tasks = useTasks();
  const [tasksLoading, setTasksLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    setTasksLoading(true);
    void loadTasks(projectId, projectName).finally(() => {
      if (!ignore) setTasksLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, [projectId, projectName]);

  const [requirements, setRequirements] = useState<RequirementResponse[]>([]);
  const [wbsTasks, setWbsTasks] = useState<WbsTask[]>([]);
  const [reqWbsLoading, setReqWbsLoading] = useState(true);
  const [reqWbsIsDemo, setReqWbsIsDemo] = useState(false);

  useEffect(() => {
    let ignore = false;
    setReqWbsLoading(true);

    Promise.allSettled([
      projectRepository.getRequirements(projectId),
      projectRepository.getWbs(projectId),
    ]).then(([reqResult, wbsResult]) => {
      if (ignore) return;

      const gotRequirements =
        reqResult.status === "fulfilled" && (reqResult.value.finalRequirements ?? []).length > 0;
      const gotWbs =
        wbsResult.status === "fulfilled" && (wbsResult.value?.finalTasks ?? []).length > 0;

      if (gotRequirements || gotWbs) {
        setRequirements(
          reqResult.status === "fulfilled" ? (reqResult.value.finalRequirements ?? []) : [],
        );
        setWbsTasks(
          wbsResult.status === "fulfilled" ? (wbsResult.value?.finalTasks ?? []) : [],
        );
        setReqWbsIsDemo(false);
      } else {
        // 실데이터를 못 가져왔거나 비어있다 — 예시 데이터로 채운다.
        setRequirements(DEMO_REQUIREMENTS);
        setWbsTasks(DEMO_WBS_TASKS);
        setReqWbsIsDemo(true);
      }

      setReqWbsLoading(false);
    });

    return () => {
      ignore = true;
    };
  }, [projectId]);

  const kpis = {
    myTasks: tasks.length,
    inProgress: tasks.filter((t) => t.column === "doing").length,
    completed: tasks.filter((t) => t.column === "done").length,
  };

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          icon={<ListTodo className="size-4" />}
          label="내 업무"
          value={`${kpis.myTasks}건`}
          tone="blue"
        />
        <KpiCard
          icon={<Eye className="size-4" />}
          label="진행 중"
          value={`${kpis.inProgress}건`}
          tone="amber"
        />
        <KpiCard
          icon={<CheckCircle2 className="size-4" />}
          label="완료"
          value={`${kpis.completed}건`}
          tone="emerald"
        />
      </div>

      {/* Kanban */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>업무 보드</CardTitle>
            {!tasksLoading && isTasksDemoData() && (
              <Badge variant="outline" className="font-normal">
                예시 데이터
              </Badge>
            )}
          </div>
          <CardDescription>업무 카드를 클릭하면 상세 화면으로 이동합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {tasksLoading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}
          {!tasksLoading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COLUMNS.map((col) => {
              const items = tasks.filter((t) => t.column === col.key);
              return (
                <div key={col.key} className="rounded-lg bg-muted/50 p-3">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-foreground text-sm">{col.label}</span>
                    <Badge variant="secondary">{items.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {items.map((task) => (
                      <TaskCard key={task.id} task={task} onClick={() => onOpenTask(task.id)} />
                    ))}
                    {items.length === 0 && (
                      <p className="text-muted-foreground text-xs px-1 py-4 text-center">
                        업무 없음
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 관련 요구사항·WBS */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4" /> 관련 요구사항·WBS
            </CardTitle>
            {!reqWbsLoading && reqWbsIsDemo && (
              <Badge variant="outline" className="font-normal">
                예시 데이터
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {reqWbsLoading && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}

          {!reqWbsLoading && (
            <>
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <FileText className="size-3.5" /> 요구사항
                </p>
                {requirements.slice(0, 3).map((r) => (
                  <div key={r.requirementId} className="rounded-md border border-border p-3">
                    <Badge variant="outline" className="mb-1">{r.type}</Badge>
                    <p className="text-foreground text-sm">{r.title}</p>
                  </div>
                ))}
                {requirements.length === 0 && (
                  <p className="text-muted-foreground text-sm">등록된 요구사항이 없습니다.</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <ListTree className="size-3.5" /> WBS
                </p>
                {wbsTasks.slice(0, 3).map((t) => (
                  <div key={t.externalTaskId} className="rounded-md border border-border p-3">
                    <Badge variant="outline" className="mb-1">{t.phase}</Badge>
                    <p className="text-foreground text-sm">{t.taskName}</p>
                  </div>
                ))}
                {wbsTasks.length === 0 && (
                  <p className="text-muted-foreground text-sm">등록된 WBS가 없습니다.</p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TaskCard({ task, onClick }: { task: Task; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-md border border-border bg-card p-3 text-left transition-shadow hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-foreground text-sm">{task.title}</span>
        <Badge variant={priorityVariant(task.priority)}>{task.priority}</Badge>
      </div>
      <div className="mt-2 flex items-center justify-between text-muted-foreground text-xs">
        <span>{task.projectName}</span>
        <span>~{task.due}</span>
      </div>
    </button>
  );
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "blue" | "red" | "amber" | "emerald";
}

const KPI_TONE_STYLES: Record<
  NonNullable<KpiCardProps["tone"]>,
  { card: string; icon: string }
> = {
  blue: { card: "bg-blue-50/70 border-blue-100", icon: "text-blue-600" },
  red: { card: "bg-red-50/70 border-red-100", icon: "text-red-600" },
  amber: { card: "bg-amber-50/70 border-amber-100", icon: "text-amber-600" },
  emerald: { card: "bg-emerald-50/70 border-emerald-100", icon: "text-emerald-600" },
};

function KpiCard({ icon, label, value, tone }: KpiCardProps) {
  const toneStyle = tone ? KPI_TONE_STYLES[tone] : null;
  return (
    <Card className={toneStyle?.card}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">{label}</span>
          <span className={cn("text-muted-foreground", toneStyle?.icon)}>{icon}</span>
        </div>
        <div className="mt-2 text-foreground text-2xl">
          <CountUp value={value} />
        </div>
      </CardContent>
    </Card>
  );
}