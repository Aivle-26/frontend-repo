import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Sparkles, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
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
} from "@/app/api/projectRepository";

/**
 * [예산] 페이지.
 *
 * WBS별 예상 공수(MM)는 실제 WBS API(projectRepository.getWbs)에서 가져오고,
 * 나머지(서버비/라이선스/AI API 비용)는 견적 조건 입력값을 기준으로 계산한다.
 * 계산식은 기존 "예상 견적" 화면 숫자를 그대로 역산해서 맞춘 것이다.
 */

const WORKING_HOURS_PER_MM = 160;

const SERVICE_SCALES = ["소규모", "중규모", "대규모"] as const;
type ServiceScale = (typeof SERVICE_SCALES)[number];

const SERVER_COST_PER_MONTH: Record<ServiceScale, number> = {
  소규모: 400000,
  중규모: 800000,
  대규모: 1600000,
};

const LICENSE_COST_PER_USER_PER_MONTH = 40000;
const AI_API_COST_PER_MONTH = 500000;

const DURATION_OPTIONS = [3, 6, 12, 18, 24];

function formatWon(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

interface PmBudgetProps {
  project: ProjectSummary;
}

export function PmBudget({ project }: PmBudgetProps) {
  const [wbsTasks, setWbsTasks] = useState<WbsTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [unitCost, setUnitCost] = useState(8000000);
  const [durationMonths, setDurationMonths] = useState(12);
  const [scale, setScale] = useState<ServiceScale>("중규모");
  const [licenseUsers, setLicenseUsers] = useState(20);
  const [includeAiApi, setIncludeAiApi] = useState(true);
  const [includeVat, setIncludeVat] = useState(true);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError("");

    projectRepository
      .getWbs(project.id)
      .then((result) => {
        if (ignore) return;
        setWbsTasks([...(result.finalTasks ?? [])].sort((a, b) => a.orderIndex - b.orderIndex));
      })
      .catch((caught) => {
        if (ignore) return;
        if (caught instanceof ApiError && caught.status === 404) {
          setWbsTasks([]);
        } else {
          setError("WBS 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [project.id]);

  const wbsRows = useMemo(
    () =>
      wbsTasks.map((t) => {
        const mm = t.estimatedHours / WORKING_HOURS_PER_MM;
        return {
          id: t.externalTaskId,
          name: t.taskName,
          role: t.requiredSkills.length > 0 ? t.requiredSkills.join(", ") : "-",
          mm,
          laborCost: mm * unitCost,
        };
      }),
    [wbsTasks, unitCost],
  );

  const totalMm = wbsRows.reduce((sum, r) => sum + r.mm, 0);

  const estimate = useMemo(() => {
    const laborCost = totalMm * unitCost;
    const serverCost = SERVER_COST_PER_MONTH[scale] * durationMonths;
    const licenseCost = licenseUsers * LICENSE_COST_PER_USER_PER_MONTH * durationMonths;
    const aiApiCost = includeAiApi ? AI_API_COST_PER_MONTH * durationMonths : 0;

    const baseCost = laborCost + serverCost + licenseCost + aiApiCost;
    const contingency = baseCost * 0.1;
    const supplyAmount = baseCost + contingency;
    const vat = includeVat ? supplyAmount * 0.1 : 0;
    const finalAmount = supplyAmount + vat;

    return {
      laborCost,
      serverCost,
      licenseCost,
      aiApiCost,
      baseCost,
      contingency,
      supplyAmount,
      vat,
      finalAmount,
    };
  }, [totalMm, unitCost, scale, durationMonths, licenseUsers, includeAiApi, includeVat]);

  const chartData = [
    { name: "인건비", value: estimate.laborCost, color: "#6366f1" },
    { name: "서버비", value: estimate.serverCost, color: "#14b8a6" },
    { name: "라이선스", value: estimate.licenseCost, color: "#f59e0b" },
    { name: "AI API", value: estimate.aiApiCost, color: "#ec4899" },
  ].filter((d) => d.value > 0);

  const handleRecalculate = () => {
    toast.success("AI 예상 견적을 다시 계산했어요.");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-foreground text-lg">예산</h2>
          <p className="text-muted-foreground text-sm">
            WBS 예상 공수(MM)를 바탕으로 프로젝트 예산을 산정합니다.
          </p>
        </div>
        <Badge variant="outline" className="border-blue-200 bg-blue-50 font-normal text-blue-700">
          <Sparkles className="mr-1 size-3" /> AI 분석 완료
        </Badge>
      </div>

      {/* 견적 조건 */}
      <Card>
        <CardHeader>
          <CardTitle>견적 조건</CardTitle>
          <CardDescription>미입력 항목은 기본값이 적용됩니다.</CardDescription>
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
                  {SERVICE_SCALES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
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
          <CardTitle>WBS별 예상 공수</CardTitle>
          <CardDescription>
            WBS 조회 결과에서 자동 반영 · 총 {totalMm.toFixed(2)} MM
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {!loading && error && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <AlertCircle className="size-4" /> {error}
            </div>
          )}
          {!loading && !error && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>WBS</TableHead>
                    <TableHead>필요 역할</TableHead>
                    <TableHead className="text-right">예상 MM</TableHead>
                    <TableHead className="text-right">인건비</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wbsRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell className="text-muted-foreground">{row.role}</TableCell>
                      <TableCell className="text-right">{row.mm.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{formatWon(row.laborCost)}</TableCell>
                    </TableRow>
                  ))}
                  {wbsRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        아직 생성된 WBS가 없습니다.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <Button className="w-full" onClick={handleRecalculate}>
                <Sparkles className="size-4" /> AI 예상 견적 다시 계산
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* AI 추천 견적 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>AI 추천 견적</CardTitle>
            <Badge
              variant="outline"
              className="border-emerald-200 bg-emerald-50 font-normal text-emerald-700"
            >
              SUCCEEDED
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-muted-foreground text-sm">
              {includeVat ? "VAT 포함 최종 예상 금액" : "최종 예상 금액"}
            </p>
            <p className="mt-1 text-foreground text-3xl">{formatWon(estimate.finalAmount)}</p>
            <p className="text-muted-foreground text-sm">
              공급가액 {formatWon(estimate.supplyAmount)}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-6">
            <div className="h-48">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="60%"
                      outerRadius="90%"
                      paddingAngle={2}
                    >
                      {chartData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                  비용 구성 없음
                </div>
              )}
            </div>
            <div className="space-y-2">
              {chartData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: d.color }}
                    />
                    {d.name}
                  </span>
                  <span className="text-foreground">{formatWon(d.value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 border-t border-border pt-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">기본 비용</span>
              <span className="text-foreground">{formatWon(estimate.baseCost)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">예비비 (10%)</span>
              <span className="text-foreground">{formatWon(estimate.contingency)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">VAT (10%)</span>
              <span className="text-foreground">{formatWon(estimate.vat)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-1.5">
              <span className="text-foreground">최종 예상 금액</span>
              <span className="text-foreground">{formatWon(estimate.finalAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}