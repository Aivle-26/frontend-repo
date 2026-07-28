import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  FileText,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  X,
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
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { cn } from "@/app/components/ui/utils";
import {
  ApiError,
  projectRepository,
  type RequirementResponse,
  type RequirementStatus,
} from "@/app/api/projectRepository";
import type { ProjectSummary } from "@/app/data/demoData";

interface PmRequirementsProps {
  project: ProjectSummary;
  onBackToGeneration?: () => void;
}

type StatusFilter = "ALL" | RequirementStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "전체" },
  { value: "UNCONFIRMED", label: "미확정" },
  { value: "CONFIRMED", label: "확정" },
  { value: "REJECTED", label: "반려" },
];

const TYPE_LABELS: Record<string, string> = {
  FUNCTIONAL: "기능",
  NON_FUNCTIONAL: "비기능",
  SECURITY: "보안",
  PERFORMANCE: "성능",
  DATA: "데이터",
  INTERFACE: "인터페이스",
  OPERATION: "운영",
};

function typeLabel(type: string) {
  return TYPE_LABELS[type] ?? type;
}

function priorityLabel(priority: string) {
  if (priority === "HIGH") return "높음";
  if (priority === "MEDIUM") return "중간";
  if (priority === "LOW") return "낮음";
  return priority;
}

function priorityVariant(priority: string) {
  if (priority === "HIGH") return "destructive" as const;
  if (priority === "MEDIUM") return "secondary" as const;
  return "outline" as const;
}

function statusLabel(status: RequirementStatus) {
  if (status === "CONFIRMED") return "확정";
  if (status === "REJECTED") return "반려";
  return "미확정";
}

function statusClass(status: RequirementStatus) {
  if (status === "CONFIRMED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "REJECTED") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError && error.message ? error.message : fallback;
}

export function PmRequirements({
  project,
  onBackToGeneration,
}: PmRequirementsProps) {
  const [requirements, setRequirements] = useState<RequirementResponse[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionKey, setActionKey] = useState("");

  const loadRequirements = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const response = await projectRepository.listRequirements(project.id);
      setRequirements(Array.isArray(response) ? response : []);
    } catch (error) {
      setRequirements([]);
      setLoadError(errorMessage(error, "요구사항을 불러오지 못했습니다."));
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    void loadRequirements();
  }, [loadRequirements]);

  const types = useMemo(
    () => ["ALL", ...Array.from(new Set(requirements.map((item) => item.type)))],
    [requirements],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return requirements.filter((item) => {
      const byType = typeFilter === "ALL" || item.type === typeFilter;
      const byStatus = statusFilter === "ALL" || item.status === statusFilter;
      const byQuery =
        !normalizedQuery ||
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery) ||
        item.deliverableName?.toLowerCase().includes(normalizedQuery) ||
        item.sourceDocumentName?.toLowerCase().includes(normalizedQuery);

      return byType && byStatus && byQuery;
    });
  }, [requirements, query, statusFilter, typeFilter]);

  const confirmedCount = requirements.filter((item) => item.confirmed).length;
  const unconfirmedCount = requirements.filter(
    (item) => item.status === "UNCONFIRMED",
  ).length;

  const runRequirementAction = async (
    item: RequirementResponse,
    action: "confirm" | "unconfirm" | "reject",
  ) => {
    const key = `${item.requirementId}:${action}`;
    setActionKey(key);

    try {
      if (action === "confirm") {
        await projectRepository.confirmRequirement(project.id, item.requirementId);
        toast.success(`“${item.title}” 요구사항을 확정했습니다.`);
      } else if (action === "unconfirm") {
        await projectRepository.unconfirmRequirement(project.id, item.requirementId);
        toast.success(`“${item.title}” 요구사항 확정을 취소했습니다.`);
      } else {
        await projectRepository.rejectRequirement(project.id, item.requirementId);
        toast.success(`“${item.title}” 요구사항을 반려했습니다.`);
      }

      await loadRequirements();
    } catch (error) {
      toast.error(errorMessage(error, "요구사항 상태 변경에 실패했습니다."));
    } finally {
      setActionKey("");
    }
  };

  const confirmAll = async () => {
    setActionKey("confirm-all");

    try {
      await projectRepository.confirmAllRequirements(project.id);
      toast.success("모든 미확정 요구사항을 확정했습니다.");
      await loadRequirements();
    } catch (error) {
      toast.error(errorMessage(error, "요구사항 전체 확정에 실패했습니다."));
    } finally {
      setActionKey("");
    }
  };

  return (
    <div className="space-y-4">
      {onBackToGeneration && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 gap-2"
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
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4" /> 요구사항 목록
              </CardTitle>
              <CardDescription>
                {project.name} · 전체 {requirements.length}건 · 확정 {confirmedCount}건
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading || actionKey.length > 0}
                onClick={() => void loadRequirements()}
              >
                <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
                새로고침
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={unconfirmedCount === 0 || actionKey.length > 0}
                onClick={() => void confirmAll()}
              >
                {actionKey === "confirm-all" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                전체 확정
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

          <div className="flex flex-wrap items-center gap-2">
            {types.map((type) => (
              <button
                type="button"
                key={type}
                onClick={() => setTypeFilter(type)}
                className={cn(
                  "rounded-full px-3 py-1 text-sm transition-colors",
                  typeFilter === type
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                {type === "ALL" ? "전체 유형" : typeLabel(type)}
              </button>
            ))}

            <span className="mx-1 h-4 w-px bg-border" />

            {STATUS_FILTERS.map((status) => (
              <button
                type="button"
                key={status.value}
                onClick={() => setStatusFilter(status.value)}
                className={cn(
                  "rounded-full px-3 py-1 text-sm transition-colors",
                  statusFilter === status.value
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                {status.label}
              </button>
            ))}

            <div className="relative ml-auto min-w-56 flex-1 sm:max-w-72">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="제목·설명·산출물 검색"
                className="h-9 pl-8"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead className="min-w-80">요구사항</TableHead>
                  <TableHead className="w-24">유형</TableHead>
                  <TableHead className="w-24">우선순위</TableHead>
                  <TableHead className="w-28">마감일</TableHead>
                  <TableHead className="w-32">산출물</TableHead>
                  <TableHead className="w-24">상태</TableHead>
                  <TableHead className="min-w-48 text-right">처리</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center">
                      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" /> 요구사항을 불러오는 중입니다.
                      </span>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item) => (
                    <TableRow key={item.requirementId}>
                      <TableCell className="text-muted-foreground">
                        {item.requirementId}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{item.title}</div>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {item.description}
                        </p>
                        {item.acceptanceCriteria && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            완료 기준: {item.acceptanceCriteria}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {typeLabel(item.type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={priorityVariant(item.priority)}>
                          {priorityLabel(item.priority)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.dueDate ?? "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.deliverableName ?? "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("font-normal", statusClass(item.status))}
                        >
                          {statusLabel(item.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1.5">
                          {item.status !== "CONFIRMED" ? (
                            <Button
                              type="button"
                              size="sm"
                              className="h-8"
                              disabled={actionKey.length > 0}
                              onClick={() =>
                                void runRequirementAction(item, "confirm")
                              }
                            >
                              {actionKey === `${item.requirementId}:confirm` ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Check className="size-3.5" />
                              )}
                              확정
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              disabled={actionKey.length > 0}
                              onClick={() =>
                                void runRequirementAction(item, "unconfirm")
                              }
                            >
                              {actionKey === `${item.requirementId}:unconfirm` ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="size-3.5" />
                              )}
                              확정 취소
                            </Button>
                          )}

                          {item.status !== "REJECTED" && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 text-red-700"
                              disabled={actionKey.length > 0}
                              onClick={() =>
                                void runRequirementAction(item, "reject")
                              }
                            >
                              {actionKey === `${item.requirementId}:reject` ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <X className="size-3.5" />
                              )}
                              반려
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}

                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-10 text-center text-muted-foreground"
                    >
                      조건에 맞는 요구사항이 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}