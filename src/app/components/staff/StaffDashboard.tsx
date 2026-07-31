import {
  ListTodo,
  Eye,
  CheckCircle2,
  Sparkles,
  FileText,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { cn } from "@/app/components/ui/utils";
import { demoRepository } from "@/app/data/demoRepository";
import type { Task, TaskColumn } from "@/app/data/demoData";
import { useTasks } from "@/app/state/taskStore";
import { CountUp } from "@/app/components/common/CountUp";

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
  onOpenTask: (taskId: string) => void;
}

export function StaffDashboard({ onOpenTask }: StaffDashboardProps) {
  const { aiHelper, requirements } = demoRepository.getStaffDashboard();
  // 업무 보드는 taskStore(localStorage 기반 실시간 데이터)를 그대로 쓴다.
  // 업무 상세 화면에서 "완료 처리"를 누르면 즉시 여기에도 반영된다.
  const tasks = useTasks();

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
          <CardTitle>업무 보드</CardTitle>
          <CardDescription>업무 카드를 클릭하면 상세 화면으로 이동합니다.</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Related requirements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4" /> 관련 요구사항·WBS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {requirements.slice(0, 3).map((r) => (
              <div key={r.id} className="rounded-md border border-border p-3">
                <Badge variant="outline" className="mb-1">{r.category}</Badge>
                <p className="text-foreground text-sm">{r.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* AI helper */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4" /> AI 업무 도우미
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {aiHelper.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="text-foreground text-sm">{line}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
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