import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Copy,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
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
import { Textarea } from "@/app/components/ui/textarea";
import { cn } from "@/app/components/ui/utils";
import {
  ApiError,
  projectRepository,
  type RequirementPriority,
  type RequirementResponse,
  type RequirementType,
  type RequirementsResult,
  type SaveFinalRequirement,
} from "@/app/api/projectRepository";
import type { ProjectSummary } from "@/app/data/demoData";

interface PmRequirementsProps {
  project: ProjectSummary;
  onBackToGeneration?: () => void;
}

type EditableRequirement = Omit<
  SaveFinalRequirement,
  "sourceDocumentId" | "externalReferenceId"
> & {
  sourceDocumentId: number | null;
  externalReferenceId: number | null;
  clientId: string;
};

type RequirementEditorState =
  | {
      mode: "new" | "edit";
      item: EditableRequirement;
      originalClientId: string;
    }
  | null;

const REQUIREMENT_TYPES: RequirementType[] = [
  "FUNCTIONAL",
  "NON_FUNCTIONAL",
  "SECURITY",
  "DATA",
  "INTERFACE",
  "OPERATION",
  "PROJECT_MANAGEMENT",
  "UNSPECIFIED",
];

const PRIORITIES: RequirementPriority[] = [
  "HIGH",
  "MEDIUM",
  "LOW",
  "UNSPECIFIED",
];

const TYPE_LABELS: Record<string, string> = {
  FUNCTIONAL: "기능",
  NON_FUNCTIONAL: "비기능",
  SECURITY: "보안",
  DATA: "데이터",
  INTERFACE: "인터페이스",
  OPERATION: "운영",
  PROJECT_MANAGEMENT: "프로젝트 관리",
  UNSPECIFIED: "미지정",
};

function typeLabel(type: string) {
  return TYPE_LABELS[type] ?? type;
}

function priorityLabel(priority: string) {
  if (priority === "HIGH") return "높음";
  if (priority === "MEDIUM") return "중간";
  if (priority === "LOW") return "낮음";
  return "미지정";
}

function typeTone(type: string) {
  const tones: Record<string, string> = {
    FUNCTIONAL: "text-cyan-700 dark:text-cyan-300",
    NON_FUNCTIONAL: "text-sky-700 dark:text-sky-300",
    SECURITY: "text-violet-700 dark:text-violet-300",
    DATA: "text-teal-700 dark:text-teal-300",
    INTERFACE: "text-indigo-700 dark:text-indigo-300",
    OPERATION: "text-amber-700 dark:text-amber-300",
    PROJECT_MANAGEMENT: "text-emerald-700 dark:text-emerald-300",
  };
  return tones[type] ?? "text-muted-foreground";
}

function priorityTone(priority: string) {
  if (priority === "HIGH") return "text-rose-700 dark:text-rose-300";
  if (priority === "MEDIUM") return "text-amber-700 dark:text-amber-300";
  if (priority === "LOW") return "text-slate-600 dark:text-slate-300";
  return "text-muted-foreground";
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError && error.message ? error.message : fallback;
}

function createClientId(prefix = "req") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toEditable(item: RequirementResponse): EditableRequirement {
  return {
    clientId: `server-${item.requirementId}`,
    requirementId: item.requirementId,
    analysisResultId: item.analysisResultId,
    sourceDocumentId: item.sourceDocumentId,
    externalReferenceId: item.externalReferenceId,
    type: item.type,
    title: item.title,
    description: item.description,
    acceptanceCriteria: item.acceptanceCriteria,
    dueDate: item.dueDate,
    deliverableName: item.deliverableName,
    securityCondition: item.securityCondition,
    sourceDocumentName: item.sourceDocumentName,
    sourceExcerpt: item.sourceExcerpt,
    priority: item.priority,
  };
}

function normalizeResult(
  result: RequirementsResult,
): {
  aiSuggestions: RequirementResponse[];
  finalItems: EditableRequirement[];
} {
  return {
    aiSuggestions: Array.isArray(result.aiSuggestions)
      ? result.aiSuggestions
      : [],
    finalItems: Array.isArray(result.finalRequirements)
      ? result.finalRequirements.map(toEditable)
      : [],
  };
}

function nextExternalReferenceId(
  aiSuggestions: RequirementResponse[],
  finalItems: EditableRequirement[],
) {
  const values = [...aiSuggestions, ...finalItems]
    .map((item) => Number(item.externalReferenceId))
    .filter((value) => Number.isInteger(value) && value > 0);

  return values.length === 0 ? 1 : Math.max(...values) + 1;
}

function createEmptyRequirement(
  aiSuggestions: RequirementResponse[],
  finalItems: EditableRequirement[],
): EditableRequirement {
  const source =
    finalItems.find((item) => item.sourceDocumentId !== null) ??
    aiSuggestions.find((item) => item.sourceDocumentId !== null);

  return {
    clientId: createClientId("new"),
    requirementId: null,
    analysisResultId: source?.analysisResultId ?? null,
    sourceDocumentId: source?.sourceDocumentId ?? null,
    externalReferenceId: nextExternalReferenceId(aiSuggestions, finalItems),
    type: "FUNCTIONAL",
    title: "",
    description: "",
    acceptanceCriteria: null,
    dueDate: null,
    deliverableName: null,
    securityCondition: null,
    sourceDocumentName: source?.sourceDocumentName ?? null,
    sourceExcerpt: null,
    priority: "MEDIUM",
  };
}

function toSavePayload(item: EditableRequirement): SaveFinalRequirement {
  return {
    requirementId: item.requirementId,
    analysisResultId: item.analysisResultId,
    sourceDocumentId: Number(item.sourceDocumentId),
    externalReferenceId: Number(item.externalReferenceId),
    type: item.type,
    title: item.title.trim(),
    description: item.description.trim(),
    acceptanceCriteria: item.acceptanceCriteria?.trim() || null,
    dueDate: item.dueDate || null,
    deliverableName: item.deliverableName?.trim() || null,
    securityCondition: item.securityCondition?.trim() || null,
    sourceDocumentName: item.sourceDocumentName?.trim() || null,
    sourceExcerpt: item.sourceExcerpt?.trim() || null,
    priority: item.priority,
  };
}

export function PmRequirements({
  project,
  onBackToGeneration,
}: PmRequirementsProps) {
  const [aiSuggestions, setAiSuggestions] = useState<RequirementResponse[]>([]);
  const [finalItems, setFinalItems] = useState<EditableRequirement[]>([]);
  const [lastSavedItems, setLastSavedItems] = useState<EditableRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiUpdating, setAiUpdating] = useState(false);
  const [editor, setEditor] = useState<RequirementEditorState>(null);

  const loadRequirements = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const result = normalizeResult(
        await projectRepository.getRequirements(project.id),
      );
      setAiSuggestions(result.aiSuggestions);
      setFinalItems(result.finalItems);
      setLastSavedItems(result.finalItems);
    } catch (error) {
      setAiSuggestions([]);
      setFinalItems([]);
      setLastSavedItems([]);
      setLoadError(errorMessage(error, "요구사항을 불러오지 못했습니다."));
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    void loadRequirements();
  }, [loadRequirements]);

  // [AI 업데이트] 업로드된 문서에서 요구사항을 다시 추출(재분석)한 뒤 다시 불러온다.
  const aiUpdateRequirements = async () => {
    if (aiUpdating || loading || saving) return;
    setAiUpdating(true);
    try {
      await projectRepository.reanalyzeProjectRequirements(project.id);
      await loadRequirements();
      toast.success("업로드된 문서에서 요구사항을 다시 추출했습니다.");
    } catch (error) {
      toast.error(errorMessage(error, "AI 업데이트에 실패했습니다."));
    } finally {
      setAiUpdating(false);
    }
  };

  const moveRequirement = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= finalItems.length) return;

    const next = [...finalItems];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setFinalItems(next);
  };

  const removeRequirement = (clientId: string) => {
    setFinalItems((current) =>
      current.filter((item) => item.clientId !== clientId),
    );
    toast.success("최종 편집본에서 요구사항을 삭제했습니다.");
  };

  const resetFromAi = () => {
    const copied = aiSuggestions.map((item, index) => ({
      ...toEditable(item),
      clientId: `ai-copy-${item.requirementId}-${index}`,
    }));
    setFinalItems(copied);
    toast.success("AI 최초 제안을 최종 편집본에 복사했습니다.");
  };

  const restoreLastSaved = () => {
    setFinalItems(lastSavedItems.map((item) => ({ ...item })));
    toast.success("마지막 저장 상태로 복원했습니다.");
  };

  const saveEditorItem = () => {
    if (!editor) return;

    const item = {
      ...editor.item,
      title: editor.item.title.trim(),
      description: editor.item.description.trim(),
    };

    if (!Number.isInteger(Number(item.sourceDocumentId)) || Number(item.sourceDocumentId) <= 0) {
      toast.error("sourceDocumentId는 1 이상의 정수여야 합니다.");
      return;
    }

    if (
      !Number.isInteger(Number(item.externalReferenceId)) ||
      Number(item.externalReferenceId) <= 0
    ) {
      toast.error("externalReferenceId는 1 이상의 정수여야 합니다.");
      return;
    }

    if (!item.title) {
      toast.error("요구사항 제목을 입력하세요.");
      return;
    }

    if (!item.description) {
      toast.error("요구사항 설명을 입력하세요.");
      return;
    }

    const duplicateExternalReference = finalItems.some(
      (current) =>
        current.clientId !== editor.originalClientId &&
        Number(current.externalReferenceId) === Number(item.externalReferenceId),
    );

    if (duplicateExternalReference) {
      toast.error("externalReferenceId가 중복되었습니다.");
      return;
    }

    if (editor.mode === "new") {
      setFinalItems((current) => [...current, item]);
    } else {
      setFinalItems((current) =>
        current.map((current) =>
          current.clientId === editor.originalClientId ? item : current,
        ),
      );
    }

    setEditor(null);
    toast.success(
      editor.mode === "new"
        ? "요구사항을 최종 편집본에 추가했습니다."
        : "요구사항을 수정했습니다.",
    );
  };

  const validateAndBuildPayload = (): SaveFinalRequirement[] | null => {
    if (finalItems.length === 0) {
      toast.error("최종 요구사항은 최소 1건 이상이어야 합니다.");
      return null;
    }

    const externalReferenceIds = new Set<number>();

    for (const item of finalItems) {
      const sourceDocumentId = Number(item.sourceDocumentId);
      const externalReferenceId = Number(item.externalReferenceId);

      if (!Number.isInteger(sourceDocumentId) || sourceDocumentId <= 0) {
        toast.error(`“${item.title || "제목 없음"}”의 sourceDocumentId를 확인하세요.`);
        return null;
      }

      if (!Number.isInteger(externalReferenceId) || externalReferenceId <= 0) {
        toast.error(
          `“${item.title || "제목 없음"}”의 externalReferenceId를 확인하세요.`,
        );
        return null;
      }

      if (externalReferenceIds.has(externalReferenceId)) {
        toast.error(`externalReferenceId ${externalReferenceId}가 중복되었습니다.`);
        return null;
      }
      externalReferenceIds.add(externalReferenceId);

      if (!item.type || !item.title.trim() || !item.description.trim() || !item.priority) {
        toast.error("모든 요구사항의 유형·제목·설명·우선순위를 입력하세요.");
        return null;
      }
    }

    return finalItems.map(toSavePayload);
  };

  const saveFinalRequirements = async (moveNext: boolean) => {
    const requirements = validateAndBuildPayload();
    if (!requirements) return;

    setSaving(true);
    try {
      const result = normalizeResult(
        await projectRepository.saveFinalRequirements(project.id, {
          requirements,
        }),
      );

      setAiSuggestions(result.aiSuggestions);
      setFinalItems(result.finalItems);
      setLastSavedItems(result.finalItems);

      if (moveNext) {
        await projectRepository.confirmAllRequirements(project.id);
        toast.success("최종 요구사항을 저장하고 확정했습니다.");
        onBackToGeneration?.();
      } else {
        toast.success("최종 요구사항을 저장했습니다.");
      }
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          moveNext
            ? "요구사항 저장 또는 확정에 실패했습니다."
            : "최종 요구사항 저장에 실패했습니다.",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const itemCountLabel = useMemo(
    () => `AI 제안 ${aiSuggestions.length}건 · 최종 편집본 ${finalItems.length}건`,
    [aiSuggestions.length, finalItems.length],
  );

  return (
    <div className="space-y-4">
      {onBackToGeneration && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 gap-2"
          disabled={saving}
          onClick={onBackToGeneration}
        >
          <ArrowLeft className="size-4" />
          AI 생성으로 돌아가기
        </Button>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                <FileText className="size-5 text-primary" /> 요구사항 검토
              </CardTitle>
              <CardDescription className="mt-1 text-sm leading-5">
                {project.name} · {itemCountLabel}
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={loading || saving || aiUpdating}
                onClick={() => void aiUpdateRequirements()}
                title="업로드된 문서에서 요구사항을 다시 추출해 반영합니다"
              >
                {aiUpdating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                AI 업데이트
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading || saving || aiUpdating}
                onClick={() => void loadRequirements()}
              >
                <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
                다시 조회
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading || saving || aiSuggestions.length === 0}
                onClick={resetFromAi}
              >
                <Copy className="size-3.5" />
                AI 제안 복사
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading || saving}
                onClick={restoreLastSaved}
              >
                마지막 저장값 복원
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading || saving}
                onClick={() => {
                  const item = createEmptyRequirement(aiSuggestions, finalItems);
                  setEditor({
                    mode: "new",
                    item,
                    originalClientId: item.clientId,
                  });
                }}
              >
                <Plus className="size-3.5" />
                요구사항 추가
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {loadError && (
            <Alert variant="destructive">
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              요구사항을 불러오는 중입니다.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
              <RequirementTable
                title="AI 최초 제안"
                description="AI가 처음 추출한 요구사항입니다."
                items={aiSuggestions}
              />
              <EditableRequirementTable
                items={finalItems}
                onMove={moveRequirement}
                onEdit={(item) =>
                  setEditor({
                    mode: "edit",
                    item: { ...item },
                    originalClientId: item.clientId,
                  })
                }
                onDelete={removeRequirement}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <span className="max-w-2xl text-sm leading-5 text-muted-foreground">
              최종 편집본 전체를 저장합니다. 삭제한 항목은 저장 대상에서 제외됩니다.
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={loading || saving}
                onClick={() => void saveFinalRequirements(false)}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                저장
              </Button>
              {onBackToGeneration && (
                <Button
                  type="button"
                  disabled={loading || saving}
                  onClick={() => void saveFinalRequirements(true)}
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ArrowRight className="size-4" />
                  )}
                  저장 후 WBS
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <RequirementEditorDialog
        editor={editor}
        onChange={(item) =>
          setEditor((current) => (current ? { ...current, item } : current))
        }
        onClose={() => setEditor(null)}
        onSave={saveEditorItem}
      />
    </div>
  );
}

function RequirementTable({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: RequirementResponse[];
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-border/80 bg-card">
      <div className="border-b border-border/70 bg-muted/25 px-5 py-4">
        <div className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </div>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="space-y-3 p-4">
        {items.map((item, index) => (
          <article
            key={item.requirementId}
            className="rounded-xl border border-border/75 bg-background/80 p-4 shadow-sm transition-colors hover:border-primary/25 hover:bg-primary/[0.02]"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5">
              <span className="font-semibold text-muted-foreground">#{index + 1}</span>
              <span aria-hidden="true" className="text-border">·</span>
              <span className="font-semibold text-cyan-700 dark:text-cyan-300">
                {typeLabel(item.type)}
              </span>
              <span aria-hidden="true" className="text-border">·</span>
              <span className={cn("font-semibold", priorityTone(item.priority))}>
                우선순위 {priorityLabel(item.priority)}
              </span>
            </div>

            <h3 className="mt-3 break-words text-base font-semibold leading-6 text-foreground">
              {item.title || "제목 없음"}
            </h3>
            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
              {item.description || "설명 없음"}
            </p>

            {item.sourceDocumentName && (
              <div className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                출처 · {item.sourceDocumentName}
              </div>
            )}
          </article>
        ))}

        {items.length === 0 && (
          <div className="rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted-foreground">
            AI 제안 요구사항이 없습니다.
          </div>
        )}
      </div>
    </section>
  );
}

function EditableRequirementTable({
  items,
  onMove,
  onEdit,
  onDelete,
}: {
  items: EditableRequirement[];
  onMove: (index: number, direction: -1 | 1) => void;
  onEdit: (item: EditableRequirement) => void;
  onDelete: (clientId: string) => void;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-primary/20 bg-card">
      <div className="border-b border-primary/15 bg-primary/[0.035] px-5 py-4">
        <div className="text-lg font-semibold tracking-tight text-foreground">
          최종 요구사항 편집본
        </div>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          수정할 내용을 정리하고 순서를 조정하세요.
        </p>
      </div>

      <div className="space-y-3 p-4">
        {items.map((item, index) => (
          <article
            key={item.clientId}
            className="rounded-xl border border-border/75 bg-background/85 p-4 shadow-sm transition-colors hover:border-primary/30"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5">
              <span className="font-semibold text-muted-foreground">#{index + 1}</span>
              <span aria-hidden="true" className="text-border">·</span>
              <span className="font-semibold text-cyan-700 dark:text-cyan-300">
                {typeLabel(item.type)}
              </span>
              <span aria-hidden="true" className="text-border">·</span>
              <span className={cn("font-semibold", priorityTone(item.priority))}>
                우선순위 {priorityLabel(item.priority)}
              </span>
            </div>

            <h3 className="mt-3 break-words text-base font-semibold leading-6 text-foreground">
              {item.title || "제목 없음"}
            </h3>
            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
              {item.description || "설명 없음"}
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-1.5 border-t border-border/60 pt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 rounded-md px-2.5 text-xs"
                disabled={index === 0}
                onClick={() => onMove(index, -1)}
                aria-label="위로 이동"
              >
                <ArrowUp className="size-3.5" />
                위로
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 rounded-md px-2.5 text-xs"
                disabled={index === items.length - 1}
                onClick={() => onMove(index, 1)}
                aria-label="아래로 이동"
              >
                <ArrowDown className="size-3.5" />
                아래로
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 rounded-md px-2.5 text-xs text-primary hover:bg-primary/5 hover:text-primary"
                onClick={() => onEdit(item)}
                aria-label="요구사항 수정"
              >
                <Pencil className="size-3.5" />
                수정
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 rounded-md px-2.5 text-xs text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/30"
                onClick={() => onDelete(item.clientId)}
                aria-label="요구사항 삭제"
              >
                <Trash2 className="size-3.5" />
                삭제
              </Button>
            </div>
          </article>
        ))}

        {items.length === 0 && (
          <div className="rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm leading-6 text-muted-foreground">
            최종 편집본이 없습니다.<br />AI 제안을 복사하거나 요구사항을 추가하세요.
          </div>
        )}
      </div>
    </section>
  );
}

function RequirementEditorDialog({
  editor,
  onChange,
  onClose,
  onSave,
}: {
  editor: RequirementEditorState;
  onChange: (item: EditableRequirement) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const item = editor?.item;

  return (
    <Dialog open={editor !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {editor && item && (
          <>
            <DialogHeader>
              <DialogTitle>
                {editor.mode === "new" ? "최종 요구사항 추가" : "최종 요구사항 수정"}
              </DialogTitle>
              <DialogDescription>
                출처 문서 ID와 요구사항 참조 번호는 필수입니다.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2 sm:grid-cols-2">
              <Field label="출처 문서 ID">
                <Input
                  type="number"
                  min={1}
                  value={item.sourceDocumentId ?? ""}
                  onChange={(event) =>
                    onChange({
                      ...item,
                      sourceDocumentId: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                />
              </Field>
              <Field label="요구사항 참조 번호">
                <Input
                  type="number"
                  min={1}
                  value={item.externalReferenceId ?? ""}
                  onChange={(event) =>
                    onChange({
                      ...item,
                      externalReferenceId: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                />
              </Field>
              <Field label="유형">
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  value={item.type}
                  onChange={(event) =>
                    onChange({ ...item, type: event.target.value })
                  }
                >
                  {REQUIREMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {typeLabel(type)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="우선순위">
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  value={item.priority}
                  onChange={(event) =>
                    onChange({ ...item, priority: event.target.value })
                  }
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priorityLabel(priority)}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="제목">
                  <Input
                    value={item.title}
                    onChange={(event) =>
                      onChange({ ...item, title: event.target.value })
                    }
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="설명">
                  <Textarea
                    rows={4}
                    value={item.description}
                    onChange={(event) =>
                      onChange({ ...item, description: event.target.value })
                    }
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="완료 기준">
                  <Textarea
                    rows={3}
                    value={item.acceptanceCriteria ?? ""}
                    onChange={(event) =>
                      onChange({
                        ...item,
                        acceptanceCriteria: event.target.value || null,
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="마감일">
                <Input
                  type="date"
                  value={item.dueDate ?? ""}
                  onChange={(event) =>
                    onChange({ ...item, dueDate: event.target.value || null })
                  }
                />
              </Field>
              <Field label="산출물명">
                <Input
                  value={item.deliverableName ?? ""}
                  onChange={(event) =>
                    onChange({
                      ...item,
                      deliverableName: event.target.value || null,
                    })
                  }
                />
              </Field>
              <Field label="출처 문서명">
                <Input
                  value={item.sourceDocumentName ?? ""}
                  onChange={(event) =>
                    onChange({
                      ...item,
                      sourceDocumentName: event.target.value || null,
                    })
                  }
                />
              </Field>
              <Field label="분석 결과 ID">
                <Input
                  type="number"
                  min={1}
                  value={item.analysisResultId ?? ""}
                  onChange={(event) =>
                    onChange({
                      ...item,
                      analysisResultId: event.target.value
                        ? Number(event.target.value)
                        : null,
                    })
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="보안 조건">
                  <Textarea
                    rows={2}
                    value={item.securityCondition ?? ""}
                    onChange={(event) =>
                      onChange({
                        ...item,
                        securityCondition: event.target.value || null,
                      })
                    }
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="출처 발췌">
                  <Textarea
                    rows={3}
                    value={item.sourceExcerpt ?? ""}
                    onChange={(event) =>
                      onChange({
                        ...item,
                        sourceExcerpt: event.target.value || null,
                      })
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
                <Save className="size-4" />
                편집본에 반영
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