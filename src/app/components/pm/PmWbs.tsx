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

export function PmWbs({ project }: { project: ProjectSummary }) {
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
      <Card className="border-blue-100 bg-blue-50/50">
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Network className="size-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">WBS 생성 결과</h2>
                <Badge variant="secondary">{project.name}</Badge>
                {result?.finalConfirmed ? (
                  <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">최종 확정</Badge>
                ) : result ? (
                  <Badge variant="outline">확정 전</Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                확정 요구사항을 기반으로 AI가 생성한 WBS를 조회하고 최종 확정합니다.
              </p>
            </div>
          </div>

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
              <div className="font-medium text-foreground">생성된 WBS가 없습니다.</div>
              <div className="mt-1 text-sm text-muted-foreground">
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
              value={linkedArtifactCount > 0 ? `${linkedArtifactCount}건` : "API 반환 없음"}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.4fr)]">
            <Card className="min-w-0">
              <CardHeader className="border-b">
                <CardTitle className="text-base">WBS 계층 구조</CardTitle>
              </CardHeader>
              <CardContent className="max-h-[640px] space-y-1 overflow-y-auto p-3">
                {tasks.map((task) => {
                  const level = getTaskLevel(task, taskByExternalId);
                  const active = selectedTask?.externalTaskId === task.externalTaskId;
                  return (
                    <button
                      key={taskKey(task)}
                      type="button"
                      onClick={() => setSelectedExternalId(task.externalTaskId)}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-xl px-3 py-3 text-left transition-colors",
                        active ? "bg-blue-50 text-blue-900" : "hover:bg-muted/60",
                      )}
                      style={{ paddingLeft: `${12 + Math.min(level, 6) * 18}px` }}
                    >
                      {level > 0 ? <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> : <Network className="mt-0.5 size-4 shrink-0 text-blue-600" />}
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="font-mono text-[11px]">{task.taskCode}</Badge>
                          <span className="truncate font-medium">{task.taskName}</span>
                        </span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
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
                      <CardTitle className="text-lg">{selectedTask?.taskName}</CardTitle>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
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
                  <Meta label="필요 기술" value={selectedTask?.requiredSkills.join(", ") || "-"} />
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
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Network;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-6">
        <div className="flex size-10 items-center justify-center rounded-xl bg-muted">
          <Icon className="size-5 text-blue-600" />
        </div>
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-1 text-xl font-semibold text-foreground">{value}</div>
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
