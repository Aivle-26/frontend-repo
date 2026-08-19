import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  Loader2,
  Network,
  RefreshCw,
  Save,
} from "lucide-react";
import { toast } from "sonner";

import {
  ApiError,
  projectRepository,
  type SaveFinalWbsTask,
  type WbsResult,
  type WbsTask,
} from "@/app/api/projectRepository";
import { AiFeatureHeader } from "@/app/components/common/AiFeatureHeader";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { cn } from "@/app/components/ui/utils";
import type { ProjectSummary } from "@/app/projects/projectTypes";

function messageOf(error: unknown, fallback: string) {
  return error instanceof ApiError && error.message ? error.message : fallback;
}

function taskKey(task: WbsTask) {
  return task.externalTaskId;
}

function toSaveTask(task: WbsTask, orderIndex: number): SaveFinalWbsTask {
  return {
    externalTaskId: task.externalTaskId,
    parentExternalTaskId: task.parentExternalTaskId,
    taskCode: task.taskCode,
    taskName: task.taskName,
    description: task.description,
    phase: task.phase,
    requiredSkills: task.requiredSkills,
    difficulty: task.difficulty,
    estimatedHours: task.estimatedHours,
    orderIndex,
    requirementIds: task.requirementIds,
    relatedArtifacts: task.relatedArtifacts ?? [],
    completionCriteria: task.completionCriteria ?? [],
  };
}

function getTaskLevel(task: WbsTask, taskByExternalId: Map<string, WbsTask>) {
  if (Number.isInteger(task.level) && Number(task.level) > 0) {
    return Number(task.level) - 1;
  }

  let level = 0;
  let parentId = task.parentExternalTaskId;
  const visited = new Set<string>();

  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    const parent = taskByExternalId.get(parentId);
    if (!parent) break;
    level += 1;
    parentId = parent.parentExternalTaskId;
  }

  return level;
}

export function PmWbs({
  project,
  onNavigateNext,
}: {
  project: ProjectSummary;
  onNavigateNext?: () => void;
}) {
  const [result, setResult] = useState<WbsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedExternalId, setSelectedExternalId] = useState<string | null>(null);

  const loadWbs = async () => {
    setLoading(true);
    setError("");
    try {
      const loaded = await projectRepository.getWbs(project.id);
      setResult(loaded);
      const visibleTasks = loaded.finalConfirmed
        ? loaded.finalTasks
        : loaded.aiSuggestionTasks.length > 0
          ? loaded.aiSuggestionTasks
          : loaded.finalTasks;
      setSelectedExternalId((current) =>
        visibleTasks.some((task) => task.externalTaskId === current)
          ? current
          : visibleTasks[0]?.externalTaskId ?? null,
      );
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) {
        setResult(null);
        setSelectedExternalId(null);
      } else {
        setError(messageOf(caught, "WBS를 불러오지 못했습니다."));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWbs();
    // project.id가 바뀌면 해당 프로젝트 WBS를 다시 조회합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const tasks = useMemo(() => {
    if (!result) return [];
    const source = result.finalConfirmed
      ? result.finalTasks
      : result.aiSuggestionTasks.length > 0
        ? result.aiSuggestionTasks
        : result.finalTasks;
    return [...source].sort((a, b) => a.orderIndex - b.orderIndex);
  }, [result]);

  const taskByExternalId = useMemo(
    () => new Map(tasks.map((task) => [task.externalTaskId, task])),
    [tasks],
  );

  const selectedTask =
    tasks.find((task) => task.externalTaskId === selectedExternalId) ?? tasks[0] ?? null;

  const linkedRequirementCount = useMemo(
    () => new Set(tasks.flatMap((task) => task.requirementIds)).size,
    [tasks],
  );

  const linkedArtifactCount = useMemo(
    () =>
      new Set(
        tasks.flatMap((task) =>
          (task.relatedArtifacts ?? []).map(
            (artifact) => `${artifact.artifactType}:${artifact.artifactName}:${artifact.requiredVersion ?? ""}`,
          ),
        ),
      ).size,
    [tasks],
  );

  const generateWbs = async () => {
    setGenerating(true);
    setError("");
    try {
      const generated = await projectRepository.generateWbs(project.id);
      const loaded = generated ?? (await projectRepository.getWbs(project.id));
      setResult(loaded);
      const visibleTasks = loaded.finalConfirmed
        ? loaded.finalTasks
        : loaded.aiSuggestionTasks.length > 0
          ? loaded.aiSuggestionTasks
          : loaded.finalTasks;
      setSelectedExternalId(visibleTasks[0]?.externalTaskId ?? null);
      toast.success("AI WBS 생성이 완료되었습니다.");
    } catch (caught) {
      const message = messageOf(caught, "AI WBS 생성에 실패했습니다.");
      setError(message);
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const confirmFinalWbs = async () => {
    if (!result || tasks.length === 0) return;

    setSaving(true);
    setError("");
    try {
      const saved = await projectRepository.saveFinalWbs(project.id, {
        tasks: tasks.map(toSaveTask),
      });
      setResult(saved);
      toast.success("최종 WBS를 확정했습니다.");
    } catch (caught) {
      const message = messageOf(caught, "최종 WBS 저장에 실패했습니다.");
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="border-teal-200/80 bg-gradient-to-br from-white via-cyan-50/45 to-teal-50/70 dark:border-violet-900/70 dark:from-zinc-950 dark:via-violet-950/20 dark:to-purple-950/35">
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <AiFeatureHeader
            icon={Network}
            title="WBS 생성 결과"
            description="확정 요구사항을 바탕으로 생성된 작업 구조를 검토하고 최종 WBS로 확정합니다."
            titleClassName="text-xl font-semibold tracking-tight"
            descriptionClassName="text-[0.82rem] leading-5"
          />

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void loadWbs()} disabled={loading || generating}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              새로고침
            </Button>
            <Button onClick={() => void generateWbs()} disabled={generating || saving}>
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Network className="size-4" />}
              {result ? "AI WBS 다시 생성" : "AI WBS 생성"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <Card>
          <CardContent className="flex min-h-72 items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" /> WBS를 불러오는 중입니다.
          </CardContent>
        </Card>
      ) : !result || tasks.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
              <Network className="size-7 text-muted-foreground" />
            </div>
            <div>
              <div className="text-base font-semibold text-foreground">생성된 WBS가 없습니다.</div>
              <div className="mt-1 text-[0.82rem] leading-5 text-muted-foreground">
                최종 요구사항이 저장된 뒤 AI WBS 생성을 실행하세요.
              </div>
            </div>
            <Button onClick={() => void generateWbs()} disabled={generating}>
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Network className="size-4" />}
              AI WBS 생성
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard icon={Network} label="WBS 작업" value={`${tasks.length}개`} />
            <SummaryCard icon={FileCheck2} label="연결 요구사항" value={`${linkedRequirementCount}건`} />
            <SummaryCard
              icon={CheckCircle2}
              label="연결 산출물"
              value={linkedArtifactCount > 0 ? `${linkedArtifactCount}건` : "연결 정보 없음"}
              muted={linkedArtifactCount === 0}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.4fr)]">
            <Card className="min-w-0 overflow-hidden border-teal-100/90 bg-white/95 dark:border-violet-900/70 dark:bg-zinc-950/90">
              <CardHeader className="border-b border-teal-100/80 bg-gradient-to-r from-cyan-50/70 to-teal-50/50 dark:border-violet-900/60 dark:from-violet-950/30 dark:to-purple-950/20">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl border border-teal-200 bg-white text-teal-700 shadow-sm dark:border-violet-800 dark:bg-black/30 dark:text-violet-200">
                    <Network className="size-[18px]" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold tracking-tight">WBS 계층 구조</CardTitle>
                    <p className="mt-1 text-[0.82rem] leading-5 text-muted-foreground">
                      작업을 선택하면 오른쪽에서 연결 정보와 완료 조건을 확인할 수 있습니다.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="max-h-[640px] space-y-1.5 overflow-y-auto bg-gradient-to-b from-white to-teal-50/20 p-3 dark:from-zinc-950 dark:to-violet-950/10">
                {tasks.map((task) => {
                  const level = getTaskLevel(task, taskByExternalId);
                  const active = selectedTask?.externalTaskId === task.externalTaskId;
                  return (
                    <button
                      key={taskKey(task)}
                      type="button"
                      onClick={() => setSelectedExternalId(task.externalTaskId)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-lg border px-3 py-3 text-left transition-all",
                        active
                          ? "border-teal-300 bg-gradient-to-r from-teal-50 to-cyan-50/70 text-teal-950 shadow-sm dark:border-violet-700 dark:from-violet-950/55 dark:to-purple-950/35 dark:text-violet-50"
                          : "border-transparent hover:border-teal-100 hover:bg-teal-50/55 dark:hover:border-violet-900/70 dark:hover:bg-violet-950/25",
                      )}
                      style={{ paddingLeft: `${12 + Math.min(level, 6) * 18}px` }}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md",
                          active
                            ? "bg-teal-600 text-white dark:bg-violet-600"
                            : "bg-teal-50 text-teal-700 dark:bg-violet-950/55 dark:text-violet-300",
                        )}
                      >
                        {level > 0 ? <ChevronRight className="size-3.5" /> : <Network className="size-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-mono text-[0.72rem] font-semibold text-teal-700 dark:text-violet-300">
                            {task.taskCode}
                          </span>
                          <span className="truncate text-[0.9rem] font-semibold">{task.taskName}</span>
                        </span>
                        <span className="mt-1 block truncate text-[0.78rem] text-muted-foreground">
                          {task.itemType ?? task.phase}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader className="border-b">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-mono">{selectedTask?.taskCode}</Badge>
                      <CardTitle className="text-lg font-semibold tracking-tight">{selectedTask?.taskName}</CardTitle>
                    </div>
                    <p className="mt-2 text-[0.82rem] leading-5 text-muted-foreground">
                      {selectedTask?.description || "상세 설명이 없습니다."}
                    </p>
                  </div>
                  <Badge variant="secondary">{selectedTask?.itemType ?? selectedTask?.phase}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <DetailBlock title="연결 요구사항">
                  <div className="flex flex-wrap gap-2">
                    {selectedTask && selectedTask.requirementIds.length > 0 ? (
                      selectedTask.requirementIds.map((id) => (
                        <Badge key={id} variant="outline">REQ-{id}</Badge>
                      ))
                    ) : (
                      <EmptyDetail />
                    )}
                  </div>
                </DetailBlock>

                <DetailBlock title="관련 산출물">
                  {selectedTask && (selectedTask.relatedArtifacts?.length ?? 0) > 0 ? (
                    <div className="space-y-2">
                      {selectedTask.relatedArtifacts!.map((artifact) => (
                        <div key={`${artifact.artifactType}:${artifact.artifactName}`} className="rounded-lg border px-3 py-2 text-sm">
                          <div className="font-medium">{artifact.artifactName}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {artifact.artifactType}{artifact.requiredVersion ? ` · v${artifact.requiredVersion}` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyDetail />
                  )}
                </DetailBlock>

                <DetailBlock title="완료 조건">
                  {selectedTask && (selectedTask.completionCriteria?.length ?? 0) > 0 ? (
                    <ul className="space-y-2 text-sm text-foreground">
                      {selectedTask.completionCriteria!.map((criterion) => (
                        <li key={criterion} className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                          <span>{criterion}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyDetail />
                  )}
                </DetailBlock>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Meta
                    label="난이도"
                    value={
                      selectedTask && selectedTask.difficulty && selectedTask.difficulty !== "UNSPECIFIED"
                        ? selectedTask.difficulty
                        : "API 반환 없음"
                    }
                  />
                  <Meta
                    label="예상 공수"
                    value={
                      selectedTask && selectedTask.estimatedHours > 0
                        ? `${selectedTask.estimatedHours}시간`
                        : "API 반환 없음"
                    }
                  />
                  <div>
                    <div className="text-xs text-muted-foreground">필요 기술</div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {(selectedTask?.requiredSkills ?? []).map((skill) => (
                        <Badge key={skill} variant="outline">{skill}</Badge>
                      ))}
                      {(selectedTask?.requiredSkills.length ?? 0) === 0 && (
                        <span className="text-sm text-foreground">-</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-medium text-foreground">
                {result.finalConfirmed ? "최종 WBS가 확정되었습니다." : "AI 생성 결과를 최종 WBS로 확정하세요."}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                일정 추천은 확정된 WBS의 실제 DB 식별자를 사용합니다.
              </div>
            </div>
            <Button
              onClick={() => void confirmFinalWbs()}
              disabled={saving || result.finalConfirmed || tasks.length === 0}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {result.finalConfirmed ? "최종 확정 완료" : "최종 WBS 확정"}
            </Button>
          </div>
        </>
      )}

      {onNavigateNext && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={onNavigateNext}>
            일정 화면으로 이동 <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  muted = false,
}: {
  icon: typeof Network;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <Card className="border-teal-100/90 bg-gradient-to-br from-white to-teal-50/55 dark:border-violet-900/70 dark:from-zinc-950 dark:to-violet-950/25">
      <CardContent className="flex items-center justify-between gap-4 pt-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-teal-200 bg-white text-teal-700 shadow-sm dark:border-violet-800 dark:bg-black/30 dark:text-violet-200">
            <Icon className="size-5" />
          </div>
          <div className="truncate text-sm font-medium text-muted-foreground">{label}</div>
        </div>
        <div
          className={cn(
            "shrink-0 border-l border-teal-100 pl-4 text-right font-semibold tracking-[-0.02em] dark:border-violet-900/70",
            muted
              ? "text-[0.84rem] text-muted-foreground"
              : "text-xl text-teal-800 dark:text-violet-200",
          )}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function EmptyDetail() {
  return <div className="text-sm text-muted-foreground">API 응답에 제공된 정보가 없습니다.</div>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock3 className="size-3.5" /> {label}
      </div>
      <div className="mt-1 break-words text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}
