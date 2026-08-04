import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  Loader2,
  PencilLine,
  Save,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { cn } from "@/app/components/ui/utils";
import {
  ApiError,
  projectRepository,
  type SaveWeeklyScrumReviewBody,
  type WeeklyScrumAction,
  type WeeklyScrumActionDecision,
  type WeeklyScrumFinding,
  type WeeklyScrumFindingDecision,
  type WeeklyScrumRecommendationResult,
  type WeeklyScrumReportResponse,
  type WeeklyScrumReviewDecision,
  type WeeklyScrumReviewResult,
} from "@/app/api/projectRepository";

export interface OwnerOption {
  employeeNumber: string;
  name: string;
}

type Decision = WeeklyScrumReviewDecision;

interface FindingState {
  status: Decision;
  comment: string;
  title: string;
  description: string;
  action: string;
}

interface ActionState {
  status: Decision;
  comment: string;
  title: string;
  ownerId: string;
  dueDate: string;
  priority: string;
  doneCondition: string;
  reason: string;
}

const DECISIONS: { value: Decision; label: string }[] = [
  { value: "APPROVED", label: "승인" },
  { value: "MODIFIED", label: "수정" },
  { value: "REJECTED", label: "거절" },
];

const PRIORITIES = ["LOW", "MEDIUM", "HIGH"];

const FINDING_TYPE_LABELS: Record<string, string> = {
  MISSING_FOLLOW_UP: "후속조치 누락",
  MISSING_RESPONSE_PLAN: "대응계획 누락",
  POTENTIAL_RISK: "잠재 리스크",
  DEPENDENCY: "의존성",
  CONFLICT: "충돌",
  MISSING_OWNER: "담당자 미지정",
  MISSING_DUE_DATE: "기한 미지정",
  NEEDS_CLARIFICATION: "확인 필요",
  MISSING_REQUIRED_WORK: "필수 작업 누락",
  OVERDUE: "기한 초과",
};

function normalizeDecision(value: string | null | undefined): Decision {
  const upper = (value ?? "").toUpperCase();
  return upper === "MODIFIED" || upper === "REJECTED" ? upper : "APPROVED";
}

function trimmed(value: string): string {
  return value.trim();
}

/** 액션의 source finding들이 모두 거절되면 자동 제외(담당자 불필요). */
function isAutoExcluded(action: WeeklyScrumAction, rejectedFindingIds: Set<string>): boolean {
  const ids = new Set<string>(action.source_finding_ids ?? []);
  if (action.source_finding_id) ids.add(action.source_finding_id);
  if (ids.size === 0) return false;
  return [...ids].every((id) => rejectedFindingIds.has(id));
}

export function ScrumReviewPanel({
  projectId,
  weekStart,
  analysis,
  ownerOptions,
  onUpdated,
}: {
  projectId: string | number;
  weekStart: string;
  analysis: WeeklyScrumReportResponse;
  ownerOptions: OwnerOption[];
  onUpdated: (next: WeeklyScrumReportResponse) => void;
}) {
  const findings = useMemo<WeeklyScrumFinding[]>(
    () => (analysis.review as WeeklyScrumReviewResult | null)?.review_findings ?? [],
    [analysis.review],
  );
  const recommendation = analysis.recommendation as WeeklyScrumRecommendationResult | null;
  const actions = useMemo<WeeklyScrumAction[]>(
    () => recommendation?.recommended_next_actions ?? [],
    [recommendation],
  );

  const nextWeekStart =
    recommendation?.next_week_start ?? isoPlusDays(analysis.weekEndDate, 1);
  const nextWeekEnd = recommendation?.next_week_end ?? isoPlusDays(analysis.weekEndDate, 7);

  const ownerNameById = useMemo(
    () => new Map(ownerOptions.map((o) => [o.employeeNumber, o.name])),
    [ownerOptions],
  );

  const [findingStates, setFindingStates] = useState<Record<string, FindingState>>(() =>
    Object.fromEntries(
      findings.map((f) => [
        f.finding_id,
        {
          status: normalizeDecision(f.review_status),
          comment: "",
          title: f.title ?? "",
          description: f.description ?? "",
          action: f.recommended_action ?? "",
        },
      ]),
    ),
  );

  const [actionStates, setActionStates] = useState<Record<string, ActionState>>(() =>
    Object.fromEntries(
      actions.map((a) => [
        a.action_id,
        {
          status: normalizeDecision(a.review_status),
          comment: "",
          title: a.title ?? "",
          ownerId: a.owner_id ?? "",
          dueDate: a.due_date ?? "",
          priority: (a.priority ?? "MEDIUM").toUpperCase(),
          doneCondition: a.done_condition ?? "",
          reason: a.reason ?? "",
        },
      ]),
    ),
  );

  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const rejectedFindingIds = useMemo(() => {
    const set = new Set<string>();
    findings.forEach((f) => {
      if (findingStates[f.finding_id]?.status === "REJECTED") set.add(f.finding_id);
    });
    return set;
  }, [findings, findingStates]);

  const patchFinding = (id: string, patch: Partial<FindingState>) =>
    setFindingStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const patchAction = (id: string, patch: Partial<ActionState>) =>
    setActionStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  /** 저장 직전 클라이언트 검증. 문제가 있으면 메시지를 반환. */
  function validate(): string | null {
    for (const f of findings) {
      const s = findingStates[f.finding_id];
      if (s.status === "REJECTED" && !trimmed(s.comment)) {
        return `거절한 발견사항 "${f.title}"에는 사유(코멘트)가 필요합니다.`;
      }
      if (
        s.status === "MODIFIED" &&
        !trimmed(s.title) &&
        !trimmed(s.description) &&
        !trimmed(s.action)
      ) {
        return `수정한 발견사항 "${f.title}"에는 수정값이 하나 이상 필요합니다.`;
      }
    }
    for (const a of actions) {
      const s = actionStates[a.action_id];
      if (s.status === "REJECTED") {
        if (!trimmed(s.comment)) return `거절한 액션 "${a.title}"에는 사유(코멘트)가 필요합니다.`;
        continue;
      }
      if (
        s.status === "MODIFIED" &&
        !trimmed(s.title) &&
        !s.ownerId &&
        !s.dueDate &&
        !s.priority &&
        !trimmed(s.doneCondition) &&
        !trimmed(s.reason)
      ) {
        return `수정한 액션 "${a.title}"에는 수정값이 하나 이상 필요합니다.`;
      }
      if (isAutoExcluded(a, rejectedFindingIds)) continue;
      const effectiveOwner = s.ownerId || a.owner_id || "";
      if (!effectiveOwner) {
        return `반영 액션 "${a.title}"에는 담당자를 지정해야 합니다.`;
      }
      if (s.ownerId && !ownerNameById.has(s.ownerId)) {
        return `액션 "${a.title}"의 담당자가 활성 프로젝트 구성원이 아닙니다.`;
      }
      const effectiveDue = s.dueDate || a.due_date || "";
      if (effectiveDue && (effectiveDue < nextWeekStart || effectiveDue > nextWeekEnd)) {
        return `액션 "${a.title}"의 기한은 다음 주(${nextWeekStart} ~ ${nextWeekEnd}) 범위여야 합니다.`;
      }
    }
    return null;
  }

  function buildBody(): SaveWeeklyScrumReviewBody {
    const findingDecisions: WeeklyScrumFindingDecision[] = findings.map((f) => {
      const s = findingStates[f.finding_id];
      const dec: WeeklyScrumFindingDecision = {
        findingId: f.finding_id,
        reviewStatus: s.status,
      };
      if (trimmed(s.comment)) dec.reviewComment = trimmed(s.comment);
      if (s.status === "MODIFIED") {
        if (trimmed(s.title)) dec.modifiedTitle = trimmed(s.title);
        if (trimmed(s.description)) dec.modifiedDescription = trimmed(s.description);
        if (trimmed(s.action)) dec.modifiedAction = trimmed(s.action);
      }
      return dec;
    });

    const actionDecisions: WeeklyScrumActionDecision[] = actions.map((a) => {
      const s = actionStates[a.action_id];
      const dec: WeeklyScrumActionDecision = {
        actionId: a.action_id,
        reviewStatus: s.status,
      };
      if (trimmed(s.comment)) dec.reviewComment = trimmed(s.comment);
      if (s.status === "REJECTED") return dec;

      const origOwner = a.owner_id ?? "";
      const origPriority = (a.priority ?? "").toUpperCase();
      const origDue = a.due_date ?? "";

      if (s.status === "MODIFIED") {
        if (trimmed(s.title)) dec.modifiedTitle = trimmed(s.title);
        if (s.ownerId) {
          dec.modifiedOwnerId = s.ownerId;
          const name = ownerNameById.get(s.ownerId);
          if (name) dec.modifiedOwner = name;
        }
        if (s.dueDate) dec.modifiedDueDate = s.dueDate;
        if (s.priority) dec.modifiedPriority = s.priority;
        if (trimmed(s.doneCondition)) dec.modifiedDoneCondition = trimmed(s.doneCondition);
        if (trimmed(s.reason)) dec.modifiedReason = trimmed(s.reason);
        return dec;
      }

      // APPROVED: 변경된 값만 반영 (미지정 담당자 배정 포함)
      if (s.ownerId && s.ownerId !== origOwner) {
        dec.modifiedOwnerId = s.ownerId;
        const name = ownerNameById.get(s.ownerId);
        if (name) dec.modifiedOwner = name;
      }
      if (s.dueDate && s.dueDate !== origDue) dec.modifiedDueDate = s.dueDate;
      if (s.priority && s.priority !== origPriority) dec.modifiedPriority = s.priority;
      return dec;
    });

    return { findings: findingDecisions, actions: actionDecisions };
  }

  const saveReview = async () => {
    if (saving) return;
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    try {
      const res = await projectRepository.saveWeeklyScrumReview(
        projectId,
        weekStart,
        buildBody(),
      );
      onUpdated(res);
      toast.success("검토 결과를 저장했습니다.");
    } catch (caught) {
      toast.error(
        caught instanceof ApiError ? caught.message : "검토 저장에 실패했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };

  const finalize = async () => {
    if (finalizing) return;
    setFinalizing(true);
    try {
      const res = await projectRepository.finalizeWeeklyScrum(projectId, weekStart);
      onUpdated(res);
      toast.success("최종 보고서를 확정했습니다.");
    } catch (caught) {
      toast.error(
        caught instanceof ApiError ? caught.message : "최종 확정에 실패했습니다.",
      );
    } finally {
      setFinalizing(false);
    }
  };

  const reviewSaved = analysis.status === "PM_REVIEWING";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-amber-800 text-xs">
        AI가 도출한 발견사항과 다음 주 액션을 검토하세요. 각 항목을 승인 · 수정 · 거절한 뒤
        [검토 저장]하면 최종 확정을 진행할 수 있습니다.
      </div>

      {/* 발견사항(Findings) */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 text-foreground text-sm">
          <AlertCircle className="size-4 text-amber-600" />
          발견사항 <span className="text-muted-foreground">({findings.length})</span>
        </div>
        {findings.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-muted-foreground text-xs">
            도출된 발견사항이 없습니다.
          </p>
        ) : (
          findings.map((f) => {
            const s = findingStates[f.finding_id];
            return (
              <div key={f.finding_id} className="rounded-xl border border-border p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-border font-normal">
                    {FINDING_TYPE_LABELS[f.type] ?? f.type}
                  </Badge>
                  {f.confidence && (
                    <span className="text-muted-foreground text-xs">
                      신뢰도 {f.confidence}
                    </span>
                  )}
                </div>
                <div className="text-foreground text-sm">{f.title}</div>
                {f.description && (
                  <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                    {f.description}
                  </p>
                )}
                {f.recommended_action && (
                  <p className="mt-1.5 text-xs text-foreground">
                    <span className="text-muted-foreground">권고: </span>
                    {f.recommended_action}
                  </p>
                )}

                <DecisionSwitch
                  value={s.status}
                  onChange={(status) => patchFinding(f.finding_id, { status })}
                />

                {s.status === "MODIFIED" && (
                  <div className="mt-2 space-y-2">
                    <Field label="제목">
                      <Input
                        value={s.title}
                        onChange={(e) => patchFinding(f.finding_id, { title: e.target.value })}
                      />
                    </Field>
                    <Field label="설명">
                      <Textarea
                        value={s.description}
                        onChange={(e) =>
                          patchFinding(f.finding_id, { description: e.target.value })
                        }
                        className="min-h-14"
                      />
                    </Field>
                    <Field label="권고 조치">
                      <Textarea
                        value={s.action}
                        onChange={(e) => patchFinding(f.finding_id, { action: e.target.value })}
                        className="min-h-14"
                      />
                    </Field>
                  </div>
                )}

                {s.status === "REJECTED" && (
                  <div className="mt-2">
                    <Field label="거절 사유 (필수)">
                      <Textarea
                        value={s.comment}
                        onChange={(e) => patchFinding(f.finding_id, { comment: e.target.value })}
                        placeholder="거절 사유를 입력하세요."
                        className="min-h-14"
                      />
                    </Field>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      {/* 다음 주 액션(Actions) */}
      <section className="space-y-2">
        <div className="flex items-center gap-2 text-foreground text-sm">
          <FileCheck2 className="size-4 text-blue-600" />
          다음 주 액션 <span className="text-muted-foreground">({actions.length})</span>
          <span className="text-muted-foreground text-xs">
            · {nextWeekStart} ~ {nextWeekEnd}
          </span>
        </div>
        {actions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-muted-foreground text-xs">
            추천된 액션이 없습니다.
          </p>
        ) : (
          actions.map((a) => {
            const s = actionStates[a.action_id];
            const excluded = isAutoExcluded(a, rejectedFindingIds);
            return (
              <div key={a.action_id} className="rounded-xl border border-border p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-border font-normal">
                    {s.priority}
                  </Badge>
                  {excluded && (
                    <span className="text-muted-foreground text-xs">
                      연결 발견사항 거절됨 · 자동 제외
                    </span>
                  )}
                </div>
                <div className="text-foreground text-sm">{a.title}</div>
                {a.reason && (
                  <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                    {a.reason}
                  </p>
                )}
                {a.done_condition && (
                  <p className="mt-1 text-xs text-foreground">
                    <span className="text-muted-foreground">완료 조건: </span>
                    {a.done_condition}
                  </p>
                )}

                <DecisionSwitch
                  value={s.status}
                  onChange={(status) => patchAction(a.action_id, { status })}
                />

                {s.status !== "REJECTED" && (
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Field label={`담당자${excluded ? "" : " (필수)"}`}>
                      <NativeSelect
                        value={s.ownerId}
                        onChange={(value) => patchAction(a.action_id, { ownerId: value })}
                      >
                        <option value="">미지정</option>
                        {ownerOptions.map((o) => (
                          <option key={o.employeeNumber} value={o.employeeNumber}>
                            {o.name}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                    <Field label="기한">
                      <Input
                        type="date"
                        value={s.dueDate}
                        min={nextWeekStart}
                        max={nextWeekEnd}
                        onChange={(e) => patchAction(a.action_id, { dueDate: e.target.value })}
                      />
                    </Field>
                    {s.status === "MODIFIED" && (
                      <>
                        <Field label="제목">
                          <Input
                            value={s.title}
                            onChange={(e) => patchAction(a.action_id, { title: e.target.value })}
                          />
                        </Field>
                        <Field label="우선순위">
                          <NativeSelect
                            value={s.priority}
                            onChange={(value) => patchAction(a.action_id, { priority: value })}
                          >
                            {PRIORITIES.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </NativeSelect>
                        </Field>
                        <Field label="완료 조건" full>
                          <Textarea
                            value={s.doneCondition}
                            onChange={(e) =>
                              patchAction(a.action_id, { doneCondition: e.target.value })
                            }
                            className="min-h-14"
                          />
                        </Field>
                      </>
                    )}
                  </div>
                )}

                {s.status === "REJECTED" && (
                  <div className="mt-2">
                    <Field label="거절 사유 (필수)">
                      <Textarea
                        value={s.comment}
                        onChange={(e) => patchAction(a.action_id, { comment: e.target.value })}
                        placeholder="거절 사유를 입력하세요."
                        className="min-h-14"
                      />
                    </Field>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
        <Button variant="outline" size="sm" onClick={() => void saveReview()} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="size-3.5 animate-spin" /> 저장 중…
            </>
          ) : (
            <>
              <Save className="size-3.5" /> 검토 저장
            </>
          )}
        </Button>
        <Button
          size="sm"
          onClick={() => void finalize()}
          disabled={finalizing || !reviewSaved}
          title={reviewSaved ? undefined : "먼저 검토를 저장하세요."}
        >
          {finalizing ? (
            <>
              <Loader2 className="size-3.5 animate-spin" /> 확정 중…
            </>
          ) : (
            <>
              <FileCheck2 className="size-3.5" /> 최종 확정
            </>
          )}
        </Button>
      </div>
      {!reviewSaved && (
        <p className="text-right text-muted-foreground text-xs">
          검토를 저장하면 최종 확정을 진행할 수 있습니다.
        </p>
      )}
    </div>
  );
}

/* ------------------------------ 하위 UI ------------------------------ */

function DecisionSwitch({
  value,
  onChange,
}: {
  value: Decision;
  onChange: (next: Decision) => void;
}) {
  const icons: Record<Decision, React.ReactNode> = {
    APPROVED: <CheckCircle2 className="size-3.5" />,
    MODIFIED: <PencilLine className="size-3.5" />,
    REJECTED: <XCircle className="size-3.5" />,
  };
  const activeClass: Record<Decision, string> = {
    APPROVED: "border-emerald-300 bg-emerald-50 text-emerald-700",
    MODIFIED: "border-blue-300 bg-blue-50 text-blue-700",
    REJECTED: "border-red-300 bg-red-50 text-red-700",
  };
  return (
    <div className="mt-2.5 flex gap-1.5">
      {DECISIONS.map((d) => {
        const active = value === d.value;
        return (
          <button
            key={d.value}
            type="button"
            onClick={() => onChange(d.value)}
            className={cn(
              "flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors",
              active
                ? activeClass[d.value]
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {icons[d.value]}
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

function Field({
  label,
  children,
  full = false,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={cn("block space-y-1", full && "sm:col-span-2")}>
      <span className="text-muted-foreground text-xs">{label}</span>
      {children}
    </label>
  );
}

function NativeSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (next: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-input bg-input-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
    >
      {children}
    </select>
  );
}

/** ISO(YYYY-MM-DD) 문자열에 일수를 더한다. weekEndDate가 null이면 빈 문자열. */
function isoPlusDays(iso: string | null, days: number): string {
  if (!iso) return "";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
