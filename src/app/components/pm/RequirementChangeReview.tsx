import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Eye,
  Loader2,
  Pencil,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/app/components/ui/alert-dialog";
import {
  projectRepository,
  type RequirementChangeCandidate,
  type RequirementChangeProposal,
  type RequirementChangeReviewStatus,
  type RequirementsResult,
} from "@/app/api/projectRepository";
import { RequirementEvidenceViewer } from "./RequirementEvidenceViewer";

interface RequirementChangeReviewProps {
  projectId: string | number;
  candidates: RequirementChangeCandidate[];
  onCandidatesChange: (candidates: RequirementChangeCandidate[]) => void;
  onApplied: (requirements: RequirementsResult) => void;
}

export function RequirementChangeReview({
  projectId,
  candidates,
  onCandidatesChange,
  onApplied,
}: RequirementChangeReviewProps) {
  const [busyCandidateId, setBusyCandidateId] = useState<number | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [editingCandidate, setEditingCandidate] =
    useState<RequirementChangeCandidate | null>(null);
  const [editedProposal, setEditedProposal] =
    useState<RequirementChangeProposal | null>(null);
  const [evidenceCandidate, setEvidenceCandidate] =
    useState<RequirementChangeCandidate | null>(null);

  const approvedCandidateIds = useMemo(
    () =>
      candidates
        .filter(
          (candidate) =>
            candidate.reviewStatus === "APPROVED" && !candidate.applied,
        )
        .map((candidate) => candidate.candidateId),
    [candidates],
  );

  const selectableCandidateIds = useMemo(
    () => new Set(approvedCandidateIds),
    [approvedCandidateIds],
  );

  const selectedCandidateIds = useMemo(
    () =>
      approvedCandidateIds.filter((candidateId) => selectedIds.has(candidateId)),
    [approvedCandidateIds, selectedIds],
  );

  useEffect(() => {
    setSelectedIds(new Set());
  }, [projectId]);

  useEffect(() => {
    setSelectedIds((current) => {
      const next = new Set(
        [...current].filter((candidateId) =>
          selectableCandidateIds.has(candidateId),
        ),
      );
      if (next.size === current.size && [...next].every((id) => current.has(id))) {
        return current;
      }
      return next;
    });
  }, [selectableCandidateIds]);

  const updateCandidate = (updated: RequirementChangeCandidate) => {
    onCandidatesChange(
      candidates.map((candidate) =>
        candidate.candidateId === updated.candidateId ? updated : candidate,
      ),
    );
    setSelectedIds((current) => {
      const next = new Set(current);
      if (updated.reviewStatus !== "APPROVED" || updated.applied) {
        next.delete(updated.candidateId);
      }
      return next;
    });
  };

  const review = async (
    candidate: RequirementChangeCandidate,
    status: RequirementChangeReviewStatus,
    proposal?: RequirementChangeProposal | null,
  ) => {
    if (busyCandidateId !== null) return;
    setBusyCandidateId(candidate.candidateId);
    try {
      const updated = await projectRepository.reviewRequirementChange(
        projectId,
        candidate.candidateId,
        {
          reviewStatus: status,
          proposedRequirement: proposal,
        },
      );
      updateCandidate(updated);
      toast.success(
        status === "APPROVED"
          ? "변경 후보를 승인했습니다."
          : status === "REJECTED"
            ? "변경 후보를 거절했습니다."
            : "제안 내용을 수정했습니다.",
      );
      return updated;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "변경 후보를 검토하지 못했습니다.",
      );
      return null;
    } finally {
      setBusyCandidateId(null);
    }
  };

  const saveEdit = async () => {
    if (!editingCandidate || !editedProposal) return;
    const updated = await review(
      editingCandidate,
      "PENDING_REVIEW",
      editedProposal,
    );
    if (updated) {
      setEditingCandidate(null);
      setEditedProposal(null);
    }
  };

  const applySelected = async () => {
    const candidateIds = selectedCandidateIds;
    if (candidateIds.length === 0 || isApplying) return;
    setIsApplying(true);
    try {
      const result = await projectRepository.applyRequirementChanges(
        projectId,
        candidateIds,
      );
      onCandidatesChange(
        candidates.map((candidate) =>
          candidateIds.includes(candidate.candidateId)
            ? { ...candidate, applied: true }
            : candidate,
        ),
      );
      setSelectedIds(new Set());
      onApplied(result);
      toast.success(`승인된 변경 ${candidateIds.length}건을 반영했습니다.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "승인된 변경을 반영하지 못했습니다.",
      );
    } finally {
      setIsApplying(false);
    }
  };

  const evidence = evidenceCandidate?.evidences?.length
    ? evidenceCandidate.evidences
    : evidenceCandidate?.proposedRequirement?.evidences ??
      evidenceCandidate?.existingRequirement?.evidences ??
      [];
  const evidenceProposal =
    evidenceCandidate?.proposedRequirement ??
    evidenceCandidate?.existingRequirement ??
    null;

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-foreground">요구사항 변경 후보</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              AI 결과는 검토 후보로만 저장됩니다. 승인 후 선택한 항목만
              반영됩니다.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={approvedCandidateIds.length === 0}
            onClick={() => setSelectedIds(new Set(approvedCandidateIds))}
          >
            <ShieldCheck className="size-4" />
            승인 항목 전체 선택
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">선택</TableHead>
                <TableHead className="w-28">변경</TableHead>
                <TableHead className="min-w-48">기존 요구사항</TableHead>
                <TableHead className="min-w-64">제안 요구사항</TableHead>
                <TableHead className="min-w-52">사유</TableHead>
                <TableHead className="w-28">검토 상태</TableHead>
                <TableHead className="w-52 text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((candidate) => {
                const candidateEvidenceProposal =
                  candidate.proposedRequirement ??
                  candidate.existingRequirement ??
                  null;
                const canSelect =
                  candidate.reviewStatus === "APPROVED" && !candidate.applied;
                const canEdit =
                  !candidate.applied &&
                  candidate.proposedRequirement !== null &&
                  (candidate.changeType === "ADDED" ||
                    candidate.changeType === "MODIFIED");
                return (
                  <TableRow key={candidate.candidateId}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(candidate.candidateId)}
                        disabled={!canSelect || isApplying}
                        onCheckedChange={() =>
                          setSelectedIds((current) => {
                            const next = new Set(current);
                            if (next.has(candidate.candidateId)) {
                              next.delete(candidate.candidateId);
                            } else {
                              next.add(candidate.candidateId);
                            }
                            return next;
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {changeTypeLabel(candidate.changeType)}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="font-medium">
                        {candidate.existingRequirement?.functionName ?? "-"}
                      </div>
                      <div className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">
                        {candidate.existingRequirement?.requirementText ?? "-"}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="font-medium">
                        {candidate.proposedRequirement?.functionName ??
                          (candidate.changeType === "REMOVED" ? "삭제 제안" : "-")}
                      </div>
                      <div className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">
                        {candidate.proposedRequirement?.requirementText ?? "-"}
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-xs leading-5 text-muted-foreground">
                      {candidate.changeReason}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          candidate.applied
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : candidate.reviewStatus === "APPROVED"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : candidate.reviewStatus === "REJECTED"
                                ? "border-red-200 bg-red-50 text-red-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                        }
                      >
                        {candidate.applied
                          ? "반영 완료"
                          : reviewStatusLabel(candidate.reviewStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="원문 근거"
                          disabled={candidateEvidenceProposal === null}
                          onClick={() => setEvidenceCandidate(candidate)}
                        >
                          <Eye className="size-4" />
                        </Button>
                        {canEdit ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="제안 수정"
                            onClick={() => {
                              setEditingCandidate(candidate);
                              setEditedProposal(candidate.proposedRequirement);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="승인"
                          disabled={
                            candidate.applied ||
                            busyCandidateId !== null ||
                            candidate.reviewStatus === "APPROVED"
                          }
                          onClick={() =>
                            void review(
                              candidate,
                              "APPROVED",
                              candidate.proposedRequirement,
                            )
                          }
                        >
                          {busyCandidateId === candidate.candidateId ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Check className="size-4 text-emerald-600" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="거절"
                          disabled={
                            candidate.applied ||
                            busyCandidateId !== null ||
                            candidate.reviewStatus === "REJECTED"
                          }
                          onClick={() => void review(candidate, "REJECTED")}
                        >
                          <X className="size-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <span className="text-sm text-muted-foreground">
            반영할 승인 후보 {selectedCandidateIds.length}건
          </span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                disabled={selectedCandidateIds.length === 0 || isApplying}
              >
                {isApplying ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ShieldCheck className="size-4" />
                )}
                선택한 승인 결과 반영
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>승인 결과를 반영할까요?</AlertDialogTitle>
                <AlertDialogDescription>
                  선택한 {selectedCandidateIds.length}건만 실제 요구사항에 반영됩니다.
                  미승인·거절 후보는 변경되지 않습니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={() => void applySelected()}>
                  반영
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Dialog
        open={editingCandidate !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingCandidate(null);
            setEditedProposal(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>제안 요구사항 수정</DialogTitle>
            <DialogDescription>
              수정 내용은 후보에만 저장되며 승인 결과 반영 전까지 실제
              요구사항은 바뀌지 않습니다.
            </DialogDescription>
          </DialogHeader>
          {editedProposal ? (
            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">기능명</span>
                <Input
                  value={editedProposal.functionName}
                  onChange={(event) =>
                    setEditedProposal({
                      ...editedProposal,
                      functionName: event.target.value,
                    })
                  }
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">요구사항</span>
                <Textarea
                  rows={6}
                  value={editedProposal.requirementText}
                  onChange={(event) =>
                    setEditedProposal({
                      ...editedProposal,
                      requirementText: event.target.value,
                    })
                  }
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">유형</span>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={editedProposal.category}
                    onChange={(event) =>
                      setEditedProposal({
                        ...editedProposal,
                        category: event.target
                          .value as RequirementChangeProposal["category"],
                      })
                    }
                  >
                    {[
                      "FUNCTIONAL",
                      "NON_FUNCTIONAL",
                      "SECURITY",
                      "DATA",
                      "INTERFACE",
                      "OPERATION",
                      "PROJECT_MANAGEMENT",
                      "UNSPECIFIED",
                    ].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">우선순위</span>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={editedProposal.priority}
                    onChange={(event) =>
                      setEditedProposal({
                        ...editedProposal,
                        priority: event.target
                          .value as RequirementChangeProposal["priority"],
                      })
                    }
                  >
                    {["HIGH", "MEDIUM", "LOW", "UNSPECIFIED"].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingCandidate(null);
                setEditedProposal(null);
              }}
            >
              취소
            </Button>
            <Button
              type="button"
              disabled={
                !editedProposal?.functionName.trim() ||
                !editedProposal.requirementText.trim() ||
                busyCandidateId !== null
              }
              onClick={() => void saveEdit()}
            >
              {busyCandidateId !== null ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              후보에 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RequirementEvidenceViewer
        open={evidenceCandidate !== null}
        onOpenChange={(open) => {
          if (!open) setEvidenceCandidate(null);
        }}
        projectId={projectId}
        requirementTitle={
          evidenceProposal?.functionName ?? "요구사항 변경 후보"
        }
        evidences={evidence}
        fallbackSourceDocument={evidenceProposal?.sourceDocument}
        fallbackExcerpt={evidenceProposal?.sourceExcerpt}
      />
    </>
  );
}

function changeTypeLabel(type: RequirementChangeCandidate["changeType"]) {
  if (type === "ADDED") return "추가";
  if (type === "MODIFIED") return "수정";
  if (type === "REMOVED") return "삭제";
  return "유지";
}

function reviewStatusLabel(status: RequirementChangeReviewStatus) {
  if (status === "APPROVED") return "승인";
  if (status === "REJECTED") return "거절";
  return "검토 대기";
}
