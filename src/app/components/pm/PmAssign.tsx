import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Inbox,
  CheckCircle2,
  Gauge,
  Sparkles,
  CalendarClock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import { Progress } from "@/app/components/ui/progress";
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { cn } from "@/app/components/ui/utils";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Checkbox } from "@/app/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/app/components/ui/collapsible";
import { demoRepository } from "@/app/data/demoRepository";
import {
  projectRequirements,
  type ProjectSummary,
  type Requirement,
} from "@/app/data/demoData";
import {
  projectRepository,
  ApiError,
  type AssignmentRecommendation,
  type TeamMemberResponse,
  type ProjectMemberResponse,
  type MemberProgress,
  type WbsTask,
} from "@/app/api/projectRepository";
import { CountUp } from "@/app/components/common/CountUp";
import { TeamProgressDelayCard } from "@/app/components/common/TeamProgressDelayCard";

type AssignFilter = "미배정" | "배정됨" | "전체";

interface AssignRow extends Requirement {
  owner: string;
  due: string;
}

function priorityVariant(p: string) {
  if (p === "높음") return "destructive" as const;
  if (p === "중간") return "secondary" as const;
  return "outline" as const;
}

const ASSIGNED_STATES = ["배정됨", "검토중", "완료"];

// Radix Select는 빈 문자열을 SelectItem value로 허용하지 않아 별도 센티널을 쓴다.
// 선택 시 내부 상태에는 ""(미선택)로 저장한다.
const UNSELECTED_VALUE = "__unselected__";

/** 담당자 추천 결과와 사용자가 선택한 담당자를 프로젝트별로 보존한다. */
interface AssignRecommendationCache {
  assignRecs: AssignmentRecommendation[];
  candidates: { employeeNumber: string; name: string; email: string; availableHoursPerWeek: number }[];
  unassignedIds: number[];
  selectedMember: Record<number, string>;
  hasRecommended: boolean;
}
const assignRecommendationCache = new Map<string, AssignRecommendationCache>();

// 같은 브라우저 탭에서는 다른 화면으로 이동하거나 새로고침해도 추천 결과가 유지된다.
// 탭을 닫으면 제거해 오래된 WBS/팀원 정보가 다음 작업 세션에 남지 않게 한다.
const ASSIGN_REC_STORAGE_PREFIX = "aipm.assignRec.v2.";

function readPersistedRecommendation(projectId: string): AssignRecommendationCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ASSIGN_REC_STORAGE_PREFIX + projectId);
    return raw ? (JSON.parse(raw) as AssignRecommendationCache) : null;
  } catch {
    return null;
  }
}

function writePersistedRecommendation(projectId: string, value: AssignRecommendationCache) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ASSIGN_REC_STORAGE_PREFIX + projectId, JSON.stringify(value));
  } catch {
    // 저장 실패(용량/직렬화)는 무시한다.
  }
}

export function PmAssign({
  project,
  onNavigateNext,
}: {
  project: ProjectSummary;
  onNavigateNext?: () => void;
}) {
  const requirements = projectRequirements(project);

  // 화면 행의 원천은 AI 응답이 아니라 확정된 전체 말단 WBS다.
  const [finalWbsTasks, setFinalWbsTasks] = useState<WbsTask[]>([]);

  useEffect(() => {
    let ignore = false;
    projectRepository
      .getWbs(project.id)
      .then((res) => {
        if (ignore) return;
        setFinalWbsTasks(res.finalTasks ?? []);
      })
      .catch(() => {
        if (!ignore) setFinalWbsTasks([]);
      });
    return () => {
      ignore = true;
    };
  }, [project.id]);

  // 프로젝트 팀원 관리
  const [allMembers, setAllMembers] = useState<TeamMemberResponse[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMemberResponse[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState("");
  const [memberHours, setMemberHours] = useState<Record<string, number>>({});
  const [savingMembers, setSavingMembers] = useState(false);
  const [membersOpen, setMembersOpen] = useState(true);

  const loadTeamMembers = () => {
    setMembersLoading(true);
    setMembersError("");
    Promise.all([
      projectRepository.getAllTeamMembers(),
      projectRepository.getProjectMembers(project.id),
    ])
      .then(([all, current]) => {
        setAllMembers(all);
        setProjectMembers(current);
        const hours: Record<string, number> = {};
        for (const m of current) {
          hours[m.employeeNumber] = m.availableHoursPerWeek;
        }
        setMemberHours(hours);
        // 이미 등록된 팀원이 있으면 접어서 시작 (화면이 너무 길어지지 않게).
        setMembersOpen(current.length === 0);
      })
      .catch((caught) => {
        setMembersError(
          caught instanceof ApiError
            ? `팀원 목록을 불러오지 못했습니다. (${caught.status}) ${caught.message}`
            : "팀원 목록을 불러오지 못했습니다. 네트워크 상태를 확인해 주세요.",
        );
      })
      .finally(() => setMembersLoading(false));
  };

  useEffect(() => {
    loadTeamMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const projectMemberNumbers = new Set(projectMembers.map((m) => m.employeeNumber));

  const toggleMember = (employeeNumber: string, checked: boolean) => {
    if (checked) {
      setMemberHours((prev) => ({ ...prev, [employeeNumber]: prev[employeeNumber] ?? 40 }));
    } else {
      setMemberHours((prev) => {
        const next = { ...prev };
        delete next[employeeNumber];
        return next;
      });
    }
  };

  const handleSaveMembers = () => {
    setSavingMembers(true);
    projectRepository
      .saveProjectMembers(project.id, {
        members: Object.entries(memberHours).map(([employeeNumber, availableHoursPerWeek]) => ({
          employeeNumber,
          availableHoursPerWeek,
        })),
      })
      .then((saved) => {
        setProjectMembers(saved);
        toast.success("프로젝트 팀원을 저장했어요.");
        setMembersOpen(false);
      })
      .catch((caught) => {
        toast.error(
          caught instanceof ApiError ? caught.message : "팀원 저장에 실패했습니다.",
        );
      })
      .finally(() => setSavingMembers(false));
  };

  // 메모리 캐시 우선, 없으면 현재 탭의 세션 저장소에서 복원한다.
  const cachedRec = useMemo<AssignRecommendationCache | null>(
    () =>
      assignRecommendationCache.get(project.id) ??
      readPersistedRecommendation(project.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project.id],
  );

  const [assignRecs, setAssignRecs] = useState<AssignmentRecommendation[]>(
    () => cachedRec?.assignRecs ?? [],
  );
  // 추천 응답의 candidates = 이 프로젝트의 배정 가능 팀원 전체 명단(드롭다운 목록).
  const [candidates, setCandidates] = useState<
    { employeeNumber: string; name: string; email: string; availableHoursPerWeek: number }[]
  >(() => cachedRec?.candidates ?? []);

  // AI 추천 후보와 프로젝트 담당자 후보를 사번 기준으로 합친다.
  // 백엔드가 project_members 행이 없는 프로젝트 PM도 projectMembers에 포함하므로,
  // 추천 결과에 PM이 없더라도 모든 WBS 드롭다운에서 직접 선택할 수 있다.
  const assignmentCandidates = useMemo(() => {
    const merged = new Map<
      string,
      { employeeNumber: string; name: string; email: string; availableHoursPerWeek: number }
    >();
    for (const member of candidates) merged.set(member.employeeNumber, member);
    for (const member of projectMembers) {
      merged.set(member.employeeNumber, {
        employeeNumber: member.employeeNumber,
        name: member.name,
        email: member.email,
        availableHoursPerWeek: member.availableHoursPerWeek,
      });
    }
    return Array.from(merged.values());
  }, [candidates, projectMembers]);
  // AI가 아예 추천 항목을 만들지 못한 확정 리프 WBS (그래도 최종 저장 땐 반드시 포함해야 함)
  const [unassignedIds, setUnassignedIds] = useState<number[]>(
    () => cachedRec?.unassignedIds ?? [],
  );
  // 자동 호출 방지: 진입 시 추천을 돌리지 않고, 버튼을 눌러야 실행한다.
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [hasRecommended, setHasRecommended] = useState(
    () => cachedRec?.hasRecommended ?? false,
  );
  const [selectedMember, setSelectedMember] = useState<Record<number, string>>(
    () => cachedRec?.selectedMember ?? {},
  );
  const [savingAssignments, setSavingAssignments] = useState(false);

  // 추천 결과와 선택값이 바뀔 때마다 메모리와 현재 탭의 세션 저장소에 저장한다.
  useEffect(() => {
    if (!hasRecommended) return;
    const value: AssignRecommendationCache = {
      assignRecs,
      candidates,
      unassignedIds,
      selectedMember,
      hasRecommended,
    };
    assignRecommendationCache.set(project.id, value);
    writePersistedRecommendation(project.id, value);
  }, [
    project.id,
    assignRecs,
    candidates,
    unassignedIds,
    selectedMember,
    hasRecommended,
  ]);

  const assignmentRows = useMemo(() => {
    const parentExternalIds = new Set(
      finalWbsTasks
        .map((task) => task.parentExternalTaskId)
        .filter((id): id is string => id != null),
    );
    const recommendationByWbsId = new Map(
      assignRecs.map((recommendation) => [Number(recommendation.wbsId), recommendation]),
    );
    const backendUnassignedIds = new Set(unassignedIds.map(Number));

    return finalWbsTasks
      .filter(
        (task): task is WbsTask & { taskId: number } =>
          task.taskId != null &&
          task.confirmed === true &&
          !parentExternalIds.has(task.externalTaskId),
      )
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((wbs) => {
        const wbsId = Number(wbs.taskId);
        const recommendation = recommendationByWbsId.get(wbsId) ?? null;
        const hasRecommendedMember = (recommendation?.recommendedMembers.length ?? 0) > 0;
        return {
          wbsId,
          wbs,
          recommendation,
          recommendedMembers: recommendation?.recommendedMembers ?? [],
          unassigned: backendUnassignedIds.has(wbsId) || !hasRecommendedMember,
        };
      });
  }, [assignRecs, finalWbsTasks, unassignedIds]);

  const loadRecommendations = () => {
    setAssignLoading(true);
    setHasRecommended(true);
    setAssignError("");
    projectRepository
      .recommendAssignments(project.id)
      .then((res) => {
        setAssignRecs(res.assignments ?? []);
        setCandidates(res.candidates ?? []);
        setUnassignedIds(res.unassignedWbsIds ?? []);
        const defaults: Record<number, string> = {};
        for (const a of res.assignments ?? []) {
          if (a.recommendedMembers[0]) {
            defaults[a.wbsId] = a.recommendedMembers[0].employeeNumber;
          }
        }
        // AI가 추천을 만들지 못한 WBS는 비워둔다.
        // 예전엔 candidates[0](= 이름순 첫 팀원)을 자동으로 채웠는데,
        // 그러면 추천과 무관한 같은 사람이 계속 배정된 것처럼 보인다.
        setSelectedMember(defaults);
      })
      .catch((caught) => {
        if (caught instanceof ApiError && caught.status === 404) {
          setAssignRecs([]);
        } else if (caught instanceof ApiError) {
          setAssignError(`담당자 추천을 불러오지 못했습니다. (${caught.status}) ${caught.message}`);
        } else {
          setAssignError("담당자 추천을 불러오지 못했습니다. 네트워크 상태를 확인해 주세요.");
        }
      })
      .finally(() => setAssignLoading(false));
  };

  const handleSaveAssignments = () => {
    const unresolvable: string[] = [];
    const assignments = assignmentRows
      .map((row) => {
        const employeeNumber =
          selectedMember[row.wbsId] ?? row.recommendedMembers[0]?.employeeNumber;
        if (!employeeNumber) {
          unresolvable.push(row.wbs.taskName);
          return null;
        }
        const recommendedMember = row.recommendedMembers.find(
          (member) => member.employeeNumber === employeeNumber,
        );
        return {
          wbsId: row.wbsId,
          employeeNumber,
          assignedHours:
            recommendedMember?.assignedHours ||
            row.recommendation?.estimatedHours ||
            row.wbs.estimatedHours,
        };
      })
      .filter((assignment): assignment is NonNullable<typeof assignment> => assignment !== null);

    if (unresolvable.length > 0) {
      toast.error(
        `담당자가 선택되지 않은 작업이 있어요: ${unresolvable.slice(0, 3).join(", ")}${unresolvable.length > 3 ? ` 외 ${unresolvable.length - 3}건` : ""}. 표에서 담당자를 선택해 주세요.`,
      );
      return;
    }

    if (assignments.length === 0) {
      toast.error("배정할 담당자를 먼저 선택하세요.");
      return;
    }

    setSavingAssignments(true);
    projectRepository
      .saveFinalAssignments(project.id, { assignments })
      .then(() => {
        toast.success("담당자 배정을 저장했어요.");
        // 저장 후 loadRecommendations()를 부르면 AI 추천이 다시 실행되면서
        // PM이 방금 고른 담당자가 AI 1순위로 덮여버린다. 워크로드만 갱신한다.
        loadWorkload();
        setProgressRefreshKey((k) => k + 1);
      })
      .catch((caught) => {
        toast.error(
          caught instanceof ApiError ? caught.message : "배정 저장에 실패했습니다.",
        );
      })
      .finally(() => setSavingAssignments(false));
  };

  const [rows, setRows] = useState<AssignRow[]>(
    requirements.map((r) => ({
      ...r,
      owner: r.status === "미배정" ? "" : r.recommendedOwner,
      due: "",
    })),
  );
  // 미배정 행에서 선택 중인 담당자/마감일 (배정 전 임시 값)
  const [pick, setPick] = useState<Record<number, { owner: string; due: string }>>({});
  const [filter, setFilter] = useState<AssignFilter>("미배정");
  const [query, setQuery] = useState("");

  const isAssigned = (r: AssignRow) => ASSIGNED_STATES.includes(r.status);

  // [AI 업데이트] 미배정 행의 담당자를 AI 추천값으로 다시 채운다.
  const recommendAgain = () => {
    setPick((prev) => {
      const next = { ...prev };
      rows.forEach((r) => {
        if (!isAssigned(r)) {
          next[r.id] = {
            owner: r.recommendedOwner,
            due: next[r.id]?.due ?? "",
          };
        }
      });
      return next;
    });
    toast.success("AI 추천 담당자를 다시 채웠어요.");
  };

  const counts = useMemo(() => {
    const unassigned = rows.filter((r) => !isAssigned(r)).length;
    return {
      미배정: unassigned,
      배정됨: rows.length - unassigned,
      전체: rows.length,
    };
  }, [rows]);

  // 팀 워크로드 (실 데이터: /progress/members, 팀원 진행 현황이랑 같은 API)
  const [workloadMembers, setWorkloadMembers] = useState<MemberProgress[]>([]);
  const [workloadLoading, setWorkloadLoading] = useState(true);
  const [workloadError, setWorkloadError] = useState("");
  // 배정 저장 성공 후 "팀원 진행 현황" 카드를 강제로 다시 불러오기 위한 리마운트 키
  const [progressRefreshKey, setProgressRefreshKey] = useState(0);

  const loadWorkload = () => {
    setWorkloadLoading(true);
    setWorkloadError("");
    projectRepository
      .getTeamProgress(project.id)
      .then((res) => {
        setWorkloadMembers(res.members ?? []);
      })
      .catch((caught) => {
        if (caught instanceof ApiError && caught.status === 404) {
          setWorkloadMembers([]);
        } else {
          setWorkloadError("팀 워크로드를 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        setWorkloadLoading(false);
      });
  };

  // AI 담당자 추천을 실행한 뒤에만 워크로드를 불러온다(그 전엔 화면에 표시하지 않음).
  useEffect(() => {
    if (!hasRecommended) return;
    loadWorkload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, hasRecommended]);

  const maxWorkloadHours = Math.max(1, ...workloadMembers.map((m) => m.totalEstimatedHours));
  const topWorkloadMember = useMemo(() => {
    let name = "-";
    let max = -1;
    workloadMembers.forEach((m) => {
      if (m.totalEstimatedHours > max) {
        max = m.totalEstimatedHours;
        name = m.name;
      }
    });
    return { name, hours: Math.max(0, max) };
  }, [workloadMembers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const byTab =
        filter === "전체" ||
        (filter === "미배정" ? !isAssigned(r) : isAssigned(r));
      const byQuery =
        !q ||
        r.text.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.recommendedOwner.toLowerCase().includes(q);
      return byTab && byQuery;
    });
  }, [rows, filter, query]);

  const setPickOwner = (id: number, owner: string) =>
    setPick((p) => ({ ...p, [id]: { owner, due: p[id]?.due ?? "" } }));
  const setPickDue = (id: number, due: string) =>
    setPick((p) => ({ ...p, [id]: { owner: p[id]?.owner ?? "", due } }));

  const assign = async (r: AssignRow) => {
    const chosen = pick[r.id]?.owner || r.recommendedOwner;
    const due = pick[r.id]?.due ?? "";
    await demoRepository.assignRequirement({
      requirementId: r.id,
      assignee: chosen,
      dueDate: due,
    });
    setRows((prev) =>
      prev.map((x) =>
        x.id === r.id ? { ...x, owner: chosen, due, status: "배정됨" } : x,
      ),
    );
    toast.success(`"${r.text.slice(0, 14)}…" 업무를 ${chosen}님에게 배정했어요.`);
  };

  const unassign = (r: AssignRow) => {
    setRows((prev) =>
      prev.map((x) =>
        x.id === r.id ? { ...x, owner: "", due: "", status: "미배정" } : x,
      ),
    );
    toast("배정을 취소했어요.");
  };

  return (
    <div className="space-y-6">
      {/* 프로젝트 팀원 관리 */}
      <Card>
        <Collapsible open={membersOpen} onOpenChange={setMembersOpen}>
          <CardHeader className={cn(!membersOpen && "py-4")}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Users className="size-4 shrink-0 text-muted-foreground" />
                <CardTitle className="truncate text-lg font-semibold tracking-tight">프로젝트 팀원 관리</CardTitle>
              </div>

              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center gap-2 rounded-md border px-3.5 text-[0.9rem] font-semibold shadow-sm outline-none transition-all hover:-translate-y-px hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50",
                    projectMembers.length > 0
                      ? "border-teal-300 bg-white text-teal-800 hover:border-teal-400 hover:bg-teal-50 dark:border-violet-700 dark:bg-black/30 dark:text-violet-200 dark:hover:bg-violet-950/55"
                      : "border-amber-300 bg-white text-amber-800 hover:border-amber-400 hover:bg-amber-50 dark:border-amber-700/70 dark:bg-black/30 dark:text-amber-300",
                  )}
                  aria-label={membersOpen ? "프로젝트 팀원 관리 접기" : "프로젝트 팀원 관리 열기"}
                  aria-expanded={membersOpen}
                >
                  {membersLoading
                    ? "팀원 불러오는 중"
                    : membersError
                      ? "팀원 목록 확인"
                      : projectMembers.length > 0
                        ? membersOpen
                          ? "팀원 관리 접기"
                          : `팀원 ${projectMembers.length}명 관리`
                        : membersOpen
                          ? "등록 화면 접기"
                          : "팀원 등록하기"}
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 transition-transform",
                      membersOpen && "rotate-180",
                    )}
                  />
                </button>
              </CollapsibleTrigger>
            </div>
            {membersOpen && (
              <CardDescription className="mt-1 text-[0.82rem] leading-5 text-muted-foreground">
                체크한 팀원이 이 프로젝트의 "담당자 추천" 후보가 됩니다. 저장해야 반영돼요.
              </CardDescription>
            )}
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
          {membersLoading && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}

          {!membersLoading && membersError && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <AlertCircle className="size-4" /> {membersError}
            </div>
          )}

          {!membersLoading && !membersError && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>이름</TableHead>
                    <TableHead>역할</TableHead>
                    <TableHead>역량 등록</TableHead>
                    <TableHead className="text-right">주당 가능 시간</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allMembers.map((m) => {
                    const checked = m.employeeNumber in memberHours;
                    return (
                      <TableRow key={m.employeeNumber}>
                        <TableCell>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => toggleMember(m.employeeNumber, !!v)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="text-foreground">{m.name}</div>
                          <div className="text-muted-foreground text-xs">{m.email}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {m.roles.map((role) => (
                              <Badge key={role} variant="outline" className="font-normal">
                                {role}
                              </Badge>
                            ))}
                            {m.roles.length === 0 && (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {m.capabilityRegistered ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-200 bg-emerald-50 text-sm font-normal text-emerald-700"
                            >
                              등록됨
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-amber-200 bg-amber-50 text-sm font-normal text-amber-700"
                            >
                              미등록
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            max={168}
                            disabled={!checked}
                            value={memberHours[m.employeeNumber] ?? 0}
                            onChange={(e) =>
                              setMemberHours((prev) => ({
                                ...prev,
                                [m.employeeNumber]: Number(e.target.value) || 0,
                              }))
                            }
                            className="ml-auto w-24 text-right"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {allMembers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        등록된 직원이 없습니다.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-xs">
                  "역량 미등록" 팀원은 담당자 추천에 활용되지 않을 수 있어요.
                </p>
                <Button onClick={handleSaveMembers} disabled={savingMembers}>
                  {savingMembers ? "저장 중…" : "팀원 저장"}
                </Button>
              </div>
            </>
          )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* 담당자 추천 */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg font-semibold tracking-tight">담당자 추천</CardTitle>
            <div className="flex items-center gap-2">
              {!assignLoading && !assignError && hasRecommended && (
                <Badge variant="outline" className="font-normal">
                  AI 추천 {assignRecs.length}건
                </Badge>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={loadRecommendations}
                disabled={assignLoading}
              >
                {assignLoading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> 추천 중…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5" />
                    {hasRecommended ? "다시 추천" : "AI 담당자 추천"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {assignLoading && (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {!assignLoading && assignError && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <AlertCircle className="size-4" /> {assignError}
            </div>
          )}

          {!assignLoading && !assignError && !hasRecommended && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
              <Sparkles className="size-6 text-muted-foreground" />
              <p className="text-foreground text-sm">
                아직 담당자 추천을 실행하지 않았습니다.
              </p>
              <p className="max-w-xs text-muted-foreground text-xs">
                화면 진입 시 자동으로 추천하지 않습니다. 위 [AI 담당자 추천] 버튼을 눌러 실행하세요.
              </p>
              <Button size="sm" onClick={loadRecommendations}>
                <Sparkles className="size-3.5" /> AI 담당자 추천 실행
              </Button>
            </div>
          )}

          {!assignLoading && !assignError && assignmentRows.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>작업</TableHead>
                    <TableHead>필요 역할</TableHead>
                    <TableHead>추천 담당자</TableHead>
                    <TableHead className="text-right">적합도</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignmentRows.map((row) => {
                    const rec = row.recommendation;
                    const recRank = new Map(
                      row.recommendedMembers.map((m, i) => [m.employeeNumber, i] as const),
                    );
                    // AI 추천이 있으면 그 사람으로, 없으면 "선택 안 됨"으로 둔다(첫 팀원 자동선택 금지).
                    const selected =
                      selectedMember[row.wbsId] ??
                      row.recommendedMembers[0]?.employeeNumber ??
                      "";
                    const recMember = row.recommendedMembers.find(
                      (m) => m.employeeNumber === selected,
                    );
                    // PM이 프로젝트 팀원 중에서 직접 고를 수 있어야 하므로 전원을 보여준다.
                    // AI가 추천한 사람에겐 "(AI n순위)"가 붙고 1순위가 기본 선택되며,
                    // 추천이 없는 작업은 선택되지 않은 상태로 두고 PM이 고른다.
                    const options = assignmentCandidates.length > 0
                      ? assignmentCandidates
                      : row.recommendedMembers;
                    return (
                      <TableRow key={row.wbsId}>
                        <TableCell>
                          <div className="text-foreground">{row.wbs.taskName}</div>
                          <div className="text-muted-foreground text-xs">
                            {rec?.estimatedHours ?? row.wbs.estimatedHours}시간 · {(rec?.estimatedMm ?? row.wbs.estimatedHours / 160).toFixed(2)} MM
                            {row.unassigned && " · AI 추천 없음 · 직접 배정 필요"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {(rec?.requiredRoleCode ?? row.wbs.requiredSkills.join(", ")) || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={selected || UNSELECTED_VALUE}
                            onValueChange={(v) =>
                              setSelectedMember((prev) => ({
                                ...prev,
                                [row.wbsId]: v === UNSELECTED_VALUE ? "" : v,
                              }))
                            }
                          >
                            <SelectTrigger className="w-56">
                              <SelectValue placeholder="선택되지 않음" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={UNSELECTED_VALUE}>
                                <span className="text-muted-foreground">선택되지 않음</span>
                              </SelectItem>
                              {options.map((m) => {
                                const rank = recRank.get(m.employeeNumber);
                                return (
                                  <SelectItem key={m.employeeNumber} value={m.employeeNumber}>
                                    {m.name}
                                    {rank !== undefined ? ` (AI ${rank + 1}순위)` : ""}
                                  </SelectItem>
                                );
                              })}
                              {options.length === 0 && (
                                <div className="px-2 py-1.5 text-muted-foreground text-xs">
                                  후보 팀원이 없습니다. 위에서 팀원을 저장하세요.
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          {recMember ? (
                            <>
                              <span className="text-foreground">
                                {Math.round(recMember.recommendationScore)}점
                              </span>
                              {recRank.get(selected) === 0 && (
                                <span className="ml-1.5 text-muted-foreground text-xs">
                                  · 추천
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-xs">
                  {hasRecommended
                    ? "AI 추천값이 기본 선택되어 있습니다."
                    : "AI 추천 전에도 모든 확정 말단 WBS를 직접 배정할 수 있습니다."}
                </p>
                <Button onClick={handleSaveAssignments} disabled={savingAssignments}>
                  {savingAssignments ? "저장 중…" : "배정 저장"}
                </Button>
              </div>
            </>
          )}

          {!assignLoading && !assignError && assignmentRows.length === 0 && hasRecommended && (
            <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              배정할 확정 말단 WBS가 없습니다. WBS를 먼저 확정해 주세요.
            </div>
          )}
        </CardContent>
      </Card>

      {/* 팀원 진행 현황 · 팀 워크로드 — AI 담당자 추천 실행 후에만 표시 */}
      {hasRecommended && (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <TeamProgressDelayCard key={progressRefreshKey} projectId={project.id} />

        {/* 팀 워크로드 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <Users className="size-4" /> 팀 워크로드
            </CardTitle>
            <CardDescription className="mt-1 text-[0.82rem] leading-5 text-muted-foreground">배정된 업무의 예상 공수(시간) 기준이에요.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {workloadLoading && (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            )}

            {!workloadLoading && workloadError && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <AlertCircle className="size-4" /> {workloadError}
              </div>
            )}

            {!workloadLoading && !workloadError && workloadMembers.length === 0 && (
              <p className="py-6 text-center text-muted-foreground text-sm">
                아직 배정된 팀원이 없습니다.
              </p>
            )}

            {!workloadLoading &&
              !workloadError &&
              workloadMembers.map((m) => {
                const pct = Math.round((m.totalEstimatedHours / maxWorkloadHours) * 100);
                const isTop = m.name === topWorkloadMember.name && topWorkloadMember.hours > 0;
                return (
                  <div key={m.employeeNumber} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7">
                        <AvatarFallback className="text-[10px]">
                          {m.name.slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="leading-tight">
                        <div className="text-foreground text-sm">{m.name}</div>
                        <div className="text-muted-foreground text-xs">
                          업무 {m.totalTaskCount}건
                        </div>
                      </div>
                      <span
                        className={cn(
                          "ml-auto rounded-full px-2 py-0.5 text-xs font-medium",
                          isTop
                            ? "bg-amber-50 text-amber-700"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {m.totalEstimatedHours}h
                      </span>
                    </div>
                    <Progress value={pct} />
                  </div>
                );
              })}
          </CardContent>
        </Card>
      </div>
      )}

      {onNavigateNext && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={onNavigateNext}>
            견적 화면으로 이동 <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-3">
          <span className={cn("flex size-11 items-center justify-center rounded-xl", tone)}>
            {icon}
          </span>
          <div className="leading-tight">
            <div className="text-muted-foreground text-sm">{label}</div>
            <div className="text-foreground text-xl">
              <CountUp value={value} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
