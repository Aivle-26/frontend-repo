import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Send,
  Target,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Textarea } from "@/app/components/ui/textarea";
import { type ProjectSummary } from "@/app/data/demoData";
import {
  ApiError,
  projectRepository,
  type WeeklyScrumSubmissionItem,
} from "@/app/api/projectRepository";

/**
 * 개인 위클리 스크럼 제출 화면 (텍스트 입력).
 *
 * 백엔드 `PUT /projects/{id}/weekly-scrums/{weekStartDate}`(SaveWeeklyScrumRequest)에
 * 구조화된 텍스트로 제출한다. 본인 사번은 서버가 토큰에서 결정하며, 조회 시 직원은
 * 본인 제출만 반환된다. PM의 AI 주간 분석이 이 데이터를 그대로 사용한다.
 */

/* ----- 주차(월요일) 계산 ----- */
function startOfWeek(base: Date): Date {
  const date = new Date(base);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // 월요일 기준
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addWeeks(base: Date, weeks: number): Date {
  const date = new Date(base);
  date.setDate(date.getDate() + weeks * 7);
  return date;
}

function weekOfMonth(date: Date): number {
  return Math.ceil(date.getDate() / 7);
}

/** week_start(ISO, 월요일) — 로컬 타임존 기준 YYYY-MM-DD */
function weekStartKey(offset: number): string {
  const monday = addWeeks(startOfWeek(new Date()), offset);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const d = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function weekLabel(offset: number): string {
  const monday = addWeeks(startOfWeek(new Date()), offset);
  return `${monday.getFullYear()}년 ${monday.getMonth() + 1}월 ${weekOfMonth(monday)}주차`;
}

function weekRangeLabel(offset: number): string {
  const monday = addWeeks(startOfWeek(new Date()), offset);
  const sunday = addWeeks(monday, 1);
  sunday.setDate(sunday.getDate() - 1);
  const fmt = (d: Date) => `${d.getMonth() + 1}.${d.getDate()}`;
  return `${fmt(monday)} ~ ${fmt(sunday)}`;
}

interface StaffSubmitProps {
  project: ProjectSummary | null;
  currentUserName: string;
}

export function StaffSubmit({ project, currentUserName }: StaffSubmitProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = useMemo(() => weekStartKey(weekOffset), [weekOffset]);

  const [completedWork, setCompletedWork] = useState("");
  const [plannedWork, setPlannedWork] = useState("");
  const [blockers, setBlockers] = useState("");

  const [existing, setExisting] = useState<WeeklyScrumSubmissionItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 선택 주차의 내 제출 불러오기 (있으면 폼에 채움)
  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    projectRepository
      .getWeeklyScrums(project.id, weekStart)
      .then((rows) => {
        if (cancelled) return;
        const mine = rows[0] ?? null; // 직원 조회는 본인 것만 반환
        setExisting(mine);
        setCompletedWork(mine?.completedWork ?? "");
        setPlannedWork(mine?.plannedWork ?? "");
        setBlockers(mine?.blockers ?? "");
      })
      .catch((caught) => {
        if (cancelled) return;
        setExisting(null);
        setCompletedWork("");
        setPlannedWork("");
        setBlockers("");
        if (!(caught instanceof ApiError && caught.status === 404)) {
          setError(
            caught instanceof ApiError
              ? caught.message
              : "제출 내역을 불러오지 못했습니다.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project, weekStart]);

  const changeWeek = (next: number) => setWeekOffset(next);

  const submit = async () => {
    if (!project) {
      toast.error("프로젝트 정보를 불러오지 못했습니다.");
      return;
    }
    if (!completedWork.trim()) {
      toast.error("이번 주 완료한 일을 입력하세요.");
      return;
    }
    if (!plannedWork.trim()) {
      toast.error("다음 주 계획을 입력하세요.");
      return;
    }
    setSaving(true);
    try {
      const saved = await projectRepository.saveWeeklyScrum(project.id, weekStart, {
        completedWork: completedWork.trim(),
        plannedWork: plannedWork.trim(),
        blockers: blockers.trim() ? blockers.trim() : null,
      });
      setExisting(saved);
      toast.success(`${weekLabel(weekOffset)} 위클리 스크럼을 제출했습니다.`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "제출에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (!project) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <AlertCircle className="size-6 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">
          프로젝트 정보를 불러오는 중이거나, 접근 가능한 프로젝트가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Send className="size-4" /> 위클리 스크럼 제출
              </CardTitle>
              <CardDescription>
                {project.name} · {currentUserName || "직원"}님, 이번 주 진행 상황을 정리해
                제출하세요.
              </CardDescription>
            </div>

            {/* 주차 선택 */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="이전 주"
                onClick={() => changeWeek(weekOffset - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="min-w-40 rounded-lg border border-border px-3 py-1.5 text-center">
                <div className="text-foreground text-sm">{weekLabel(weekOffset)}</div>
                <div className="text-muted-foreground text-xs">
                  {weekRangeLabel(weekOffset)}
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                aria-label="다음 주"
                onClick={() => changeWeek(weekOffset + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" /> 제출 내역 불러오는 중…
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {existing ? (
                  <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                    <CheckCircle2 className="size-3.5" /> 제출됨
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-amber-200 bg-amber-50 text-amber-700"
                  >
                    <Clock className="size-3.5" /> 미제출
                  </Badge>
                )}
                {existing?.updatedAt && (
                  <span className="text-muted-foreground text-xs">
                    최근 저장 {existing.updatedAt.slice(0, 10)}
                  </span>
                )}
                {error && (
                  <span className="flex items-center gap-1 text-red-500 text-xs">
                    <AlertCircle className="size-3.5" /> {error}
                  </span>
                )}
              </div>

              <FormField
                icon={<CheckCircle2 className="size-4 text-emerald-600" />}
                label="완료한 일 (Done)"
                required
              >
                <Textarea
                  value={completedWork}
                  onChange={(e) => setCompletedWork(e.target.value)}
                  placeholder={"한 줄에 하나씩 입력하세요.\n예) 로그인 API 연동 완료\n대시보드 지표 카드 구현"}
                  className="min-h-24"
                />
              </FormField>

              <FormField
                icon={<Target className="size-4 text-blue-600" />}
                label="다음 주 계획 (Todo)"
                required
              >
                <Textarea
                  value={plannedWork}
                  onChange={(e) => setPlannedWork(e.target.value)}
                  placeholder={"한 줄에 하나씩 입력하세요.\n예) 검토 화면 QA\n담당자 배정 반영"}
                  className="min-h-24"
                />
              </FormField>

              <FormField
                icon={<TriangleAlert className="size-4 text-red-600" />}
                label="블로커 · 이슈 (선택)"
              >
                <Textarea
                  value={blockers}
                  onChange={(e) => setBlockers(e.target.value)}
                  placeholder={"진행을 막는 요소가 있으면 적어주세요.\n예) AI 서버 응답 지연으로 통합 테스트 지연"}
                  className="min-h-20"
                />
              </FormField>

              <div className="flex justify-end">
                <Button onClick={() => void submit()} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> 제출 중…
                    </>
                  ) : (
                    <>
                      <Send className="size-3.5" /> {existing ? "수정 제출" : "위클리 스크럼 제출"}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">
        제출한 내용은 PM의 AI 주간 종합 분석에 사용됩니다. 같은 주차에 다시 제출하면 기존
        내용이 갱신됩니다.
      </p>
    </div>
  );
}

function FormField({
  icon,
  label,
  required = false,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-foreground text-sm">
        {icon}
        {label}
        {required && <span className="text-red-500">*</span>}
      </div>
      {children}
    </div>
  );
}
