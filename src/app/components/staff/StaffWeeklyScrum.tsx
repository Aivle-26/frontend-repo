import { useEffect, useMemo, useState } from "react";
import {
  ListChecks,
  Send,
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Save,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Textarea } from "@/app/components/ui/textarea";
import { Skeleton } from "@/app/components/ui/skeleton";
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
import { toast } from "sonner";
import {
  projectRepository,
  ApiError,
  type TaskAssignmentResponse,
  type WeeklyScrumSubmissionItem,
} from "@/app/api/projectRepository";

/**
 * 직원용 [위클리 스크럼] 화면.
 *
 * - "이번 주 업무 요약"은 실제 업무 API(GET /tasks/me)에서 가져온다.
 * - "AI 스크럼 초안"의 초안 생성은 실제 AI 호출이 아니라, 체크된 업무를
 *   바탕으로 프론트에서 문장을 조립하는 것이다 (백엔드에 이 기능을 위한
 *   AI 엔드포인트가 아직 없어서). 직접 고쳐 쓸 수 있게 텍스트로 편집 가능.
 * - 저장/제출은 실제 API(PUT /weekly-scrums/{weekStartDate})를 쓴다.
 * - "이전 제출 내역"도 최근 몇 주치를 실제로 조회해서 보여준다.
 */

const HISTORY_WEEKS = 4;

function toMonday(d: Date): Date {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // 월=0
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function fmtISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtShort(d: Date): string {
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

function weekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const weekOfMonth = Math.ceil(monday.getDate() / 7);
  return `${monday.getFullYear()}년 ${monday.getMonth() + 1}월 ${weekOfMonth}주차 · ${fmtShort(monday)} ~ ${fmtShort(sunday)}`;
}

/** 최근 몇 주(이번 주 포함)의 월요일 날짜 목록을 최신순으로 만든다. */
function recentMondays(count: number): Date[] {
  const thisMonday = toMonday(new Date());
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(thisMonday);
    d.setDate(d.getDate() - i * 7);
    return d;
  });
}

interface StaffWeeklyScrumProps {
  projectId: string;
  projectName: string;
  employeeNumber: string;
  currentUserName: string;
}

/** 실제 배정된 업무가 없을 때 보여줄 예시 데이터. */
const DEMO_TASKS: TaskAssignmentResponse[] = [
  {
    assignmentId: -1,
    projectId: -1,
    wbsId: -1,
    taskCode: "1.1",
    taskName: "WBS 정밀 검토 및 범위 보완",
    description: "",
    employeeNumber: "-",
    status: "COMPLETED",
    progressRate: 100,
    startDate: null,
    dueDate: null,
    estimatedHours: 16,
    milestone: false,
    bufferDays: 0,
    overdue: false,
    assignedAt: "",
    updatedAt: "",
  },
  {
    assignmentId: -2,
    projectId: -1,
    wbsId: -2,
    taskCode: "2.1",
    taskName: "안전관리 요구사항 작성",
    description: "",
    employeeNumber: "-",
    status: "COMPLETED",
    progressRate: 100,
    startDate: null,
    dueDate: null,
    estimatedHours: 12,
    milestone: false,
    bufferDays: 0,
    overdue: false,
    assignedAt: "",
    updatedAt: "",
  },
  {
    assignmentId: -3,
    projectId: -1,
    wbsId: -3,
    taskCode: "3.1",
    taskName: "UI/UX 시안 검토 및 피드백",
    description: "",
    employeeNumber: "-",
    status: "IN_PROGRESS",
    progressRate: 60,
    startDate: null,
    dueDate: null,
    estimatedHours: 20,
    milestone: false,
    bufferDays: 0,
    overdue: false,
    assignedAt: "",
    updatedAt: "",
  },
];

export function StaffWeeklyScrum({
  projectId,
  projectName,
  employeeNumber,
  currentUserName,
}: StaffWeeklyScrumProps) {
  const weekOptions = useMemo(() => recentMondays(HISTORY_WEEKS), []);
  const [weekStart, setWeekStart] = useState(fmtISO(weekOptions[0]));

  // 이번 주 업무
  const [tasks, setTasks] = useState<TaskAssignmentResponse[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [isDemoTasks, setIsDemoTasks] = useState(false);
  const [checkedTaskIds, setCheckedTaskIds] = useState<Set<number>>(new Set());

  // 기존 제출 내역(선택 주차)
  const [existing, setExisting] = useState<WeeklyScrumSubmissionItem | null>(null);
  const [existingLoading, setExistingLoading] = useState(true);

  // 이전 제출 내역(최근 N주)
  const [history, setHistory] = useState<
    { weekStart: Date; submission: WeeklyScrumSubmissionItem | null }[]
  >([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [completedWork, setCompletedWork] = useState("");
  const [inProgressWork, setInProgressWork] = useState("");
  const [blockers, setBlockers] = useState("");
  const [plannedWork, setPlannedWork] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 업무 목록 로드
  useEffect(() => {
    let ignore = false;
    setTasksLoading(true);
    projectRepository
      .getMyTasks(projectId)
      .then((res) => {
        if (ignore) return;
        const list = res.length > 0 ? res : DEMO_TASKS;
        setTasks(list);
        setIsDemoTasks(res.length === 0);
        setCheckedTaskIds(new Set(list.filter((t) => t.status !== "TODO").map((t) => t.wbsId)));
      })
      .catch(() => {
        if (ignore) return;
        setTasks(DEMO_TASKS);
        setIsDemoTasks(true);
        setCheckedTaskIds(
          new Set(DEMO_TASKS.filter((t) => t.status !== "TODO").map((t) => t.wbsId)),
        );
      })
      .finally(() => {
        if (!ignore) setTasksLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [projectId]);

  // 선택 주차의 기존 제출 내역 로드 (있으면 폼에 채워넣기)
  useEffect(() => {
    let ignore = false;
    setExistingLoading(true);
    projectRepository
      .getWeeklyScrums(projectId, weekStart)
      .then((list) => {
        if (ignore) return;
        const mine = list.find((s) => s.employeeNumber === employeeNumber) ?? null;
        setExisting(mine);
        if (mine) {
          setCompletedWork(mine.completedWork ?? "");
          setPlannedWork(mine.plannedWork ?? "");
          setBlockers(mine.blockers ?? "");
          const details = mine.details as { inProgressTasks?: { title: string }[] } | null;
          setInProgressWork(
            details?.inProgressTasks?.map((t) => `• ${t.title}`).join("\n") ?? "",
          );
        } else {
          setCompletedWork("");
          setPlannedWork("");
          setBlockers("");
          setInProgressWork("");
        }
      })
      .catch(() => {
        if (!ignore) setExisting(null);
      })
      .finally(() => {
        if (!ignore) setExistingLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [projectId, weekStart, employeeNumber]);

  // 최근 N주 제출 내역
  useEffect(() => {
    let ignore = false;
    setHistoryLoading(true);
    const mondays = recentMondays(HISTORY_WEEKS);
    Promise.all(
      mondays.map((monday) =>
        projectRepository
          .getWeeklyScrums(projectId, fmtISO(monday))
          .then((list) => list.find((s) => s.employeeNumber === employeeNumber) ?? null)
          .catch(() => null),
      ),
    )
      .then((results) => {
        if (ignore) return;
        setHistory(mondays.map((monday, i) => ({ weekStart: monday, submission: results[i] })));
      })
      .finally(() => {
        if (!ignore) setHistoryLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [projectId, employeeNumber]);

  const counts = useMemo(() => {
    let done = 0;
    let inProgress = 0;
    let delayed = 0;
    for (const t of tasks) {
      if (t.status === "COMPLETED") done += 1;
      else if (t.overdue || t.status === "DELAYED") delayed += 1;
      else if (t.status === "IN_PROGRESS" || t.status === "REVIEW") inProgress += 1;
    }
    return { done, inProgress, delayed };
  }, [tasks]);

  const toggleTask = (wbsId: number, checked: boolean) => {
    setCheckedTaskIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(wbsId);
      else next.delete(wbsId);
      return next;
    });
  };

  const buildRequestBody = () => ({
    completedWork: completedWork.trim() || "-",
    plannedWork: plannedWork.trim() || "-",
    blockers: blockers.trim(),
    details: {
      inProgressTasks: inProgressWork
        .split("\n")
        .map((line) => line.replace(/^[•\-]\s*/, "").trim())
        .filter(Boolean)
        .map((title) => ({ title })),
    },
  });

  const handleSave = async (isFinal: boolean) => {
    const setBusy = isFinal ? setSubmitting : setSaving;
    setBusy(true);
    try {
      const saved = await projectRepository.saveWeeklyScrum(
        projectId,
        weekStart,
        buildRequestBody(),
      );
      setExisting(saved);
      toast.success(isFinal ? "위클리 스크럼을 제출했어요." : "임시 저장했어요.");
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 상단 바 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">선택 주차</span>
            <Select value={weekStart} onValueChange={setWeekStart}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {weekOptions.map((d) => (
                  <SelectItem key={fmtISO(d)} value={fmtISO(d)}>
                    {weekLabel(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {!existingLoading && (
          <Badge
            variant="outline"
            className={
              existing
                ? "border-emerald-200 bg-emerald-50 font-normal text-emerald-700"
                : "border-amber-200 bg-amber-50 font-normal text-amber-700"
            }
          >
            {existing ? "제출 완료" : "미제출"}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 이번 주 업무 요약 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="size-4" /> 이번 주 업무 요약
              </CardTitle>
              {!tasksLoading && isDemoTasks && (
                <Badge variant="outline" className="font-normal">
                  예시 데이터
                </Badge>
              )}
            </div>
            <CardDescription>내가 배정된 업무의 진행 현황이에요.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tasksLoading && (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            )}

            {!tasksLoading && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <CheckCircle2 className="size-4" />
                    </span>
                    <div>
                      <p className="text-muted-foreground text-xs">완료</p>
                      <p className="text-foreground text-lg">{counts.done}건</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                      <Clock className="size-4" />
                    </span>
                    <div>
                      <p className="text-muted-foreground text-xs">진행 중</p>
                      <p className="text-foreground text-lg">{counts.inProgress}건</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                      <AlertTriangle className="size-4" />
                    </span>
                    <div>
                      <p className="text-muted-foreground text-xs">지연</p>
                      <p className="text-foreground text-lg">{counts.delayed}건</p>
                    </div>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>업무명</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>진행률</TableHead>
                      <TableHead className="text-right">스크럼 포함</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((t) => (
                      <TableRow key={t.wbsId}>
                        <TableCell>
                          <div className="text-foreground">{t.taskName}</div>
                          <div className="text-muted-foreground text-xs">{t.taskCode}</div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              t.status === "COMPLETED"
                                ? "border-emerald-200 bg-emerald-50 font-normal text-emerald-700"
                                : t.overdue || t.status === "DELAYED"
                                  ? "border-red-200 bg-red-50 font-normal text-red-700"
                                  : "border-amber-200 bg-amber-50 font-normal text-amber-700"
                            }
                          >
                            {t.status === "COMPLETED"
                              ? "완료"
                              : t.overdue || t.status === "DELAYED"
                                ? "지연"
                                : "진행 중"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {t.progressRate}%
                        </TableCell>
                        <TableCell className="text-right">
                          <Checkbox
                            checked={checkedTaskIds.has(t.wbsId)}
                            onCheckedChange={(v) => toggleTask(t.wbsId, !!v)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {tasks.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                          배정된 업무가 없습니다.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <p className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <AlertCircle className="size-3.5" /> 선택한 업무만 스크럼 초안에 포함됩니다.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* 위클리 스크럼 제출 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="size-4" /> 위클리 스크럼 제출
            </CardTitle>
            <CardDescription>
              {projectName} · {currentUserName}님, 이번 주 진행 상황을 정리해 제출하세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {existingLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      existing
                        ? "border-emerald-200 bg-emerald-50 font-normal text-emerald-700"
                        : "font-normal"
                    }
                  >
                    {existing ? "제출됨" : "미제출"}
                  </Badge>
                  {existing && (
                    <span className="text-muted-foreground text-xs">
                      최근 저장 {existing.updatedAt.slice(0, 10)}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1 text-foreground text-sm">
                    완료한 일 (Done) <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    value={completedWork}
                    onChange={(e) => setCompletedWork(e.target.value)}
                    rows={4}
                    placeholder="이번 주에 완료한 업무를 적어주세요"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1 text-foreground text-sm">
                    다음 주 계획 (Todo) <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    value={plannedWork}
                    onChange={(e) => setPlannedWork(e.target.value)}
                    rows={4}
                    placeholder="다음 주 계획을 적어주세요"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1 text-foreground text-sm">
                    <AlertCircle className="size-3.5 text-red-500" /> 블로커 · 이슈 (선택)
                  </label>
                  <Textarea
                    value={blockers}
                    onChange={(e) => setBlockers(e.target.value)}
                    rows={4}
                    placeholder="막히고 있는 부분이 있다면 적어주세요"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void handleSave(false)}
                    disabled={saving || submitting}
                  >
                    <Save className="size-4" /> {saving ? "저장 중…" : "임시 저장"}
                  </Button>
                  <Button
                    onClick={() => void handleSave(true)}
                    disabled={saving || submitting || !completedWork.trim() || !plannedWork.trim()}
                  >
                    <Send className="size-4" />
                    {submitting ? "제출 중…" : existing ? "수정 제출" : "제출"}
                  </Button>
                </div>

                <p className="text-muted-foreground text-xs">
                  제출한 내용은 PM의 AI 주간 종합 분석에 사용됩니다. 같은 주차에 다시 제출하면
                  기존 내용이 갱신됩니다.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 이전 제출 내역 */}
      <Card>
        <CardHeader>
          <CardTitle>이전 제출 내역</CardTitle>
          <CardDescription>지금까지 제출한 위클리 스크럼 내역이에요.</CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {!historyLoading && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>주차</TableHead>
                  <TableHead>제출일</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>제출자</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map(({ weekStart: monday, submission }) => (
                  <TableRow key={fmtISO(monday)}>
                    <TableCell>{weekLabel(monday)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {submission
                        ? new Date(submission.updatedAt).toLocaleString("ko-KR", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {submission ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-200 bg-emerald-50 font-normal text-emerald-700"
                        >
                          제출 완료
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-normal">
                          미제출
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {submission ? currentUserName : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}