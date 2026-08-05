import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  AlertCircle,
  Lightbulb,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Label } from "@/app/components/ui/label";
import { Progress } from "@/app/components/ui/progress";
import { cn } from "@/app/components/ui/utils";
import { getAccessToken } from "@/app/api/authToken";
import { projectRepository } from "@/app/api/projectRepository";
import {
  impactAnalysisApi,
  impactLevelLabel,
  impactLevelTone,
  type ImpactAnalysisInput,
  type ImpactAnalysisResult,
} from "@/app/api/impactAnalysisApi";

interface ImpactAnalysisCardProps {
  projectId: string;
}

const EMPTY_FORM: ImpactAnalysisInput = {
  changeTitle: "",
  changeDescription: "",
  affectedTaskCount: 0,
  affectedMemberCount: 0,
  remainingDays: 0,
  additionalWorkDays: 0,
  scopeChanged: false,
  databaseChanged: false,
  apiChanged: false,
  uiChanged: false,
};

export function ImpactAnalysisCard({ projectId }: ImpactAnalysisCardProps) {
  const [form, setForm] = useState<ImpactAnalysisInput>(EMPTY_FORM);
  const [result, setResult] = useState<ImpactAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  const [aiFilled, setAiFilled] = useState(false);

  // 남은 일정만 프로젝트 종료일에서 자동 반영한다(변경과 무관한 객관값). 사용자가 안 건드린 0 값만.
  // "영향 업무 수"는 변경 건별로 다르므로 자동으로 채우지 않는다.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const schedule = await projectRepository.getSchedules(projectId);
        const end = new Date(`${schedule.targetEndDate}T00:00:00`).getTime();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const days = Math.max(0, Math.round((end - today.getTime()) / 86_400_000));
        if (!cancelled && days > 0) {
          setForm((p) => (p.remainingDays === 0 ? { ...p, remainingDays: days } : p));
          setAutoFilled(true);
        }
      } catch {
        /* 일정 없으면 남은 일정은 수동 입력 */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const setNumber = (key: keyof ImpactAnalysisInput) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Math.max(0, Number(e.target.value) || 0);
      setForm((prev) => ({ ...prev, [key]: value }));
    };

  const toggle = (key: keyof ImpactAnalysisInput) => (checked: boolean) => {
    setForm((prev) => ({ ...prev, [key]: checked }));
  };

  // "AI 분석": 제목+설명만으로 백엔드가 확정 WBS를 모아 AI로 수치를 자동 산출 → 폼에 채운다.
  const handleAiAnalyze = useCallback(async () => {
    if (!form.changeTitle.trim() || !form.changeDescription.trim()) {
      toast.error("변경 제목과 설명을 입력하세요.");
      return;
    }
    setAnalyzing(true);
    try {
      const res = await impactAnalysisApi.analyze(
        projectId,
        { ...form, useLlm: true },
        getAccessToken(),
      );

      // AI 분석은 입력 수치만 자동으로 채운다. 평가 결과 패널은 "평가하기"를 눌러야 표시된다.
      if (res.llmStatus === "SUCCEEDED") {
        setForm((p) => ({
          ...p,
          affectedTaskCount: res.affectedTaskCount,
          affectedMemberCount: res.affectedMemberCount,
          remainingDays: res.remainingDays,
          additionalWorkDays: res.additionalWorkDays,
          scopeChanged: res.scopeChanged,
          databaseChanged: res.databaseChanged,
          apiChanged: res.apiChanged,
          uiChanged: res.uiChanged,
        }));
        setAiFilled(true);
        toast.success("AI가 영향 정보를 자동 입력했습니다. 확인 후 평가하기를 누르세요.");
      } else if (res.llmStatus === "SKIPPED_NO_API_KEY") {
        toast.error("AI 분석 키가 설정되지 않았습니다. 수치를 직접 입력해 평가하세요.");
      } else {
        toast.message("AI 자동 산출이 어려워 수치를 채우지 못했습니다. 직접 입력해 평가하세요.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI 분석에 실패했습니다.");
    } finally {
      setAnalyzing(false);
    }
  }, [form, projectId]);

  const handleAnalyze = useCallback(async () => {
    if (!form.changeTitle.trim() || !form.changeDescription.trim()) {
      toast.error("변경 제목과 설명을 입력하세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await impactAnalysisApi.analyze(
        projectId,
        { ...form, useLlm: false },
        getAccessToken(),
      );
      setResult(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "영향도 평가에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [form, projectId]);

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-600" />
          <span className="text-foreground">프로젝트 조정 여부 평가</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* 입력 폼 */}
          <div className="rounded-lg border border-border p-4">
            <p className="mb-3 text-muted-foreground text-xs">
              변경 정보 입력
              {autoFilled && (
                <span className="ml-1 text-blue-600">· 남은 일정은 프로젝트 종료일에서 자동 반영(수정 가능)</span>
              )}
            </p>

            <div className="space-y-3">
              <div>
                <Label className="text-muted-foreground text-xs">변경 제목</Label>
                <Input
                  className="mt-1"
                  placeholder="예: 결제 모듈 PG사 교체"
                  value={form.changeTitle}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, changeTitle: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label className="text-muted-foreground text-xs">변경 설명</Label>
                <Textarea
                  className="mt-1 min-h-[64px]"
                  placeholder="변경 내용과 배경을 적어주세요."
                  value={form.changeDescription}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, changeDescription: e.target.value }))
                  }
                />
              </div>

              {/* 제목+설명만으로 AI가 아래 수치를 자동 산출한다. */}
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => void handleAiAnalyze()}
                disabled={analyzing || loading}
              >
                {analyzing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                AI 분석
              </Button>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-muted-foreground text-xs">영향 수치</span>
                  {aiFilled && (
                    <span className="flex items-center gap-1 text-blue-600 text-xs">
                      <Sparkles className="size-3" /> AI 자동 입력됨 · 수정 가능
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="영향 업무 수" value={form.affectedTaskCount} onChange={setNumber("affectedTaskCount")} />
                  <NumberField label="영향 팀원 수" value={form.affectedMemberCount} onChange={setNumber("affectedMemberCount")} />
                  <NumberField label="남은 일정(일)" value={form.remainingDays} onChange={setNumber("remainingDays")} />
                  <NumberField label="추가 작업(일)" value={form.additionalWorkDays} onChange={setNumber("additionalWorkDays")} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <ToggleField label="범위 변경" checked={form.scopeChanged} onChange={toggle("scopeChanged")} />
                <ToggleField label="DB 변경" checked={form.databaseChanged} onChange={toggle("databaseChanged")} />
                <ToggleField label="API 변경" checked={form.apiChanged} onChange={toggle("apiChanged")} />
                <ToggleField label="UI 변경" checked={form.uiChanged} onChange={toggle("uiChanged")} />
              </div>

              <Button className="w-full" onClick={() => void handleAnalyze()} disabled={loading || analyzing}>
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Calculator className="size-4" />
                )}
                평가하기
              </Button>
            </div>
          </div>

          {/* 결과 패널 */}
          <div className="rounded-lg border border-border p-4">
            <p className="mb-3 text-muted-foreground text-xs">AI 평가 결과</p>
            {result ? (
              <ResultView result={result} />
            ) : (
              <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 text-center">
                <Calculator className="size-6 text-muted-foreground" />
                <p className="text-muted-foreground text-sm">
                  변경 정보를 입력하고 평가하기를 누르면 영향도 결과가 표시됩니다.
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ResultView({ result }: { result: ImpactAnalysisResult }) {
  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-medium leading-none text-foreground">
          {result.impactScore}
        </span>
        <span className="text-muted-foreground text-sm">/ 100</span>
        <Badge
          variant="outline"
          className={cn("ml-auto font-normal", impactLevelTone(result.impactLevel))}
        >
          영향도 {impactLevelLabel(result.impactLevel)}
        </Badge>
      </div>

      {result.aiSummary && (
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-blue-600" />
          <p className="text-foreground text-sm leading-snug">{result.aiSummary}</p>
        </div>
      )}

      <div className="space-y-2.5">
        <ScoreBar label="일정 (35%)" value={result.scheduleImpactScore} />
        <ScoreBar label="범위 (30%)" value={result.scopeImpactScore} />
        <ScoreBar label="자원 (20%)" value={result.resourceImpactScore} />
        <ScoreBar label="기술 (15%)" value={result.technicalImpactScore} />
      </div>

      {result.affectedTasks.length > 0 && (
        <div>
          <p className="mb-1.5 text-sm text-foreground">
            영향 업무 ({result.affectedTasks.length})
          </p>
          <ul className="space-y-1.5">
            {result.affectedTasks.map((task) => (
              <li
                key={task.taskId}
                className="rounded-md border border-border px-2.5 py-1.5 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-normal text-xs">
                    {task.impactType === "DIRECT" ? "직접" : "간접"}
                  </Badge>
                  <span className="text-foreground">{task.taskName}</span>
                  <span className="ml-auto text-muted-foreground text-xs">
                    +{task.additionalWorkDays}일
                  </span>
                </div>
                <p className="mt-0.5 text-muted-foreground text-xs leading-snug">
                  {task.reason}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.riskFactors.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-sm text-foreground">
            <AlertCircle className="size-4 text-amber-600" />
            위험 요인
          </p>
          <ul className="space-y-1">
            {result.riskFactors.map((factor) => (
              <li key={factor} className="text-muted-foreground text-sm leading-snug">
                · {factor}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.recommendedActions.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2.5 dark:bg-blue-950/30">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-blue-600" />
          <div>
            <p className="text-muted-foreground text-xs">권고 조치</p>
            <ul className="mt-0.5 space-y-0.5">
              {result.recommendedActions.map((action) => (
                <li key={action} className="text-foreground text-sm leading-snug">
                  {action}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground">{value}</span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <Label className="text-muted-foreground text-xs">{label}</Label>
      <Input type="number" min={0} className="mt-1" value={value} onChange={onChange} />
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <span className="text-foreground text-sm">{label}</span>
    </label>
  );
}
