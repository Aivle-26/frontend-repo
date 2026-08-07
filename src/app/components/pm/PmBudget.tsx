import { useCallback, useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Sparkles, AlertCircle, Save, ChevronDown } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { cn } from "@/app/components/ui/utils";
import { AiFeatureHeader } from "@/app/components/common/AiFeatureHeader";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Checkbox } from "@/app/components/ui/checkbox";
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
  type WbsTask,
  type ProjectSummary,
  type ServiceScale,
  type CostEstimateResponse,
  type CostEstimateRequestBody,
} from "@/app/api/projectRepository";
import { markProjectBudgetCompleted } from "@/app/projects/projectProgress";

/**
 * [예산] 페이지.
 *
 * WBS별 예상 공수(MM)는 실제 WBS API에서 가져오고, 비용 계산은 실제 백엔드
 * 비용 견적 API(POST /costs/estimate, PUT /costs/final)를 그대로 사용한다.
 */

const WORKING_HOURS_PER_MM = 160;

/**
 * "AI 견적 분석" 결과를 프로젝트별로 메모리에 기억해둔다.
 * 다른 화면에 갔다가 돌아와도 그래프가 사라지지 않게 하기 위한 것으로,
 * 새로고침하면 사라진다(의도된 동작). PmAssign의 추천 캐시와 같은 방식.
 */
const costEstimateCache = new Map<string, CostEstimateResponse>();

const SCALE_OPTIONS: { value: ServiceScale; label: string }[] = [
  { value: "SMALL", label: "소규모" },
  { value: "MEDIUM", label: "중규모" },
  { value: "LARGE", label: "대규모" },
];

const DURATION_OPTIONS = [3, 6, 12, 18, 24];

function formatWon(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function renderPiePercentLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  payload,
}: any) {
  if (!percent || percent <= 0) return null;

  const RADIAN = Math.PI / 180;
  const centerX = Number(cx);
  const centerY = Number(cy);
  const inner = Number(innerRadius);
  const outer = Number(outerRadius);
  const radius = inner + (outer - inner) * 0.53;
  const x = centerX + radius * Math.cos(-midAngle * RADIAN);
  const y = centerY + radius * Math.sin(-midAngle * RADIAN);
  const textColor = payload?.color === "#7DD3FC" ? "#0f172a" : "#ffffff";

  return (
    <text
      x={x}
      y={y}
      fill={textColor}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={700}
      style={{ pointerEvents: "none" }}
    >
      {(percent * 100).toFixed(1)}%
    </text>
  );
}

interface PmBudgetProps {
  project: ProjectSummary;
}

export function PmBudget({ project }: PmBudgetProps) {
  const [wbsTasks, setWbsTasks] = useState<WbsTask[]>([]);
  const [wbsLoading, setWbsLoading] = useState(true);
  const [wbsError, setWbsError] = useState("");

  const [unitCost, setUnitCost] = useState(8000000);
  const [durationMonths, setDurationMonths] = useState(12);
  const [scale, setScale] = useState<ServiceScale>("MEDIUM");
  const [licenseUsers, setLicenseUsers] = useState(20);
  const [includeAiApi, setIncludeAiApi] = useState(true);
  const [includeVat, setIncludeVat] = useState(true);

  const [result, setResult] = useState<CostEstimateResponse | null>(
    () => costEstimateCache.get(String(project.id)) ?? null,
  );
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ignore = false;
    setWbsLoading(true);
    setWbsError("");

    projectRepository
      .getWbs(project.id)
      .then((res) => {
        if (ignore) return;
        setWbsTasks([...(res.finalTasks ?? [])].sort((a, b) => a.orderIndex - b.orderIndex));
      })
      .catch((caught) => {
        if (ignore) return;
        if (caught instanceof ApiError && caught.status === 404) {
          setWbsTasks([]);
        } else {
          setWbsError("WBS 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
      })
      .finally(() => {
        if (!ignore) setWbsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [project.id]);

  // 저장된 최종 견적이 있으면 화면 진입 시 복원한다.
  // 메모리 캐시만으로는 새로고침이나 앱 재진입 때 그래프가 사라진다.
  useEffect(() => {
    let ignore = false;
    projectRepository
      .getFinalCostEstimate(project.id)
      .then((saved) => {
        if (ignore) return;
        setResult(saved);
        costEstimateCache.set(String(project.id), saved);
      })
      .catch(() => {
        // 저장된 견적이 없으면(404) 아무것도 하지 않는다. 캐시가 있으면 그대로 유지된다.
      });
    return () => {
      ignore = true;
    };
  }, [project.id]);

  const wbsRows = useMemo(
    () =>
      wbsTasks.map((t) => ({
        id: t.externalTaskId,
        taskId: t.taskId,
        name: t.taskName,
        role: t.requiredSkills.length > 0 ? t.requiredSkills.join(", ") : "-",
        mm: t.estimatedHours / WORKING_HOURS_PER_MM,
      })),
    [wbsTasks],
  );

  const totalMm = wbsRows.reduce((sum, r) => sum + r.mm, 0);
  const wbsByRole = useMemo(() => {
    const map = new Map<string, typeof wbsRows>();
    for (const row of wbsRows) {
      const list = map.get(row.role) ?? [];
      list.push(row);
      map.set(row.role, list);
    }
    return Array.from(map.entries()).map(([role, rows]) => ({
      role,
      rows,
      totalMm: rows.reduce((sum, r) => sum + r.mm, 0),
    }));
  }, [wbsRows]);
  const [openRoles, setOpenRoles] = useState<Set<string>>(new Set());
  const toggleRole = (role: string) => {
    setOpenRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };
  const unsavedCount = wbsRows.filter((r) => r.taskId == null).length;

  const buildRequestBody = useCallback((): CostEstimateRequestBody | null => {
    // 백엔드는 리프(자식 없는) WBS 태스크만 billable로 받는다.
    // 다른 태스크의 parentExternalTaskId로 참조되는 부모/단계 노드는 제외한다.
    const parentExternalIds = new Set(
      wbsTasks
        .map((t) => t.parentExternalTaskId)
        .filter((p): p is string => p != null),
    );
    const wbsEfforts = wbsRows
      .filter((r): r is typeof r & { taskId: number } => r.taskId != null)
      .filter((r) => !parentExternalIds.has(r.id))
      .map((r) => ({ wbsId: r.taskId, estimatedMm: r.mm }));

    if (wbsEfforts.length === 0) return null;

    return {
      wbsEfforts,
      averageMonthlyUnitPrice: unitCost,
      operationMonths: durationMonths,
      serviceScale: scale,
      usesAiApi: includeAiApi,
      paidLicenseUserCount: licenseUsers,
      includeVat,
    };
  }, [wbsRows, wbsTasks, unitCost, durationMonths, scale, includeAiApi, licenseUsers, includeVat]);

  const runEstimate = useCallback(async () => {
    const body = buildRequestBody();
    if (!body) {
      setEstimateError("확정된(저장된) WBS 항목이 없어 견적을 계산할 수 없습니다.");
      return;
    }
    setEstimating(true);
    setEstimateError("");
    try {
      const estimated = await projectRepository.estimateProjectCost(
        project.id,
        body,
      );
      setResult(estimated);
      costEstimateCache.set(String(project.id), estimated);
    } catch (caught) {
      setEstimateError(
        caught instanceof ApiError ? caught.message : "견적 계산에 실패했습니다.",
      );
    } finally {
      setEstimating(false);
    }
  }, [buildRequestBody, project.id]);

  // 자동 실행하지 않는다. 페이지 로드마다 API가 낭비되므로, 사용자가 "분석하기" 버튼을
  // 눌렀을 때만 runEstimate()가 호출된다.

  const handleSaveFinal = async () => {
    const body = buildRequestBody();
    if (!body) {
      toast.error("확정된 WBS 항목이 없어 저장할 수 없습니다.");
      return;
    }
    setSaving(true);
    try {
      const saved = await projectRepository.saveFinalCostEstimate(project.id, body);
      setResult(saved);
      costEstimateCache.set(String(project.id), saved);
      if (saved.confirmed === true) {
        markProjectBudgetCompleted(project.id);
      }
      toast.success(
        "최종 견적을 저장했습니다. 프로젝트 화면에서 대시보드를 열 수 있습니다.",
      );
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const chartData = result
    ? [
        { name: "인건비", value: result.costSummary.laborCost, color: "#0F9F9A" },
        { name: "서버비", value: result.costSummary.serverCost, color: "#22B8CF" },
        { name: "라이선스", value: result.costSummary.licenseCost, color: "#7DD3FC" },
        { name: "AI API", value: result.costSummary.aiApiCost, color: "#8B5CF6" },
      ].filter((d) => d.value > 0)
    : [];
  const chartTotal = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-xl font-semibold tracking-tight">예산</h2>
          <p className="mt-1 text-[0.82rem] leading-5 text-muted-foreground">
            WBS 예상 공수(MM)를 바탕으로 프로젝트 예산을 산정합니다.
          </p>
        </div>
        <Badge variant="outline" className="border-blue-200 bg-blue-50 font-normal text-blue-700">
          <Sparkles className="mr-1 size-3" /> AI 연동
        </Badge>
      </div>

      {/* 견적 조건 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold tracking-tight">견적 조건</CardTitle>
          <CardDescription className="mt-1 text-[0.82rem] leading-5 text-muted-foreground">값을 바꾼 뒤 아래 "AI 견적 분석하기"를 눌러주세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-muted-foreground text-sm">월평균 인력 단가</label>
              <Input
                type="number"
                value={unitCost}
                onChange={(e) => setUnitCost(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-muted-foreground text-sm">운영 기간</label>
              <Select
                value={String(durationMonths)}
                onValueChange={(v) => setDurationMonths(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m}개월
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-muted-foreground text-sm">서비스 규모</label>
              <Select value={scale} onValueChange={(v) => setScale(v as ServiceScale)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCALE_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-muted-foreground text-sm">유료 라이선스 사용자</label>
              <Input
                type="number"
                value={licenseUsers}
                onChange={(e) => setLicenseUsers(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={includeAiApi} onCheckedChange={(v) => setIncludeAiApi(!!v)} />
              AI API 비용 포함
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={includeVat} onCheckedChange={(v) => setIncludeVat(!!v)} />
              VAT 포함
            </label>
          </div>
        </CardContent>
      </Card>

      {/* WBS별 예상 공수 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold tracking-tight">WBS별 예상 공수</CardTitle>
          <CardDescription className="mt-1 text-[0.82rem] leading-5 text-muted-foreground">
            WBS 조회 결과에서 자동 반영 · 총 {totalMm.toFixed(2)} MM
            {unsavedCount > 0 && ` · 저장 전 항목 ${unsavedCount}건은 견적에서 제외돼요`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {wbsLoading && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {!wbsLoading && wbsError && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <AlertCircle className="size-4" /> {wbsError}
            </div>
          )}
          {!wbsLoading && !wbsError && (
            <>
              <div className="space-y-2">
                {wbsByRole.map(({ role, rows, totalMm: roleMm }) => {
                  const open = openRoles.has(role);
                  return (
                    <div key={role} className="rounded-lg border border-border">
                      <button
                        type="button"
                        onClick={() => toggleRole(role)}
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                      >
                        <span className="flex items-center gap-2">
                          <ChevronDown
                            className={cn(
                              "size-4 text-muted-foreground transition-transform",
                              open && "rotate-180",
                            )}
                          />
                          <span className="text-foreground text-sm">{role}</span>
                          <Badge variant="outline" className="font-normal">
                            {rows.length}건
                          </Badge>
                        </span>
                        <span className="text-muted-foreground text-sm">
                          {roleMm.toFixed(2)} MM
                        </span>
                      </button>
                      {open && (
                        <Table>
                          <TableBody>
                            {rows.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell className="pl-9">{row.name}</TableCell>
                                <TableCell className="text-right">{row.mm.toFixed(2)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  );
                })}
                {wbsRows.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground text-sm">
                    아직 생성된 WBS가 없습니다.
                  </p>
                )}
              </div>
              <Button
                className="w-full"
                onClick={() => void runEstimate()}
                disabled={estimating || wbsRows.length === 0}
              >
                <Sparkles className="size-4" />
                {estimating
                  ? "분석 중…"
                  : result
                    ? "AI 견적 다시 분석"
                    : "AI 견적 분석하기"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* AI 추천 견적 */}
      <Card>
        <CardHeader className="relative pr-32">
          <AiFeatureHeader
            icon={Sparkles}
            title="AI 추천 견적"
            description="WBS 공수와 운영 조건을 바탕으로 비용 구성을 항목별로 계산합니다."
            titleClassName="text-lg font-semibold tracking-tight"
            descriptionClassName="text-[0.82rem] leading-5"
          />
          {result?.llmStatus ? (
            <Badge
              variant="outline"
              className="absolute right-6 top-6 border-teal-200 bg-white/80 font-medium text-teal-700 dark:border-violet-700 dark:bg-zinc-950/80 dark:text-violet-200"
            >
              {result.llmStatus}
            </Badge>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6">
          {estimating && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}

          {!estimating && estimateError && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <AlertCircle className="size-4" /> {estimateError}
            </div>
          )}

          {!estimating && !estimateError && !result && (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground text-sm">
              <Sparkles className="size-5" />
              위의 “AI 견적 분석하기” 버튼을 눌러 AI 예상 견적을 계산하세요.
            </div>
          )}

          {!estimating && !estimateError && result && (
            <>
              <div>
                <p className="text-muted-foreground text-sm">
                  {includeVat ? "VAT 포함 최종 예상 금액" : "최종 예상 금액"}
                </p>
                <p className="mt-1 text-foreground text-3xl">
                  {formatWon(result.estimate.totalAmount)}
                </p>
                <p className="text-muted-foreground text-sm">
                  공급가액 {formatWon(result.estimate.supplyAmount)}
                </p>
                {result.warning && (
                  <p className="mt-2 flex items-center gap-1.5 text-amber-600 text-xs">
                    <AlertCircle className="size-3.5" /> {result.warning}
                  </p>
                )}
              </div>

              <div className="border-t border-border/80 pt-5">
                <div className="mb-3">
                  <p className="text-base font-semibold text-foreground">기본 비용 구성</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">항목별 금액과 전체 비용 대비 비중을 확인하세요.</p>
                </div>

                <div className="grid grid-cols-1 items-center gap-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
                  <div className="relative h-60 min-h-60">
                    {chartData.length > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartData}
                              dataKey="value"
                              nameKey="name"
                              innerRadius="55%"
                              outerRadius="92%"
                              paddingAngle={2.5}
                              labelLine={false}
                              label={renderPiePercentLabel}
                            >
                              {chartData.map((d) => (
                                <Cell key={d.name} fill={d.color} stroke="transparent" />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="text-xs font-medium text-muted-foreground">기본 비용</span>
                          <span className="mt-1 max-w-28 text-sm font-semibold leading-5 text-foreground">
                            {formatWon(result.costSummary.baseCost)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        비용 구성 없음
                      </div>
                    )}
                  </div>

                  <div className="divide-y divide-border/70 border-y border-border/70">
                    {chartData.map((d) => {
                      const percentage = chartTotal > 0 ? (d.value / chartTotal) * 100 : 0;
                      return (
                        <div key={d.name} className="flex items-center justify-between gap-4 py-3">
                          <span className="flex min-w-0 items-center gap-2.5 text-[0.98rem] font-semibold text-foreground">
                            <span
                              className="size-3 shrink-0 rounded-sm"
                              style={{ backgroundColor: d.color }}
                            />
                            {d.name}
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-[0.9rem] font-medium text-foreground">{formatWon(d.value)}</span>
                            <span className="mt-0.5 block text-xs font-medium text-muted-foreground">{percentage.toFixed(1)}%</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 border-t border-border pt-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">기본 비용</span>
                  <span className="text-foreground">
                    {formatWon(result.costSummary.baseCost)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    예비비 ({result.estimate.contingencyRate}%)
                  </span>
                  <span className="text-foreground">
                    {formatWon(result.estimate.contingencyAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">VAT</span>
                  <span className="text-foreground">{formatWon(result.estimate.vat)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-1.5">
                  <span className="text-foreground">최종 예상 금액</span>
                  <span className="text-foreground">
                    {formatWon(result.estimate.totalAmount)}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => void handleSaveFinal()}
                disabled={saving}
              >
                <Save className="size-4" />
                {saving ? "저장 중…" : "최종 견적 저장"}
              </Button>
            </>
          )}

        </CardContent>
      </Card>
    </div>
  );
}