import { useEffect, useMemo, useState } from "react";
import {
  Download,
  FileImage,
  GitBranch,
  GripVertical,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Undo2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  ApiError,
  projectRepository,
  type OrganizationChartArtifact,
  type OrganizationChartHierarchy,
  type OrganizationChartHierarchyMember,
} from "@/app/api/projectRepository";
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
import { Checkbox } from "@/app/components/ui/checkbox";
import { cn } from "@/app/components/ui/utils";

interface OrganizationChartArtifactCardProps {
  projectId: string | number;
  canGenerate: boolean;
}

type AutoGenerationReadiness = "unknown" | "not-ready" | "ready";

const prerequisiteMessages: Record<string, string> = {
  CONFIRMED_WBS_NOT_FOUND:
    "확정된 WBS가 필요합니다. WBS를 확정한 후 다시 생성해 주세요.",
  PLANNING_SCHEDULE_NOT_FOUND:
    "모든 최하위 WBS의 일정이 필요합니다. 일정을 생성한 후 다시 시도해 주세요.",
  ACTIVE_PROJECT_MEMBER_NOT_FOUND:
    "활성 프로젝트 멤버가 없습니다. 멤버를 등록한 후 다시 생성해 주세요.",
};

function apiErrorCode(error: ApiError) {
  if (!error.payload || typeof error.payload !== "object") return "";
  const code = (error.payload as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

function organizationChartErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) {
    return "조직도를 처리하는 중 오류가 발생했습니다.";
  }
  const code = apiErrorCode(error);
  if (prerequisiteMessages[code]) return prerequisiteMessages[code];
  if (code === "INVALID_ORGANIZATION_CHART_HIERARCHY") {
    return "보고 라인을 저장할 수 없습니다. 순환 관계와 PM 위치를 확인해 주세요.";
  }
  if (code === "ORGANIZATION_CHART_VERSION_CONFLICT") {
    return "조직도가 변경되었습니다. 최신 버전을 불러온 후 다시 편집해 주세요.";
  }
  if (code === "ORGANIZATION_CHART_MEMBERS_CHANGED") {
    return "프로젝트 멤버가 변경되었습니다. 조직도를 다시 생성해 주세요.";
  }
  if (error.status === 403) {
    return "이 프로젝트의 조직도에 접근할 권한이 없습니다.";
  }
  if (error.status === 502 || error.status === 503) {
    return "조직도 생성 서버 또는 파일 저장소에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.";
  }
  return error.message;
}

function approvalLabel(status: OrganizationChartArtifact["approvalStatus"]) {
  if (status === "APPROVED") return "승인 완료";
  if (status === "REJECTED") return "반려";
  return "검토 대기";
}

function formatBytes(value: number) {
  if (value < 1024) return `${value}B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`;
  return `${(value / (1024 * 1024)).toFixed(1)}MB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ko-KR");
}

async function optionalNotFound<T>(request: Promise<T>) {
  try {
    return await request;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

async function loadAutoGenerationReadiness(
  projectId: string | number,
): Promise<AutoGenerationReadiness> {
  const [wbs, schedule, members] = await Promise.all([
    optionalNotFound(projectRepository.getWbs(projectId)),
    optionalNotFound(projectRepository.getSchedules(projectId)),
    projectRepository.getProjectMembers(projectId),
  ]);
  if (!wbs || !schedule) return "not-ready";

  const confirmedTasks = wbs.finalTasks.filter((task) => task.confirmed);
  const parentIds = new Set(
    confirmedTasks
      .map((task) => task.parentExternalTaskId)
      .filter((id): id is string => Boolean(id)),
  );
  const leafTasks = confirmedTasks.filter(
    (task) => !parentIds.has(task.externalTaskId),
  );
  const scheduledWbsIds = new Set(schedule.schedules.map((item) => item.wbsId));
  const everyLeafHasSchedule = leafTasks.every(
    (task) => task.taskId !== null && scheduledWbsIds.has(task.taskId),
  );

  return leafTasks.length > 0 && everyLeafHasSchedule && members.length > 0
    ? "ready"
    : "not-ready";
}

function orderedMembers(members: OrganizationChartHierarchyMember[]) {
  return [...members].sort(
    (left, right) => left.order - right.order || left.memberId.localeCompare(right.memberId),
  );
}

function normalizeSiblingOrder(members: OrganizationChartHierarchyMember[]) {
  const groups = new Map<string, OrganizationChartHierarchyMember[]>();
  for (const member of members) {
    const key = member.parentMemberId ?? "<root>";
    groups.set(key, [...(groups.get(key) ?? []), member]);
  }
  const orderById = new Map<string, number>();
  for (const group of groups.values()) {
    orderedMembers(group).forEach((member, index) => orderById.set(member.memberId, index));
  }
  return members.map((member) => ({
    ...member,
    order: orderById.get(member.memberId) ?? member.order,
  }));
}

function createsCycle(
  members: OrganizationChartHierarchyMember[],
  memberId: string,
  parentMemberId: string,
) {
  const byId = new Map(members.map((member) => [member.memberId, member]));
  let current: string | null = parentMemberId;
  const visited = new Set<string>();
  while (current) {
    if (current === memberId) return true;
    if (visited.has(current)) return true;
    visited.add(current);
    current = byId.get(current)?.parentMemberId ?? null;
  }
  return false;
}

const PM_DIRECT_DROP_TARGET = "<pm-direct-drop-zone>";

interface HierarchyTreeProps {
  hierarchy: OrganizationChartHierarchy;
  members: OrganizationChartHierarchyMember[];
  editable: boolean;
  draggedMemberId: string | null;
  dropTargetId: string | null;
  onDragStart: (memberId: string) => void;
  onDragEnd: () => void;
  onDrop: (parentMemberId: string, memberId?: string) => void;
  onDropTargetChange: (memberId: string | null) => void;
}

function HierarchyTree({
  hierarchy,
  members,
  editable,
  draggedMemberId,
  dropTargetId,
  onDragStart,
  onDragEnd,
  onDrop,
  onDropTargetChange,
}: HierarchyTreeProps) {
  const byId = useMemo(
    () => new Map(members.map((member) => [member.memberId, member])),
    [members],
  );
  const children = useMemo(() => {
    const result = new Map<string, OrganizationChartHierarchyMember[]>();
    for (const member of members) {
      if (!member.parentMemberId) continue;
      result.set(member.parentMemberId, [
        ...(result.get(member.parentMemberId) ?? []),
        member,
      ]);
    }
    for (const [parentId, values] of result) {
      result.set(parentId, orderedMembers(values));
    }
    return result;
  }, [members]);

  const root = byId.get(hierarchy.projectManagerMemberId);
  if (!root) return null;

  const renderMember = (member: OrganizationChartHierarchyMember, depth: number) => {
    const parent = member.parentMemberId ? byId.get(member.parentMemberId) : null;
    const childMembers = children.get(member.memberId) ?? [];
    const isPm = member.memberId === hierarchy.projectManagerMemberId;
    const hierarchyLabel = isPm
      ? "최상위"
      : parent?.memberId === hierarchy.projectManagerMemberId
        ? "PM 직속"
        : parent
          ? `${parent.memberName} 산하`
          : "PM 직속";
    const canDrop = Boolean(
      editable &&
        draggedMemberId &&
        draggedMemberId !== member.memberId &&
        !createsCycle(members, draggedMemberId, member.memberId),
    );
    const dropState =
      draggedMemberId === member.memberId
        ? "dragging"
        : dropTargetId === member.memberId && canDrop
          ? "valid"
          : editable && draggedMemberId && !canDrop
            ? "invalid"
            : "idle";

    return (
      <div
        key={member.memberId}
        data-tree-node={member.memberId}
        data-tree-depth={depth}
        className="relative"
      >
        <div
          data-member-id={member.memberId}
          data-drop-state={dropState}
          role="treeitem"
          aria-level={depth + 1}
          aria-expanded={childMembers.length > 0 ? true : undefined}
          aria-label={`${member.memberName}, ${member.projectJobFamily ?? "직무 미배정"}, ${hierarchyLabel}`}
          draggable={editable && !isPm}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", member.memberId);
            onDragStart(member.memberId);
          }}
          onDragEnd={onDragEnd}
          onDragOver={(event) => {
            if (!editable) return;
            const sourceId = draggedMemberId || event.dataTransfer.getData("text/plain");
            if (
              !sourceId ||
              sourceId === member.memberId ||
              createsCycle(members, sourceId, member.memberId)
            ) {
              event.dataTransfer.dropEffect = "none";
              if (dropTargetId === member.memberId) onDropTargetChange(null);
              return;
            }
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            onDropTargetChange(member.memberId);
          }}
          onDragLeave={() => {
            if (dropTargetId === member.memberId) onDropTargetChange(null);
          }}
          onDrop={(event) => {
            const sourceId = draggedMemberId || event.dataTransfer.getData("text/plain");
            if (
              !editable ||
              !sourceId ||
              sourceId === member.memberId ||
              createsCycle(members, sourceId, member.memberId)
            ) return;
            event.preventDefault();
            onDrop(member.memberId, sourceId);
          }}
          className={cn(
            "flex min-w-72 w-[min(36rem,calc(100vw-5rem))] items-start gap-3 rounded-md border bg-background px-4 py-3 shadow-sm transition-[border-color,background-color,box-shadow,opacity]",
            isPm && "border-primary/50 bg-primary/5 shadow-primary/5",
            editable && !isPm && "cursor-grab active:cursor-grabbing",
            draggedMemberId === member.memberId && "opacity-45",
            dropTargetId === member.memberId && canDrop &&
              "border-primary bg-primary/10 shadow-md ring-2 ring-primary/25",
          )}
        >
          {editable && !isPm ? (
            <GripVertical className="mt-1 size-4 shrink-0 text-muted-foreground" />
          ) : (
            <UserRound className="mt-1 size-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-sm text-foreground">{member.memberName}</strong>
              <span className="text-xs text-muted-foreground">{member.memberId}</span>
              {isPm ? <Badge>PM</Badge> : null}
              {!member.capabilityRegistered ? (
                <Badge variant="outline">역량 미등록</Badge>
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">
                {member.projectJobFamily ?? "직무 미배정"}
              </span>
              <span>{hierarchyLabel}</span>
            </div>
          </div>
          {dropTargetId === member.memberId && canDrop ? (
            <span className="shrink-0 rounded bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground">
              산하로 이동
            </span>
          ) : null}
        </div>
        {childMembers.length > 0 ? (
          <div
            data-tree-children={member.memberId}
            className="ml-4 mt-4 space-y-4 pl-10"
          >
            {childMembers.map((child, index) => (
              <div
                key={child.memberId}
                data-tree-branch={child.memberId}
                className={cn(
                  "relative before:pointer-events-none before:absolute before:-left-10 before:-top-4 before:border-l before:border-border after:pointer-events-none after:absolute after:-left-10 after:top-7 after:w-10 after:border-t after:border-border",
                  index === childMembers.length - 1
                    ? "before:bottom-[calc(100%-1.75rem)]"
                    : "before:-bottom-4",
                )}
              >
                {renderMember(child, depth + 1)}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div data-hierarchy-tree-scroll className="overflow-x-auto pb-1">
      <div
        role="tree"
        aria-label="프로젝트 보고 라인 계층"
        className="min-w-max pr-6"
      >
        {renderMember(root, 0)}
      </div>
    </div>
  );
}

export function OrganizationChartArtifactCard({
  projectId,
  canGenerate,
}: OrganizationChartArtifactCardProps) {
  const [artifact, setArtifact] = useState<OrganizationChartArtifact | null>(null);
  const [hierarchy, setHierarchy] = useState<OrganizationChartHierarchy | null>(null);
  const [draftMembers, setDraftMembers] = useState<OrganizationChartHierarchyMember[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedMemberId, setDraggedMemberId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [hierarchyMessage, setHierarchyMessage] = useState("");
  const [autoGenerationReadiness, setAutoGenerationReadiness] =
    useState<AutoGenerationReadiness>("unknown");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    setIsLoading(true);
    setArtifact(null);
    setHierarchy(null);
    setDraftMembers([]);
    setPreviewUrl(null);
    setIsEditing(false);
    setErrorMessage("");
    setHierarchyMessage("");
    setAutoGenerationReadiness("unknown");

    const load = async () => {
      try {
        const metadata = await projectRepository.getLatestOrganizationChart(projectId);
        if (cancelled) return;
        setArtifact(metadata);

        const blob = await projectRepository.getOrganizationChartBlob(projectId);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);

        try {
          const structure = await projectRepository.getLatestOrganizationChartStructure(projectId);
          if (cancelled) return;
          setHierarchy(structure);
          setDraftMembers(structure.members);
        } catch (error) {
          if (cancelled) return;
          const code = error instanceof ApiError ? apiErrorCode(error) : "";
          if (
            code === "ORGANIZATION_CHART_STRUCTURE_NOT_FOUND" ||
            (error instanceof ApiError && error.status === 404)
          ) {
            setHierarchyMessage(
              "기존 조직도는 계층 편집 정보가 없습니다. 조직도를 다시 생성해 주세요.",
            );
          } else {
            setHierarchyMessage(organizationChartErrorMessage(error));
          }
        }
      } catch (error) {
        if (cancelled) return;
        if (
          error instanceof ApiError &&
          error.status === 404 &&
          apiErrorCode(error) === "ORGANIZATION_CHART_NOT_GENERATED"
        ) {
          setArtifact(null);
          setAutoGenerationReadiness(
            await loadAutoGenerationReadiness(projectId),
          );
          return;
        }
        setErrorMessage(organizationChartErrorMessage(error));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [projectId, reloadKey]);

  const download = async () => {
    if (!artifact || isDownloading) return;
    setIsDownloading(true);
    setErrorMessage("");
    try {
      const downloaded = await projectRepository.downloadOrganizationChart(
        projectId,
        artifact.version,
      );
      const url = URL.createObjectURL(downloaded.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = downloaded.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      const message = organizationChartErrorMessage(error);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsDownloading(false);
    }
  };

  const moveMember = (parentMemberId: string, sourceMemberId?: string) => {
    const memberId = sourceMemberId || draggedMemberId;
    if (!hierarchy || !memberId) return;
    if (memberId === hierarchy.projectManagerMemberId) return;
    if (createsCycle(draftMembers, memberId, parentMemberId)) {
      setHierarchyMessage("순환 보고 관계는 만들 수 없습니다.");
      return;
    }
    const nextOrder = draftMembers.filter(
      (member) => member.parentMemberId === parentMemberId && member.memberId !== memberId,
    ).length;
    setDraftMembers((current) =>
      normalizeSiblingOrder(
        current.map((member) =>
          member.memberId === memberId
            ? { ...member, parentMemberId, order: nextOrder }
            : member,
        ),
      ),
    );
    setHierarchyMessage("");
    setDraggedMemberId(null);
    setDropTargetId(null);
  };

  const cancelEdit = () => {
    setDraftMembers(hierarchy?.members ?? []);
    setIsEditing(false);
    setDraggedMemberId(null);
    setDropTargetId(null);
    setHierarchyMessage("");
  };

  const saveHierarchy = async () => {
    if (!hierarchy || isSaving) return;
    setIsSaving(true);
    setHierarchyMessage("");
    try {
      const saved = await projectRepository.updateOrganizationChartHierarchy(projectId, {
        ...hierarchy,
        members: draftMembers,
      });
      toast.success(`조직도 ${saved.version} 버전에 보고 라인을 반영했습니다.`);
      setIsEditing(false);
      setReloadKey((value) => value + 1);
    } catch (error) {
      const message = organizationChartErrorMessage(error);
      setHierarchyMessage(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileImage className="size-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>조직도</CardTitle>
                <Badge variant="secondary">필수 산출물</Badge>
              </div>
              <CardDescription className="mt-1">
                프로젝트 멤버의 직무와 보고 라인을 기준으로 생성한 조직도입니다.
              </CardDescription>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked disabled aria-label="조직도 필수 산출물" />
            필수 선택
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-14 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            조직도 상태를 불러오는 중입니다.
          </div>
        ) : artifact ? (
          <div className="space-y-5">
            {hierarchy ? (
              <section className="space-y-4 rounded-lg border p-4" aria-label="조직도 보고 라인">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <GitBranch className="size-4 text-primary" />
                      보고 라인
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      v{hierarchy.version} · {hierarchy.members.length}명
                    </p>
                  </div>
                  {canGenerate ? (
                    isEditing ? (
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={cancelEdit} disabled={isSaving}>
                          <Undo2 className="size-4" />
                          취소
                        </Button>
                        <Button type="button" onClick={() => void saveHierarchy()} disabled={isSaving}>
                          {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                          저장
                        </Button>
                      </div>
                    ) : (
                      <Button type="button" variant="outline" onClick={() => setIsEditing(true)}>
                        <Pencil className="size-4" />
                        계층 편집
                      </Button>
                    )
                  ) : null}
                </div>

                {hierarchyMessage ? (
                  <Alert variant="destructive">
                    <AlertDescription>{hierarchyMessage}</AlertDescription>
                  </Alert>
                ) : null}

                {isEditing ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      사람 카드를 다른 사람 위에 놓으면 해당 사람의 산하로 이동합니다.
                    </p>
                    <div
                      data-pm-direct-drop-zone
                      data-drop-state={
                        dropTargetId === PM_DIRECT_DROP_TARGET ? "valid" : "idle"
                      }
                      aria-label="PM 직속 이동 영역"
                      className={cn(
                        "flex min-h-12 items-center justify-center rounded-md border border-dashed px-4 py-3 text-center text-xs text-muted-foreground transition-[border-color,background-color,box-shadow,color]",
                        dropTargetId === PM_DIRECT_DROP_TARGET &&
                          "border-primary bg-primary/10 text-primary ring-2 ring-primary/20",
                      )}
                      onDragOver={(event) => {
                        const sourceId =
                          draggedMemberId || event.dataTransfer.getData("text/plain");
                        if (!sourceId || sourceId === hierarchy.projectManagerMemberId) {
                          event.dataTransfer.dropEffect = "none";
                          return;
                        }
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setDropTargetId(PM_DIRECT_DROP_TARGET);
                      }}
                      onDragLeave={() => {
                        if (dropTargetId === PM_DIRECT_DROP_TARGET) {
                          setDropTargetId(null);
                        }
                      }}
                      onDrop={(event) => {
                        const sourceId =
                          draggedMemberId || event.dataTransfer.getData("text/plain");
                        if (!sourceId || sourceId === hierarchy.projectManagerMemberId) return;
                        event.preventDefault();
                        moveMember(hierarchy.projectManagerMemberId, sourceId);
                      }}
                    >
                      여기에 놓으면 PM 직속으로 이동합니다
                    </div>
                  </div>
                ) : null}

                <HierarchyTree
                  hierarchy={hierarchy}
                  members={draftMembers}
                  editable={canGenerate && isEditing}
                  draggedMemberId={draggedMemberId}
                  dropTargetId={dropTargetId}
                  onDragStart={(memberId) => {
                    setDraggedMemberId(memberId);
                    setDropTargetId(null);
                    setHierarchyMessage("");
                  }}
                  onDragEnd={() => {
                    setDraggedMemberId(null);
                    setDropTargetId(null);
                  }}
                  onDrop={moveMember}
                  onDropTargetChange={setDropTargetId}
                />
              </section>
            ) : hierarchyMessage ? (
              <Alert>
                <AlertDescription>{hierarchyMessage}</AlertDescription>
              </Alert>
            ) : null}

            <section className="space-y-3" aria-label="조직도 산출물 미리보기">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-medium text-foreground">산출물 미리보기</div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isDownloading}
                  onClick={() => void download()}
                >
                  {isDownloading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  다운로드
                </Button>
              </div>
              <div className="flex min-h-56 items-center justify-center overflow-hidden rounded-lg border bg-muted/30 p-3">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="프로젝트 조직도 미리보기"
                    className="max-h-[640px] w-full object-contain"
                  />
                ) : (
                  <div className="text-sm text-muted-foreground">
                    조직도 미리보기를 불러오지 못했습니다.
                  </div>
                )}
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">v{artifact.version}</Badge>
                <Badge variant="outline">{approvalLabel(artifact.approvalStatus)}</Badge>
                <span className="text-muted-foreground">
                  {formatDate(artifact.generatedAt)} · {formatBytes(artifact.fileSize)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-5">
            <div>
              <div className="font-medium text-foreground">
                {autoGenerationReadiness === "ready"
                  ? "조직도 자동 생성 중"
                  : "조직도 준비 중"}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {autoGenerationReadiness === "ready"
                  ? "생성 조건을 모두 충족했습니다. 조직도를 자동으로 생성하고 있습니다."
                  : "생성 조건을 모두 충족하면 조직도가 자동으로 생성됩니다."}
              </p>
            </div>
          </div>
        )}

        {!isLoading && errorMessage ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setReloadKey((value) => value + 1)}>
            <RefreshCw className="size-4" />
            다시 불러오기
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
