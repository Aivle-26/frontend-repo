import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bot,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  Flag,
  Loader2,
  Lock,
  MonitorSmartphone,
  Network,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ScrollText,
  Trash2,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import { Skeleton } from "@/app/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { Textarea } from "@/app/components/ui/textarea";
import { cn } from "@/app/components/ui/utils";
import {
  ApiError,
  projectRepository,
  type RequirementResponse,
  type SaveFinalWbsTask,
  type WbsResult,
  type WbsTask,
} from "@/app/api/projectRepository";
import {
  markGenerated,
  markScheduleRegistered,
  useGenerated,
  useScheduleRegistered,
  type GenKey as Key,
} from "@/app/state/generationStore";
import type { ProjectSummary } from "@/app/data/demoData";

type GenStatus = "idle" | "generating" | "done";
type EditorState = { mode: "new" | "edit"; task: WbsTask } | null;

const WBS_PHASES = [
  "ANALYSIS",
  "DESIGN",
  "DEVELOPMENT",
  "TEST",
  "DEPLOYMENT",
  "OPERATION",
] as const;

const WBS_DIFFICULTIES = ["LOW", "MEDIUM", "HIGH"] as const;

const WBS_SKILLS = new Set([
  "DOCUMENT_ANALYSIS",
  "REQUIREMENTS_ANALYSIS",
  "ARCHITECTURE_DESIGN",
  "BACKEND_DEVELOPMENT",
  "FRONTEND_DEVELOPMENT",
  "TESTING",
  "DEVOPS",
]);

const BACKBONE: {
  key: Key;
  icon: typeof FileText;
  title: string;
  desc: string;
  short: string;
}[] = [
  {
    key: "req",
    icon: FileText,
    title: "요구사항 목록",
    desc: "서버에 저장된 최종 요구사항을 조회",
    short: "요구사항",
  },
  {
    key: "milestone",
    icon: Flag,
    title: "프로젝트 목표/마일스톤",
    desc: "프로젝트 목표와 주요 마일스톤 정리",
    short: "마일스톤",
  },
  {
    key: "wbs",
    icon: Network,
    title: "요구사항 기반 WBS",
    desc: "최종 요구사항을 바탕으로 AI 작업 분해 구조 생성",
    short: "WBS",
  },
  {
    key: "schedule",
    icon: CalendarClock,
    title: "MC 일정 계획",
    desc: "최종 WBS의 예상 공수를 바탕으로 일정 산정",
    short: "일정",
  },
];

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError && error.message ? error.message : fallback;
}

function normalizeTask(task: WbsTask, index: number): WbsTask {
  return {
    taskId: task.taskId ?? null,
    externalTaskId: String(task.externalTaskId ?? `TASK-${index + 1}`),
    parentExternalTaskId: task.parentExternalTaskId || null,
    taskCode: String(task.taskCode ?? index + 1),
    taskName: String(task.taskName ?? ""),
    description: String(task.description ?? ""),
    phase: String(task.phase ?? "ANALYSIS"),
    requiredSkills: Array.isArray(task.requiredSkills) ? task.requiredSkills : [],
    difficulty: String(task.difficulty ?? "MEDIUM"),
    estimatedHours: Number.isFinite(Number(task.estimatedHours))
      ? Number(task.estimatedHours)
      : 0,
    orderIndex: index,
    requirementIds: Array.isArray(task.requirementIds)
      ? task.requirementIds.map(Number).filter(Number.isFinite)
      : [],
    confirmed: Boolean(task.confirmed),
  };
}

function normalizeWbs(result: WbsResult): WbsResult {
  return {
    ...result,
    aiSuggestionTasks: Array.isArray(result.aiSuggestionTasks)
      ? result.aiSuggestionTasks.map(normalizeTask)
      : [],
    finalTasks: Array.isArray(result.finalTasks)
      ? result.finalTasks.map(normalizeTask)
      : [],
  };
}

function createExternalTaskId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `USER-${crypto.randomUUID()}`;
  }
  return `USER-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyTask(
  orderIndex: number,
  finalRequirements: RequirementResponse[],
): WbsTask {
  return {
    taskId: null,
    externalTaskId: createExternalTaskId(),
    parentExternalTaskId: null,
    taskCode: String(orderIndex + 1),
    taskName: "",
    description: "",
    phase: "ANALYSIS",
    requiredSkills: [],
    difficulty: "MEDIUM",
    estimatedHours: 8,
    orderIndex,
    requirementIds: finalRequirements[0]
      ? [finalRequirements[0].requirementId]
      : [],
    confirmed: false,
  };
}

function normalizeOrder(tasks: WbsTask[]) {
  return tasks.map((task, index) => ({ ...task, orderIndex: index }));
}

function parseStringList(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function parseNumberList(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => Number(item.trim()))
        .filter(Number.isInteger),
    ),
  );
}

export function PmGeneration({
  project,
  onOpenDocuments,
  onOpenRequirements,
}: {
  project: ProjectSummary;
  onOpenDocuments?: () => void;
  onOpenRequirements?: () => void;
}) {
  const done = useGenerated(project.id);
  const [busy, setBusy] = useState<Partial<Record<Key, boolean>>>({});
  const [requirements, setRequirements] = useState<RequirementResponse[]>([]);
  const [wbs, setWbs] = useState<WbsResult | null>(null);
  const [wbsLoading, setWbsLoading] = useState(true);
  const [wbsError, setWbsError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [savingFinal, setSavingFinal] = useState(false);
  const [editor, setEditor] = useState<EditorState>(null);
  const scheduleRegistered = useScheduleRegistered(project.id);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const scheduleRef = useRef<HTMLDivElement | null>(null);

  const finalRequirements = useMemo(
    () =>
      requirements.filter(
        (item) => Number.isInteger(item.requirementId) && item.requirementId > 0,
      ),
    [requirements],
  );

  const finalRequirementIds = useMemo(
    () => new Set(finalRequirements.map((item) => item.requirementId)),
    [finalRequirements],
  );

  const finalTasks = wbs?.finalTasks ?? [];
  const aiTasks = wbs?.aiSuggestionTasks ?? [];
  const scheduleTasks = finalTasks.length > 0 ? finalTasks : aiTasks;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setWbsLoading(true);
      setWbsError("");

      const [requirementsResult, wbsResult] = await Promise.allSettled([
        projectRepository.getRequirements(project.id),
        projectRepository.getWbs(project.id),
      ]);

      if (cancelled) return;

      if (requirementsResult.status === "fulfilled") {
        const items = Array.isArray(requirementsResult.value.finalRequirements)
          ? requirementsResult.value.finalRequirements
          : [];
        setRequirements(items);
        if (items.length > 0) markGenerated(project.id, "req");
      } else {
        setRequirements([]);
        setWbsError(
          errorMessage(
            requirementsResult.reason,
            "요구사항을 불러오지 못했습니다.",
          ),
        );
      }

      if (wbsResult.status === "fulfilled" && wbsResult.value) {
        setWbs(normalizeWbs(wbsResult.value));
        markGenerated(project.id, "wbs");
      } else if (
        wbsResult.status === "rejected" &&
        !(wbsResult.reason instanceof ApiError && wbsResult.reason.status === 404)
      ) {
        setWbsError((current) =>
          current || errorMessage(wbsResult.reason, "WBS를 불러오지 못했습니다."),
        );
      }

      setWbsLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  const isStepDone = (key: Key) => {
    if (key === "req") return requirements.length > 0;
    if (key === "wbs") return wbs !== null;
    return done.has(key);
  };

  const statusOf = (key: Key): GenStatus =>
    busy[key] ? "generating" : isStepDone(key) ? "done" : "idle";

  const getLockedLabel = (key: Key, index: number) => {
    if (key === "wbs" && finalRequirements.length === 0) {
      return "최종 요구사항 필요";
    }
    if (key === "schedule" && !wbs) return "WBS 필요";

    const previous = BACKBONE[index - 1];
    if (index > 0 && key !== "wbs" && !isStepDone(previous.key)) {
      return `${previous.short} 필요`;
    }
    return null;
  };

  const refreshRequirements = async () => {
    setBusy((current) => ({ ...current, req: true }));
    try {
      const response = await projectRepository.getRequirements(project.id);
      const items = Array.isArray(response.finalRequirements)
        ? response.finalRequirements
        : [];
      setRequirements(items);
      if (items.length === 0) {
        toast.error("조회된 요구사항이 없습니다.");
        return;
      }
      markGenerated(project.id, "req");
      toast.success(`요구사항 ${items.length}건을 불러왔습니다.`);
    } catch (error) {
      toast.error(errorMessage(error, "요구사항 조회에 실패했습니다."));
    } finally {
      setBusy((current) => ({ ...current, req: false }));
    }
  };

  const loadWbs = async () => {
    const result = await projectRepository.getWbs(project.id);
    const normalized = normalizeWbs(result);
    setWbs(normalized);
    markGenerated(project.id, "wbs");
    return normalized;
  };

  const generateWbs = async () => {
    if (finalRequirements.length === 0) {
      toast.error("WBS 생성 전에 최종 요구사항을 한 건 이상 저장하세요.");
      return;
    }

    setBusy((current) => ({ ...current, wbs: true }));
    setWbsError("");

    try {
      await projectRepository.generateWbs(project.id);
      await loadWbs();

      setPreviewOpen(true);
      requestAnimationFrame(() =>
        previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
      toast.success("최종 요구사항 기반 WBS를 생성했습니다.");
    } catch (error) {
      const message = errorMessage(error, "WBS 생성에 실패했습니다.");
      setWbsError(message);
      toast.error(message);
    } finally {
      setBusy((current) => ({ ...current, wbs: false }));
    }
  };

  const run = async (key: Key, label: string, onDone?: () => void) => {
    if (key === "req") {
      await refreshRequirements();
      onDone?.();
      return;
    }

    if (key === "wbs") {
      await generateWbs();
      return;
    }

    setBusy((current) => ({ ...current, [key]: true }));
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 700));
      markGenerated(project.id, key);
      toast.success(`${label} 생성을 완료했습니다.`);
      onDone?.();
    } catch (error) {
      toast.error(errorMessage(error, `${label} 생성에 실패했습니다.`));
    } finally {
      setBusy((current) => ({ ...current, [key]: false }));
    }
  };

  const scrollToPreview = () =>
    requestAnimationFrame(() =>
      previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );

  const togglePreview = () =>
    setPreviewOpen((open) => {
      if (!open) scrollToPreview();
      return !open;
    });

  const openSchedule = () => {
    setScheduleOpen(true);
    requestAnimationFrame(() =>
      scheduleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  const toggleSchedule = () =>
    setScheduleOpen((open) => {
      if (!open) {
        requestAnimationFrame(() =>
          scheduleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        );
      }
      return !open;
    });

  const setFinalTasks = (tasks: WbsTask[]) => {
    setWbs((current) =>
      current
        ? {
            ...current,
            finalConfirmed: false,
            finalTasks: normalizeOrder(tasks),
          }
        : current,
    );
  };

  const moveTask = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= finalTasks.length) return;

    const next = [...finalTasks];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setFinalTasks(next);
  };

  const removeTask = (externalTaskId: string) => {
    setFinalTasks(
      finalTasks.filter((task) => task.externalTaskId !== externalTaskId),
    );
    toast.success("최종 WBS 목록에서 작업을 제거했습니다.");
  };

  const resetFromAi = () => {
    const copied = aiTasks.map((task, index) => ({
      ...task,
      taskId: null,
      confirmed: false,
      orderIndex: index,
    }));
    setFinalTasks(copied);
    toast.success("AI 최초 제안을 최종 WBS 편집 목록에 복사했습니다.");
  };

  const saveEditorTask = () => {
    if (!editor) return;

    const task = normalizeTask(editor.task, editor.task.orderIndex);
    if (!task.externalTaskId.trim()) {
      toast.error("externalTaskId가 필요합니다.");
      return;
    }
    if (!task.taskCode.trim()) {
      toast.error("작업 코드를 입력하세요.");
      return;
    }
    if (!task.taskName.trim()) {
      toast.error("작업명을 입력하세요.");
      return;
    }
    if (
      !Number.isFinite(Number(task.estimatedHours)) ||
      Number(task.estimatedHours) < 0
    ) {
      toast.error("예상 공수는 0 이상의 숫자여야 합니다.");
      return;
    }

    const duplicateExternalId =
      editor.mode === "new" &&
      finalTasks.some((item) => item.externalTaskId === task.externalTaskId);
    if (duplicateExternalId) {
      toast.error("externalTaskId가 중복되었습니다.");
      return;
    }

    const duplicateTaskCode = finalTasks.some(
      (item) =>
        item.taskCode === task.taskCode &&
        item.externalTaskId !== editor.task.externalTaskId,
    );
    if (duplicateTaskCode) {
      toast.error("작업 코드가 중복되었습니다.");
      return;
    }

    if (!WBS_PHASES.includes(task.phase as (typeof WBS_PHASES)[number])) {
      toast.error(
        "단계 값은 ANALYSIS, DESIGN, DEVELOPMENT, TEST, DEPLOYMENT, OPERATION 중 하나여야 합니다.",
      );
      return;
    }

    if (
      !WBS_DIFFICULTIES.includes(
        task.difficulty as (typeof WBS_DIFFICULTIES)[number],
      )
    ) {
      toast.error("난이도 값은 LOW, MEDIUM, HIGH 중 하나여야 합니다.");
      return;
    }

    const invalidSkill = task.requiredSkills.find(
      (skill) => !WBS_SKILLS.has(skill),
    );
    if (invalidSkill) {
      toast.error(`지원하지 않는 필요 기술입니다: ${invalidSkill}`);
      return;
    }

    const invalidRequirement = task.requirementIds.find(
      (id) => !finalRequirementIds.has(id),
    );
    if (invalidRequirement !== undefined) {
      toast.error(
        `요구사항 ID ${invalidRequirement}은 최종 요구사항이 아닙니다.`,
      );
      return;
    }

    if (
      task.parentExternalTaskId &&
      task.parentExternalTaskId === task.externalTaskId
    ) {
      toast.error("작업 자신을 부모 작업으로 지정할 수 없습니다.");
      return;
    }

    if (editor.mode === "new") {
      setFinalTasks([...finalTasks, task]);
    } else {
      setFinalTasks(
        finalTasks.map((item) =>
          item.externalTaskId === editor.task.externalTaskId ? task : item,
        ),
      );
    }

    setEditor(null);
    toast.success(editor.mode === "new" ? "작업을 추가했습니다." : "작업을 수정했습니다.");
  };

  const validateAndBuildSaveTasks = (): SaveFinalWbsTask[] | null => {
    if (finalTasks.length === 0) {
      toast.error("최종 WBS 작업은 최소 1개 이상이어야 합니다.");
      return null;
    }

    const externalIds = new Set<string>();
    const taskCodes = new Set<string>();

    for (const task of finalTasks) {
      const externalTaskId = task.externalTaskId.trim();
      const taskCode = task.taskCode.trim();

      if (!externalTaskId || !taskCode || !task.taskName.trim()) {
        toast.error("모든 작업에 externalTaskId, 작업 코드, 작업명이 필요합니다.");
        return null;
      }
      if (externalIds.has(externalTaskId)) {
        toast.error(`externalTaskId가 중복되었습니다: ${externalTaskId}`);
        return null;
      }
      if (taskCodes.has(taskCode)) {
        toast.error(`작업 코드가 중복되었습니다: ${taskCode}`);
        return null;
      }
      if (
        !Number.isFinite(Number(task.estimatedHours)) ||
        Number(task.estimatedHours) < 0
      ) {
        toast.error(`${task.taskName}의 예상 공수를 확인하세요.`);
        return null;
      }
      if (!WBS_PHASES.includes(task.phase as (typeof WBS_PHASES)[number])) {
        toast.error(`${task.taskName}의 단계 값이 올바르지 않습니다.`);
        return null;
      }
      if (
        !WBS_DIFFICULTIES.includes(
          task.difficulty as (typeof WBS_DIFFICULTIES)[number],
        )
      ) {
        toast.error(`${task.taskName}의 난이도 값이 올바르지 않습니다.`);
        return null;
      }
      const invalidSkill = task.requiredSkills.find(
        (skill) => !WBS_SKILLS.has(skill),
      );
      if (invalidSkill) {
        toast.error(
          `${task.taskName}의 필요 기술 값이 올바르지 않습니다: ${invalidSkill}`,
        );
        return null;
      }
      externalIds.add(externalTaskId);
      taskCodes.add(taskCode);
    }

    for (const task of finalTasks) {
      if (
        task.parentExternalTaskId &&
        !externalIds.has(task.parentExternalTaskId.trim())
      ) {
        toast.error(
          `${task.taskName}의 부모 작업 ${task.parentExternalTaskId}이 목록에 없습니다.`,
        );
        return null;
      }

      const invalidRequirement = task.requirementIds.find(
        (id) => !finalRequirementIds.has(id),
      );
      if (invalidRequirement !== undefined) {
        toast.error(
          `${task.taskName}에 최종 목록에 없는 요구사항 ID ${invalidRequirement}이 연결되어 있습니다.`,
        );
        return null;
      }
    }

    return normalizeOrder(finalTasks).map((task) => ({
      externalTaskId: task.externalTaskId.trim(),
      parentExternalTaskId: task.parentExternalTaskId?.trim() || null,
      taskCode: task.taskCode.trim(),
      taskName: task.taskName.trim(),
      description: task.description.trim(),
      phase: task.phase,
      requiredSkills: task.requiredSkills,
      difficulty: task.difficulty,
      estimatedHours: Number(task.estimatedHours),
      orderIndex: task.orderIndex,
      requirementIds: task.requirementIds,
    }));
  };

  const saveFinalWbs = async () => {
    if (!wbs) return;

    const tasks = validateAndBuildSaveTasks();
    if (!tasks) return;

    setSavingFinal(true);
    try {
      const saved = await projectRepository.saveFinalWbs(project.id, { tasks });
      setWbs(normalizeWbs(saved));
      markGenerated(project.id, "wbs");
      toast.success("최종 WBS를 저장했습니다.");
    } catch (error) {
      toast.error(errorMessage(error, "최종 WBS 저장에 실패했습니다."));
    } finally {
      setSavingFinal(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-blue-100 bg-blue-50/40">
        <CardContent className="flex items-center gap-3 pt-6">
          <div className="flex size-11 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Bot className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="text-foreground">AI 문서 생성</span>
              <Badge variant="secondary" className="font-normal">
                {project.name}
              </Badge>
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              최종 요구사항을 기반으로 WBS를 생성하고 최종 작업 목록을 편집합니다.
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <SectionTitle
          title="계획 백본"
          hint="WBS는 저장된 최종 요구사항이 있어야 생성할 수 있습니다"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BACKBONE.map((step, index) => {
            const status = statusOf(step.key);
            const lockedLabel = getLockedLabel(step.key, index);
            const isLocked = Boolean(lockedLabel);
            const taskCount = finalTasks.length || aiTasks.length;
            const statusLabel: StatusLabel =
              status === "done"
                ? {
                    text:
                      step.key === "req"
                        ? `${finalRequirements.length}건 저장`
                        : step.key === "wbs"
                          ? `${taskCount}개 작업`
                          : "생성 완료",
                    tone: "success",
                  }
                : isLocked
                  ? { text: lockedLabel!, tone: "warning" }
                  : { text: "미생성", tone: "muted" };

            return (
              <GeneratorCard
                key={step.key}
                icon={step.icon}
                title={step.title}
                description={step.desc}
                status={status}
                statusLabel={statusLabel}
              >
                {isLocked ? (
                  <Button variant="outline" size="sm" className="flex-1" disabled>
                    <Lock className="size-3.5" /> {lockedLabel}
                  </Button>
                ) : status === "done" ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        void run(
                          step.key,
                          step.title,
                          step.key === "schedule" ? openSchedule : undefined,
                        )
                      }
                    >
                      <RefreshCw className="size-3.5" /> 다시 생성
                    </Button>

                    {step.key === "req" && onOpenRequirements && (
                      <Button size="sm" className="flex-1" onClick={onOpenRequirements}>
                        요구사항 보기 <ArrowRight className="size-3.5" />
                      </Button>
                    )}

                    {step.key === "milestone" && onOpenDocuments && (
                      <Button size="sm" className="flex-1" onClick={onOpenDocuments}>
                        문서함 보기 <ArrowRight className="size-3.5" />
                      </Button>
                    )}

                    {step.key === "wbs" && (
                      <Button size="sm" className="flex-1" onClick={togglePreview}>
                        {previewOpen ? (
                          <>
                            <EyeOff className="size-3.5" /> 접기
                          </>
                        ) : (
                          <>
                            <Eye className="size-3.5" /> WBS 보기
                          </>
                        )}
                      </Button>
                    )}

                    {step.key === "schedule" && (
                      <Button size="sm" className="flex-1" onClick={toggleSchedule}>
                        {scheduleOpen ? (
                          <>
                            <EyeOff className="size-3.5" /> 접기
                          </>
                        ) : (
                          <>
                            <Eye className="size-3.5" /> 일정표 보기
                          </>
                        )}
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={status === "generating" || wbsLoading}
                    onClick={() =>
                      void run(
                        step.key,
                        step.title,
                        step.key === "schedule" ? openSchedule : undefined,
                      )
                    }
                  >
                    {status === "generating" ? (
                      <>
                        <Clock className="size-3.5 animate-spin" /> 생성 중…
                      </>
                    ) : (
                      <>
                        <Wand2 className="size-3.5" /> 생성하기
                      </>
                    )}
                  </Button>
                )}
              </GeneratorCard>
            );
          })}
        </div>

        {wbsError && (
          <Alert variant="destructive">
            <AlertDescription>{wbsError}</AlertDescription>
          </Alert>
        )}

        {(wbsLoading || statusOf("wbs") === "generating") && (
          <WbsPreviewSkeleton />
        )}

        {wbs && previewOpen && (
          <div ref={previewRef}>
            <WbsWorkspace
              result={wbs}
              finalRequirements={finalRequirements}
              saving={savingFinal}
              onAdd={() =>
                setEditor({
                  mode: "new",
                  task: createEmptyTask(finalTasks.length, finalRequirements),
                })
              }
              onEdit={(task) =>
                setEditor({ mode: "edit", task: { ...task } })
              }
              onDelete={removeTask}
              onMove={moveTask}
              onResetFromAi={resetFromAi}
              onSave={() => void saveFinalWbs()}
              onOpenDocuments={onOpenDocuments}
            />
          </div>
        )}

        {statusOf("schedule") === "generating" && <SchedulePreviewSkeleton />}

        {statusOf("schedule") === "done" && scheduleOpen && (
          <div ref={scheduleRef}>
            <ScheduleGantt
              tasks={scheduleTasks}
              registered={scheduleRegistered}
              onRegister={() => {
                markScheduleRegistered(project.id);
                toast.success("프로젝트 일정으로 등록했습니다.");
              }}
              onOpenDocuments={onOpenDocuments}
            />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle title="추가 산출물" hint="필요할 때 개별로 생성" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <GeneratorCard
            icon={MonitorSmartphone}
            title="UI 프로토타입 초안"
            description="주요 화면 흐름을 프로토타입으로 초안화"
            status={statusOf("ui")}
            statusLabel={
              statusOf("ui") === "done"
                ? { text: "생성 완료", tone: "success" }
                : { text: "미생성", tone: "muted" }
            }
          >
            {statusOf("ui") === "done" ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => void run("ui", "UI 프로토타입 초안")}
                >
                  <RefreshCw className="size-3.5" /> 다시 생성
                </Button>
                {onOpenDocuments && (
                  <Button size="sm" className="flex-1" onClick={onOpenDocuments}>
                    문서함 보기 <ArrowRight className="size-3.5" />
                  </Button>
                )}
              </>
            ) : (
              <Button
                size="sm"
                className="flex-1"
                disabled={statusOf("ui") === "generating"}
                onClick={() => void run("ui", "UI 프로토타입 초안")}
              >
                {statusOf("ui") === "generating" ? (
                  <>
                    <Clock className="size-3.5 animate-spin" /> 생성 중…
                  </>
                ) : (
                  <>
                    <Wand2 className="size-3.5" /> 생성하기
                  </>
                )}
              </Button>
            )}
          </GeneratorCard>

          <GeneratorCard
            icon={ClipboardList}
            title="주간 스크럼 보고서"
            description="진행률·이슈를 취합해 주간 리포트 자동 작성"
            status={statusOf("weekly")}
            statusLabel={
              statusOf("weekly") === "done"
                ? { text: "생성 완료", tone: "success" }
                : { text: "이번 주 · 미생성", tone: "muted" }
            }
          >
            {statusOf("weekly") === "done" ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => void run("weekly", "주간 스크럼 보고서")}
                >
                  <RefreshCw className="size-3.5" /> 다시 생성
                </Button>
                {onOpenDocuments && (
                  <Button size="sm" className="flex-1" onClick={onOpenDocuments}>
                    문서함 보기 <ArrowRight className="size-3.5" />
                  </Button>
                )}
              </>
            ) : (
              <Button
                size="sm"
                className="flex-1"
                disabled={statusOf("weekly") === "generating"}
                onClick={() => void run("weekly", "주간 스크럼 보고서")}
              >
                {statusOf("weekly") === "generating" ? (
                  <>
                    <Clock className="size-3.5 animate-spin" /> 생성 중…
                  </>
                ) : (
                  <>
                    <Wand2 className="size-3.5" /> 생성하기
                  </>
                )}
              </Button>
            )}
          </GeneratorCard>

          <GeneratorCard
            icon={ScrollText}
            title="결정사항 로그"
            description="회의·검토 중 확정된 결정사항을 문서로 정리"
            status={statusOf("decision")}
            statusLabel={
              statusOf("decision") === "done"
                ? { text: "문서화 완료", tone: "success" }
                : { text: "누적 5건", tone: "muted" }
            }
          >
            {statusOf("decision") === "done" ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() =>
                    void run("decision", "결정사항 로그", () =>
                      toast.success("결정사항 로그를 문서함에 저장했습니다."),
                    )
                  }
                >
                  <RefreshCw className="size-3.5" /> 다시 생성
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => onOpenDocuments?.()}
                >
                  문서함 보기 <ArrowRight className="size-3.5" />
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className="flex-1"
                disabled={statusOf("decision") === "generating"}
                onClick={() =>
                  void run("decision", "결정사항 로그", () =>
                    toast.success("결정사항 로그를 문서함에 저장했습니다."),
                  )
                }
              >
                {statusOf("decision") === "generating" ? (
                  <>
                    <Clock className="size-3.5 animate-spin" /> 문서화 중…
                  </>
                ) : (
                  <>
                    <Download className="size-3.5" /> 문서로 내보내기
                  </>
                )}
              </Button>
            )}
          </GeneratorCard>
        </div>
      </section>

      <TaskEditorDialog
        editor={editor}
        finalRequirements={finalRequirements}
        onChange={(task) =>
          setEditor((current) => (current ? { ...current, task } : current))
        }
        onClose={() => setEditor(null)}
        onSave={saveEditorTask}
      />
    </div>
  );
}

type StatusLabel = { text: string; tone: "success" | "warning" | "muted" };

function WbsWorkspace({
  result,
  finalRequirements,
  saving,
  onAdd,
  onEdit,
  onDelete,
  onMove,
  onResetFromAi,
  onSave,
  onOpenDocuments,
}: {
  result: WbsResult;
  finalRequirements: RequirementResponse[];
  saving: boolean;
  onAdd: () => void;
  onEdit: (task: WbsTask) => void;
  onDelete: (externalTaskId: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onResetFromAi: () => void;
  onSave: () => void;
  onOpenDocuments?: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Network className="size-4 text-muted-foreground" /> 요구사항 기반 WBS
              {result.finalConfirmed ? (
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                  최종 저장 완료
                </Badge>
              ) : (
                <Badge variant="outline">편집 중</Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              생성 버전 {result.agentVersion ?? "-"} · 최종 요구사항 {finalRequirements.length}건
            </CardDescription>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onResetFromAi}>
              <Copy className="size-3.5" /> AI 제안으로 초기화
            </Button>
            <Button variant="outline" size="sm" onClick={onAdd}>
              <Plus className="size-3.5" /> 작업 추가
            </Button>
            <Button size="sm" disabled={saving || result.finalTasks.length === 0} onClick={onSave}>
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              최종 WBS 저장
            </Button>
            {onOpenDocuments && (
              <Button variant="ghost" size="sm" onClick={onOpenDocuments}>
                문서함 <ArrowRight className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
          <WbsTaskTable
            title="AI 최초 제안"
            description="읽기 전용"
            tasks={result.aiSuggestionTasks}
          />
          <WbsTaskTable
            title="최종 WBS 편집 목록"
            description="추가·수정·삭제·순서 변경 가능"
            tasks={result.finalTasks}
            editable
            onEdit={onEdit}
            onDelete={onDelete}
            onMove={onMove}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function WbsTaskTable({
  title,
  description,
  tasks,
  editable = false,
  onEdit,
  onDelete,
  onMove,
}: {
  title: string;
  description: string;
  tasks: WbsTask[];
  editable?: boolean;
  onEdit?: (task: WbsTask) => void;
  onDelete?: (externalTaskId: string) => void;
  onMove?: (index: number, direction: -1 | 1) => void;
}) {
  return (
    <div className="min-w-0 rounded-lg border">
      <div className="border-b bg-muted/30 px-4 py-3">
        <div className="font-medium text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">순서</TableHead>
              <TableHead className="w-20">코드</TableHead>
              <TableHead className="min-w-52">작업</TableHead>
              <TableHead className="w-24">단계</TableHead>
              <TableHead className="w-20">공수</TableHead>
              <TableHead className="w-28">요구사항</TableHead>
              {editable && <TableHead className="w-40 text-right">편집</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task, index) => (
              <TableRow key={task.externalTaskId}>
                <TableCell className="text-muted-foreground">
                  {task.orderIndex}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-normal">
                    {task.taskCode}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="font-medium text-foreground">{task.taskName}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {task.description || task.externalTaskId}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {task.phase}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {task.estimatedHours}h
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {task.requirementIds.length > 0
                    ? task.requirementIds.join(", ")
                    : "-"}
                </TableCell>
                {editable && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={index === 0}
                        onClick={() => onMove?.(index, -1)}
                        aria-label="위로 이동"
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={index === tasks.length - 1}
                        onClick={() => onMove?.(index, 1)}
                        aria-label="아래로 이동"
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => onEdit?.(task)}
                        aria-label="작업 수정"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-red-700"
                        onClick={() => onDelete?.(task.externalTaskId)}
                        aria-label="작업 삭제"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}

            {tasks.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={editable ? 7 : 6}
                  className="py-10 text-center text-muted-foreground"
                >
                  등록된 작업이 없습니다.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function TaskEditorDialog({
  editor,
  finalRequirements,
  onChange,
  onClose,
  onSave,
}: {
  editor: EditorState;
  finalRequirements: RequirementResponse[];
  onChange: (task: WbsTask) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const task = editor?.task;

  return (
    <Dialog open={editor !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {editor && task && (
          <>
            <DialogHeader>
              <DialogTitle>
                {editor.mode === "new" ? "최종 WBS 작업 추가" : "최종 WBS 작업 수정"}
              </DialogTitle>
              <DialogDescription>
                저장 식별자는 externalTaskId이며, 요구사항 ID에는 최종 요구사항만 입력할 수 있습니다.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2 sm:grid-cols-2">
              <Field label="externalTaskId">
                <Input value={task.externalTaskId} readOnly className="bg-muted" />
              </Field>
              <Field label="부모 externalTaskId">
                <Input
                  value={task.parentExternalTaskId ?? ""}
                  placeholder="없으면 비워두기"
                  onChange={(event) =>
                    onChange({
                      ...task,
                      parentExternalTaskId: event.target.value || null,
                    })
                  }
                />
              </Field>
              <Field label="작업 코드">
                <Input
                  value={task.taskCode}
                  onChange={(event) =>
                    onChange({ ...task, taskCode: event.target.value })
                  }
                />
              </Field>
              <Field label="작업명">
                <Input
                  value={task.taskName}
                  onChange={(event) =>
                    onChange({ ...task, taskName: event.target.value })
                  }
                />
              </Field>
              <Field label="단계(phase)">
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  value={task.phase}
                  onChange={(event) =>
                    onChange({ ...task, phase: event.target.value })
                  }
                >
                  {WBS_PHASES.map((phase) => (
                    <option key={phase} value={phase}>
                      {phase}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="난이도">
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  value={task.difficulty}
                  onChange={(event) =>
                    onChange({ ...task, difficulty: event.target.value })
                  }
                >
                  {WBS_DIFFICULTIES.map((difficulty) => (
                    <option key={difficulty} value={difficulty}>
                      {difficulty}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="예상 공수(시간)">
                <Input
                  type="number"
                  min={0}
                  value={task.estimatedHours}
                  onChange={(event) =>
                    onChange({
                      ...task,
                      estimatedHours: Number(event.target.value),
                    })
                  }
                />
              </Field>
              <Field label="필요 기술(쉼표 구분)">
                <Input
                  value={task.requiredSkills.join(", ")}
                  placeholder="DOCUMENT_ANALYSIS, FRONTEND_DEVELOPMENT"
                  onChange={(event) =>
                    onChange({
                      ...task,
                      requiredSkills: parseStringList(event.target.value),
                    })
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="연결 요구사항 ID(쉼표 구분)">
                  <Input
                    value={task.requirementIds.join(", ")}
                    placeholder="10, 11"
                    onChange={(event) =>
                      onChange({
                        ...task,
                        requirementIds: parseNumberList(event.target.value),
                      })
                    }
                  />
                </Field>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {finalRequirements.map((requirement) => (
                    <button
                      type="button"
                      key={requirement.requirementId}
                      className={cn(
                        "rounded-full border px-2 py-1 text-xs",
                        task.requirementIds.includes(requirement.requirementId)
                          ? "border-blue-300 bg-blue-50 text-blue-700"
                          : "border-border text-muted-foreground",
                      )}
                      onClick={() => {
                        const included = task.requirementIds.includes(
                          requirement.requirementId,
                        );
                        onChange({
                          ...task,
                          requirementIds: included
                            ? task.requirementIds.filter(
                                (id) => id !== requirement.requirementId,
                              )
                            : [...task.requirementIds, requirement.requirementId],
                        });
                      }}
                    >
                      #{requirement.requirementId} {requirement.title}
                    </button>
                  ))}
                  {finalRequirements.length === 0 && (
                    <span className="text-xs text-red-600">
                      최종 요구사항이 없습니다.
                    </span>
                  )}
                </div>
              </div>
              <div className="sm:col-span-2">
                <Field label="작업 설명">
                  <Textarea
                    value={task.description}
                    rows={4}
                    onChange={(event) =>
                      onChange({ ...task, description: event.target.value })
                    }
                  />
                </Field>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                취소
              </Button>
              <Button onClick={onSave}>
                <Save className="size-4" /> 작업 반영
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="text-foreground">{label}</span>
      {children}
    </label>
  );
}

function WbsPreviewSkeleton() {
  return (
    <Card aria-busy="true" aria-label="WBS 불러오는 중">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
          <Clock className="size-4 animate-spin" /> WBS를 불러오는 중…
        </CardTitle>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-28" />
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((column) => (
          <div key={column} className="space-y-3 rounded-lg border p-4">
            <Skeleton className="h-5 w-32" />
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-center gap-3 border-t pt-3">
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function nextMonday(base: Date): Date {
  const date = new Date(base);
  const day = date.getDay();
  const add = (8 - (day || 7)) % 7 || 7;
  date.setDate(date.getDate() + add);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}

function buildSchedule(tasks: WbsTask[]) {
  const start = nextMonday(new Date());
  const durations = tasks.map((task) =>
    Math.max(1, Math.ceil(Math.max(1, task.estimatedHours) / 40)),
  );
  const totalWeeks = Math.max(
    1,
    durations.reduce((sum, duration) => sum + duration, 0),
  );
  let cursor = 0;

  const rows = tasks.map((task, index) => {
    const weeks = durations[index];
    const taskStart = new Date(start.getTime() + cursor * WEEK_MS);
    const taskEnd = new Date(
      start.getTime() + (cursor + weeks) * WEEK_MS - DAY_MS,
    );
    const offsetPct = (cursor / totalWeeks) * 100;
    const widthPct = (weeks / totalWeeks) * 100;
    cursor += weeks;
    return { task, start: taskStart, end: taskEnd, offsetPct, widthPct };
  });

  const end = rows[rows.length - 1]?.end ?? start;
  return { start, end, totalWeeks, rows };
}

function ScheduleGantt({
  tasks,
  registered,
  onRegister,
  onOpenDocuments,
}: {
  tasks: WbsTask[];
  registered: boolean;
  onRegister: () => void;
  onOpenDocuments?: () => void;
}) {
  const { start, end, totalWeeks, rows } = useMemo(
    () => buildSchedule(tasks),
    [tasks],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="leading-tight">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-4 text-muted-foreground" /> WBS 기반 일정 계획
          </CardTitle>
          <CardDescription className="mt-0.5">
            {formatDate(start)} ~ {formatDate(end)} · 약 {totalWeeks}주 · 예상 공수 기준
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast("날짜 조정 기능은 아직 연결되지 않았습니다.")}
        >
          <Pencil className="size-3.5" /> 날짜 조정
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">코드</TableHead>
              <TableHead>작업</TableHead>
              <TableHead className="w-40">기간</TableHead>
              <TableHead>타임라인</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.task.externalTaskId}>
                <TableCell>
                  <Badge variant="outline">{row.task.taskCode}</Badge>
                </TableCell>
                <TableCell>{row.task.taskName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(row.start)} ~ {formatDate(row.end)}
                </TableCell>
                <TableCell>
                  <div className="relative h-2.5 w-full rounded-full bg-muted">
                    <div
                      className="absolute top-0 h-2.5 rounded-full bg-blue-500"
                      style={{
                        left: `${row.offsetPct}%`,
                        width: `${row.widthPct}%`,
                      }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  일정으로 변환할 WBS 작업이 없습니다.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <span className="text-xs text-muted-foreground">
            40시간을 1주로 계산한 프론트 일정 미리보기입니다.
          </span>
          {registered ? (
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-50 font-normal text-emerald-700"
              >
                <CheckCircle2 className="size-3" /> 프로젝트 일정에 등록됨
              </Badge>
              {onOpenDocuments && (
                <Button variant="ghost" size="sm" onClick={onOpenDocuments}>
                  문서함 <ArrowRight className="size-3.5" />
                </Button>
              )}
            </div>
          ) : (
            <Button size="sm" disabled={tasks.length === 0} onClick={onRegister}>
              <CalendarClock className="size-3.5" /> 프로젝트 일정으로 등록
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SchedulePreviewSkeleton() {
  return (
    <Card aria-busy="true" aria-label="일정 계획 생성 중">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
          <Clock className="size-4 animate-spin" /> 일정 계획 생성 중…
        </CardTitle>
        <Skeleton className="h-8 w-24" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-2.5 flex-1 rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

function GeneratorCard({
  icon: Icon,
  title,
  description,
  status,
  statusLabel,
  children,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
  status: GenStatus;
  statusLabel: StatusLabel;
  children: React.ReactNode;
}) {
  const toneClass =
    statusLabel.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : statusLabel.tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-border bg-muted/40 text-muted-foreground";

  return (
    <Card className={cn("flex flex-col", status === "done" && "border-emerald-200/70")}>
      <CardContent className="flex flex-1 flex-col gap-3 pt-6">
        <div className="flex items-center gap-2">
          <Icon className="size-5 text-blue-600" />
          <span className="text-[15px] font-medium leading-tight text-foreground">
            {title}
          </span>
        </div>
        <CardDescription className="leading-relaxed">{description}</CardDescription>
        <Badge variant="outline" className={cn("w-fit font-normal", toneClass)}>
          {statusLabel.tone === "success" && <CheckCircle2 className="size-3" />}
          {statusLabel.tone === "warning" && <Clock className="size-3" />}
          {statusLabel.text}
        </Badge>
        <div className="mt-auto flex gap-2 pt-1">{children}</div>
      </CardContent>
    </Card>
  );
}
