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

export function PmAssign({ project }: { project: ProjectSummary }) {
  const requirements = projectRequirements(project);

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
        loadRecommendations();
      })
      .catch((caught) => {
        toast.error(
          caught instanceof ApiError ? caught.message : "팀원 저장에 실패했습니다.",
        );
      })
      .finally(() => setSavingMembers(false));
  };

  const [assignRecs, setAssignRecs] = useState<AssignmentRecommendation[]>([]);
  // 추천 응답의 candidates = 배정 가능한 전체 후보 명단(드롭다운에 사용)
  const [candidates, setCandidates] = useState<
    { employeeNumber: string; name: string; email: string; availableHoursPerWeek: number }[]
  >([]);
  // AI가 아예 추천 항목을 만들지 못한 확정 리프 WBS (그래도 최종 저장 땐 반드시 포함해야 함)
  const [unassignedIds, setUnassignedIds] = useState<number[]>([]);
  // 자동 호출 방지: 진입 시 추천을 돌리지 않고, 버튼을 눌러야 실행한다.
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [hasRecommended, setHasRecommended] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Record<number, string>>({});
  const [savingAssignments, setSavingAssignments] = useState(false);

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
        for (const wbsId of res.unassignedWbsIds ?? []) {
          if (res.candidates?.[0]) {
            defaults[wbsId] = res.candidates[0].employeeNumber;
          }
        }
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

  // 프로젝트가 바뀌면 이전 추천 결과를 비우고, 다시 버튼으로 실행하도록 초기화한다.
  useEffect(() => {
    setAssignRecs([]);
    setCandidates([]);
    setUnassignedIds([]);
    setSelectedMember({});
    setHasRecommended(false);
    setAssignError("");
    setAssignLoading(false);
  }, [project.id]);

  const handleSaveAssignments = () => {
    const unresolvable: string[] = [];

    // 선택된 담당자가 있는 작업만 저장한다. (AI 추천 후보가 아니어도 배정 가능)
    // 백엔드는 확정된 리프 WBS 전부가 정확히 한 번씩 포함되길 요구하므로,
    // AI 추천이 없는 작업은 전체 팀원 후보(candidates) 중 첫 번째로라도 채운다.
    const fromRecs = assignRecs
      .map((rec) => {
        const employeeNumber =
          selectedMember[rec.wbsId] ??
          rec.recommendedMembers[0]?.employeeNumber ??
          candidates[0]?.employeeNumber;
        if (!employeeNumber) {
          unresolvable.push(rec.wbsName);
          return null;
        }
        const recMember = rec.recommendedMembers.find(
          (m) => m.employeeNumber === employeeNumber,
        );
        return {
          wbsId: rec.wbsId,
          employeeNumber,
          assignedHours: recMember?.assignedHours || rec.estimatedHours,
        };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    // AI가 추천 항목 자체를 못 만든 WBS(unassignedWbsIds) — 시간 정보가 없어 1시간으로 채운다.
    const fromUnassigned = unassignedIds
      .map((wbsId) => {
        const employeeNumber = selectedMember[wbsId] ?? candidates[0]?.employeeNumber;
        if (!employeeNumber) {
          unresolvable.push(`WBS #${wbsId}`);
          return null;
        }
        return { wbsId, employeeNumber, assignedHours: 1 };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    const assignments = [...fromRecs, ...fromUnassigned];

    if (unresolvable.length > 0) {
      toast.error(
        `담당 가능한 팀원이 없는 작업이 있어요: ${unresolvable.slice(0, 3).join(", ")}${unresolvable.length > 3 ? ` 외 ${unresolvable.length - 3}건` : ""}. 프로젝트 팀원을 먼저 추가해 주세요.`,
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
        loadRecommendations();
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

  useEffect(() => {
    let ignore = false;
    setWorkloadLoading(true);
    setWorkloadError("");
    projectRepository
      .getTeamProgress(project.id)
      .then((res) => {
        if (ignore) return;
        setWorkloadMembers(res.members ?? []);
      })
      .catch((caught) => {
        if (ignore) return;
        if (caught instanceof ApiError && caught.status === 404) {
          setWorkloadMembers([]);
        } else {
          setWorkloadError("팀 워크로드를 불러오지 못했습니다.");
        }
      })
      .finally(() => {
        if (!ignore) setWorkloadLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [project.id]);

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
          <CollapsibleTrigger asChild>
            <CardHeader
              className={cn(
                "cursor-pointer select-none",
                !membersOpen && "py-4",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Users className="size-4 shrink-0 text-muted-foreground" />
                  <CardTitle className="truncate">프로젝트 팀원 관리</CardTitle>
                  {!membersLoading && !membersError && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 font-normal",
                        !membersOpen &&
                          projectMembers.length > 0 &&
                          "border-emerald-200 bg-emerald-50 text-emerald-700",
                      )}
                    >
                      {projectMembers.length > 0
                        ? `등록됨 ${projectMembers.length}명`
                        : "미등록"}
                    </Badge>
                  )}
                </div>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    membersOpen && "rotate-180",
                  )}
                />
              </div>
              {membersOpen && (
                <CardDescription>
                  체크한 팀원이 이 프로젝트의 "담당자 추천" 후보가 됩니다. 저장해야 반영돼요.
                </CardDescription>
              )}
            </CardHeader>
          </CollapsibleTrigger>
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
                              className="border-emerald-200 bg-emerald-50 font-normal text-emerald-700"
                            >
                              등록됨
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-amber-200 bg-amber-50 font-normal text-amber-700"
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
            <CardTitle>담당자 추천</CardTitle>
            <div className="flex items-center gap-2">
              {!assignLoading && !assignError && hasRecommended && (
                <Badge variant="outline" className="font-normal">
                  AI 추천 {assignRecs.length}건
                  {unassignedIds.length > 0 && ` · 미추천 ${unassignedIds.length}건`}
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

          {!assignLoading && !assignError && hasRecommended && (
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
                  {assignRecs.map((rec) => {
                    const recRank = new Map(
                      rec.recommendedMembers.map((m, i) => [m.employeeNumber, i] as const),
                    );
                    const selected =
                      selectedMember[rec.wbsId] ??
                      rec.recommendedMembers[0]?.employeeNumber ??
                      candidates[0]?.employeeNumber ??
                      "";
                    const recMember = rec.recommendedMembers.find(
                      (m) => m.employeeNumber === selected,
                    );
                    const options =
                      candidates.length > 0 ? candidates : rec.recommendedMembers;
                    return (
                      <TableRow key={rec.wbsId}>
                        <TableCell>
                          <div className="text-foreground">{rec.wbsName}</div>
                          <div className="text-muted-foreground text-xs">
                            {rec.estimatedHours}시간 · {rec.estimatedMm.toFixed(2)} MM
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {rec.requiredRoleCode}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={selected || undefined}
                            onValueChange={(v) =>
                              setSelectedMember((prev) => ({ ...prev, [rec.wbsId]: v }))
                            }
                          >
                            <SelectTrigger className="w-56">
                              <SelectValue placeholder="담당자 선택" />
                            </SelectTrigger>
                            <SelectContent>
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
                  {unassignedIds.map((wbsId) => {
                    const selected = selectedMember[wbsId] ?? candidates[0]?.employeeNumber ?? "";
                    return (
                      <TableRow key={`unassigned-${wbsId}`}>
                        <TableCell>
                          <div className="text-foreground">WBS #{wbsId}</div>
                          <div className="text-muted-foreground text-xs">
                            AI가 추천을 만들지 못했어요 — 직접 선택해 주세요
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-muted-foreground">-</span>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={selected || undefined}
                            onValueChange={(v) =>
                              setSelectedMember((prev) => ({ ...prev, [wbsId]: v }))
                            }
                          >
                            <SelectTrigger className="w-56">
                              <SelectValue placeholder="담당자 선택" />
                            </SelectTrigger>
                            <SelectContent>
                              {candidates.map((m) => (
                                <SelectItem key={m.employeeNumber} value={m.employeeNumber}>
                                  {m.name}
                                </SelectItem>
                              ))}
                              {candidates.length === 0 && (
                                <div className="px-2 py-1.5 text-muted-foreground text-xs">
                                  후보 팀원이 없습니다. 위에서 팀원을 저장하세요.
                                </div>
                              )}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-muted-foreground">-</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {assignRecs.length === 0 && unassignedIds.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        추천할 업무가 없습니다. WBS를 먼저 확정해 주세요.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-xs">
                  AI 추천값이 기본 선택되어 있습니다.
                </p>
                <Button onClick={handleSaveAssignments} disabled={savingAssignments}>
                  {savingAssignments ? "저장 중…" : "배정 저장"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 팀원 진행 현황 (완료율 + 일정 대비 지연) | 팀 워크로드 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <TeamProgressDelayCard projectId={project.id} />

        {/* 팀 워크로드 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4" /> 팀 워크로드
            </CardTitle>
            <CardDescription>배정된 업무의 예상 공수(시간) 기준이에요.</CardDescription>
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