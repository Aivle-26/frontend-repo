import { useEffect, useMemo, useState } from "react";
import {
  ListChecks,
  Sparkles,
  RefreshCcw,
  Save,
  Send,
  AlertCircle,
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
        setTasks(res);
        setCheckedTaskIds(new Set(res.filter((t) => t.status !== "TODO").map((t) => t.wbsId)));
      })
      .catch(() => {
        if (!ignore) setTasks([]);
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

  /** 체크된 업무를 바탕으로 초안 문장을 조립한다 (실제 AI 호출 아님, 프론트 로직). */
  const generateDraft = () => {
    const checked = tasks.filter((t) => checkedTaskIds.has(t.wbsId));
    const doneLines = checked
      .filter((t) => t.status === "COMPLETED")
      .map((t) => `• ${t.taskName}을(를) 완료했습니다.`);
    const inProgressLines = checked
      .filter((t) => t.status === "IN_PROGRESS" || t.status === "REVIEW")
      .map((t) => `• ${t.taskName} 진행 중입니다. (${t.progressRate}% 완료)`);
    const delayedLines = checked
      .filter((t) => t.overdue || t.status === "DELAYED")
      .map((t) => `• ${t.taskName}이(가) 지연되고 있습니다. 확인이 필요합니다.`);

    setCompletedWork(doneLines.join("\n") || "");
    setInProgressWork(inProgressLines.join("\n") || "");
    setBlockers(delayedLines.join("\n") || "");
    setPlannedWork((prev) => prev || "• ");
    toast.success("체크한 업무를 바탕으로 초안을 만들었어요. 내용을 확인하고 수정해 주세요.");
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
            <span className="text-muted-foreground">대상 프로젝트</span>
            <span className="text-foreground">{projectName || "-"}</span>
          </div>
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
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="size-4" /> 이번 주 업무 요약
            </CardTitle>
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
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-emerald-50 py-3">
                    <p className="text-emerald-700 text-xs">완료</p>
                    <p className="text-emerald-700 text-lg">{counts.done}건</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 py-3">
                    <p className="text-amber-700 text-xs">진행 중</p>
                    <p className="text-amber-700 text-lg">{counts.inProgress}건</p>
                  </div>
                  <div className="rounded-lg bg-red-50 py-3">
                    <p className="text-red-700 text-xs">지연</p>
                    <p className="text-red-700 text-lg">{counts.delayed}건</p>
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

        {/* AI 스크럼 초안 */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-4" /> AI 스크럼 초안
                </CardTitle>
                <CardDescription>
                  내 업무 진행 현황을 바탕으로 초안을 만들었어요. 내용을 확인하고 수정해 주세요.
                </CardDescription>
              </div>
              <Button size="sm" onClick={generateDraft} disabled={tasksLoading}>
                <Sparkles className="size-3.5" /> AI 초안 생성
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {existingLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-muted-foreground text-sm">이번 주 완료한 일</label>
                  <Textarea
                    value={completedWork}
                    onChange={(e) => setCompletedWork(e.target.value)}
                    rows={3}
                    placeholder="• 완료한 업무를 적어주세요"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-muted-foreground text-sm">진행 중인 일</label>
                  <Textarea
                    value={inProgressWork}
                    onChange={(e) => setInProgressWork(e.target.value)}
                    rows={3}
                    placeholder="• 진행 중인 업무를 적어주세요"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-muted-foreground text-sm">블로커 및 이슈</label>
                  <Textarea
                    value={blockers}
                    onChange={(e) => setBlockers(e.target.value)}
                    rows={3}
                    placeholder="• 막히고 있는 부분이 있다면 적어주세요"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-muted-foreground text-sm">다음 주 계획</label>
                  <Textarea
                    value={plannedWork}
                    onChange={(e) => setPlannedWork(e.target.value)}
                    rows={3}
                    placeholder="• 다음 주 계획을 적어주세요"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button variant="outline" size="sm" onClick={generateDraft}>
                    <RefreshCcw className="size-3.5" /> 초안 다시 생성
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void handleSave(false)}
                      disabled={saving || submitting}
                    >
                      <Save className="size-4" /> {saving ? "저장 중…" : "임시 저장"}
                    </Button>
                    <Button
                      onClick={() => void handleSave(true)}
                      disabled={saving || submitting}
                    >
                      <Send className="size-4" /> {submitting ? "제출 중…" : "위클리 스크럼 제출"}
                    </Button>
                  </div>
                </div>
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