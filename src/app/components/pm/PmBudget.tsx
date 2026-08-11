import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BrainCircuit,
  Check,
  ChevronDown,
  CirclePlus,
  Loader2,
  ReceiptText,
  Save,
  TriangleAlert,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Input } from "@/app/components/ui/input";
import { cn } from "@/app/components/ui/utils";
import {
  ApiError,
  projectRepository,
  type KosaCostRequestBody,
  type KosaCostResponse,
  type KosaExpenseItem,
  type KosaPersonnel,
  type KosaWbsEvidence,
  type ProjectSummary,
} from "@/app/api/projectRepository";
import { markProjectBudgetCompleted } from "@/app/projects/projectProgress";

const KOSA_JOBS = [
  "IT 기획자", "IT 컨설턴트", "업무분석가", "데이터분석가", "IT PM",
  "IT 아키텍트", "UI/UX 기획·개발자", "UI/UX 디자이너", "응용 SW 개발자",
  "시스템 SW 개발자", "정보시스템운용자", "IT 지원기술자", "IT 마케터",
  "IT 품질관리자", "IT 테스터", "IT 감리", "정보보안전문가",
] as const;

const EMPTY_EXPENSE: KosaExpenseItem = {
  name: "", quantity: 1, unit: "건", unitPrice: 0, included: true,
};

function won(value = 0) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function numberValue(value: string) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function errorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
  const messages: Record<string, string> = {
    CONFIRMED_WBS_NOT_FOUND: "확정된 WBS가 없습니다. WBS를 먼저 확정해 주세요.",
    UNASSIGNED_WBS_EXISTS: "담당자가 없는 WBS가 있습니다. 모든 말단 WBS에 담당자를 배정해 주세요.",
    FINAL_ASSIGNMENTS_NOT_FOUND: "최종 저장된 담당자 배정이 없습니다. 담당자 배정을 먼저 저장해 주세요.",
    PLANNING_EFFORT_UNAVAILABLE: "AI 산정 서버가 잠시 응답하지 않습니다. 잠시 후 다시 시도해 주세요.",
    INVALID_PLANNING_EFFORT_RESPONSE: "AI 산정 결과 형식에 문제가 있습니다. 다시 시도해 주세요.",
  };
  const code = typeof error.payload === "object" && error.payload !== null && "code" in error.payload
    ? String((error.payload as { code?: unknown }).code ?? "")
    : "";
  return messages[code] ?? error.message;
}

interface PmBudgetProps { project: ProjectSummary }

export function PmBudget({ project }: PmBudgetProps) {
  const [personnel, setPersonnel] = useState<KosaPersonnel[]>([]);
  const [evidence, setEvidence] = useState<KosaWbsEvidence[]>([]);
  const [expenses, setExpenses] = useState<KosaExpenseItem[]>([]);
  const [result, setResult] = useState<KosaCostResponse | null>(null);
  const [overheadRate, setOverheadRate] = useState(30);
  const [technicalFeeRate, setTechnicalFeeRate] = useState(10);
  const [directExpense, setDirectExpense] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [includeVat, setIncludeVat] = useState(true);
  const [note, setNote] = useState("2026년 KOSA 평균임금 기준");
  const [openEvidenceGroups, setOpenEvidenceGroups] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [needsEstimate, setNeedsEstimate] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const initialized = useRef(false);
  const detailedJobsByEmployee = useRef<Map<string, string>>(new Map());

  const withStoredDetailedJobs = useCallback((rows: KosaPersonnel[]) => (
    rows.map((row) => ({
      ...row,
      detailedJob: detailedJobsByEmployee.current.get(row.employeeNumber) ?? row.detailedJob,
    }))
  ), []);

  const hydrate = useCallback((data: KosaCostResponse, keepEvidence = false) => {
    setResult(data);
    setPersonnel(withStoredDetailedJobs(data.personnel ?? []));
    setExpenses(data.expenseItems ?? []);
    setOverheadRate(data.overheadRate ?? 30);
    setTechnicalFeeRate(data.technicalFeeRate ?? 10);
    setDirectExpense(data.directExpense ?? 0);
    setDiscountAmount(data.discountAmount ?? 0);
    setIncludeVat(data.includeVat ?? true);
    setNote(data.note ?? "2026년 KOSA 평균임금 기준");
    if (!keepEvidence) {
      setEvidence(data.wbsEfforts ?? data.personnel.flatMap((row) => row.wbsEvidence ?? []));
    }
  }, [withStoredDetailedJobs]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    initialized.current = false;
    try {
      const members = await projectRepository.getProjectMembers(project.id).catch(() => []);
      detailedJobsByEmployee.current = new Map(
        members
          .map((member) => [member.employeeNumber, member.roles.join(" ").trim()] as const)
          .filter((entry): entry is readonly [string, string] => entry[1].length > 0),
      );
      try {
        const saved = await projectRepository.getEditedKosaCost(project.id);
        hydrate(saved);
        setNeedsEstimate(false);
      } catch (caught) {
        if (!(caught instanceof ApiError) || caught.status !== 404) throw caught;
        setNeedsEstimate(true);
      }
      setDirty(false);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      initialized.current = true;
      setLoading(false);
    }
  }, [hydrate, project.id]);

  useEffect(() => { void load(); }, [load]);

  const buildRequestFrom = useCallback((data: KosaCostResponse): KosaCostRequestBody => ({
    personnel: withStoredDetailedJobs(data.personnel).map((row) => ({
      employeeNumber: row.employeeNumber,
      kosaJobCategory: row.kosaJobCategory,
      detailedJob: row.detailedJob,
      headcount: row.headcount,
      durationMonths: row.durationMonths,
      utilizationRate: row.utilizationRate,
      proposedMonthlyRate: row.proposedMonthlyRate,
    })),
    overheadRate: data.overheadRate ?? 30,
    technicalFeeRate: data.technicalFeeRate ?? 10,
    directExpense: data.directExpense ?? 0,
    expenseItems: data.expenseItems ?? [],
    discountAmount: data.discountAmount ?? 0,
    includeVat: data.includeVat ?? true,
    note: data.note ?? "2026년 KOSA 평균임금 기준",
  }), [withStoredDetailedJobs]);

  const generateEstimate = async () => {
    setGenerating(true);
    setError("");
    try {
      const generated = await projectRepository.generateKosaEffortEstimate(project.id);
      const calculated = await projectRepository.calculateKosaCost(project.id, buildRequestFrom(generated));
      hydrate({ ...generated, ...calculated, wbsEfforts: generated.wbsEfforts });
      setNeedsEstimate(false);
      toast.success("AI 공수와 견적 계산을 완료했습니다.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setGenerating(false);
    }
  };

  const requestBody = useMemo<KosaCostRequestBody>(() => ({
    personnel: personnel.map((row) => ({
      employeeNumber: row.employeeNumber,
      kosaJobCategory: row.kosaJobCategory,
      detailedJob: row.detailedJob,
      headcount: row.headcount,
      durationMonths: row.durationMonths,
      utilizationRate: row.utilizationRate,
      proposedMonthlyRate: row.proposedMonthlyRate,
    })),
    overheadRate, technicalFeeRate, directExpense,
    expenseItems: expenses.map(({ amount: _amount, ...item }) => item),
    discountAmount, includeVat, note,
  }), [personnel, overheadRate, technicalFeeRate, directExpense, expenses, discountAmount, includeVat, note]);

  useEffect(() => {
    if (!initialized.current || loading || personnel.length === 0 || !dirty) return;
    const timer = window.setTimeout(async () => {
      setDirty(false);
      setCalculating(true);
      try {
        const calculated = await projectRepository.calculateKosaCost(project.id, requestBody);
        hydrate(calculated, true);
        setError("");
      } catch (caught) {
        setError(errorMessage(caught));
      } finally {
        setCalculating(false);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [dirty, hydrate, loading, personnel.length, project.id, requestBody]);

  const updatePerson = (index: number, patch: Partial<KosaPersonnel>) => {
    setPersonnel((rows) => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
    setDirty(true);
  };
  const removePerson = (index: number) => {
    if (personnel.length <= 1) {
      toast.error("투입 인력은 최소 1명 이상이어야 합니다.");
      return;
    }

    const remaining = personnel.filter((_, i) => i !== index);
    const utilizationByEmployee = new Map<
      string,
      { employeeName: string; total: number; detailedJobs: Set<string> }
    >();
    for (const row of remaining) {
      const current = utilizationByEmployee.get(row.employeeNumber) ?? {
        employeeName: row.employeeName,
        total: 0,
        detailedJobs: new Set<string>(),
      };
      current.total += row.utilizationRate;
      if (row.detailedJob) current.detailedJobs.add(row.detailedJob);
      utilizationByEmployee.set(row.employeeNumber, current);
    }
    const nextWarnings = Array.from(utilizationByEmployee, ([employeeNumber, value]) => ({
      employeeNumber,
      employeeName: value.employeeName,
      totalUtilizationRate: value.total,
      excessUtilizationRate: Math.max(0, value.total - 100),
      detailedJobs: Array.from(value.detailedJobs),
      message: `${value.employeeName}님의 합산 투입률이 ${value.total}%로 100%를 초과합니다.`,
    })).filter((warning) => warning.totalUtilizationRate > 100);

    setPersonnel(remaining);
    setResult((current) => current ? {
      ...current,
      hasUtilizationWarning: nextWarnings.length > 0,
      utilizationWarnings: nextWarnings,
    } : current);
    setDirty(true);
  };
  const updateExpense = (index: number, patch: Partial<KosaExpenseItem>) => {
    setExpenses((rows) => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
    setDirty(true);
  };
  const setCostValue = (setter: (value: number) => void, value: string) => {
    setter(numberValue(value)); setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await projectRepository.saveEditedKosaCost(project.id, requestBody);
      hydrate(saved, true);
      setDirty(false);
      markProjectBudgetCompleted(project.id);
      toast.success("최종 견적을 저장했습니다.");
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally { setSaving(false); }
  };

  const regenerateEstimate = async () => {
    const confirmed = window.confirm(
      "AI 견적을 다시 생성하면 현재 화면에서 수정한 인력·비용 정보가 새 산정 결과로 바뀝니다. 계속할까요?",
    );
    if (!confirmed) return;

    setRegenerating(true);
    setError("");
    setDirty(false);
    initialized.current = false;
    try {
      const generated = await projectRepository.generateKosaEffortEstimate(project.id);
      hydrate(generated);
      setOpenEvidenceGroups(new Set());
      toast.success("AI 견적을 새로 생성했습니다.");
    } catch (caught) {
      const message = errorMessage(caught);
      setError(message);
      toast.error(message);
    } finally {
      initialized.current = true;
      setRegenerating(false);
    }
  };

  const evidenceGroups = useMemo(() => {
    const groups = new Map<string, KosaWbsEvidence[]>();
    for (const item of evidence) {
      const key = item.detailedJob || item.kosaJobCategory || "기타";
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return Array.from(groups, ([role, items]) => ({
      role,
      items,
      totalMm: items.reduce((sum, item) => sum + item.estimatedMm, 0),
    }));
  }, [evidence]);
  const totalEvidenceMm = evidence.reduce((sum, item) => sum + item.estimatedMm, 0);
  const utilizationWarnings = result?.utilizationWarnings ?? [];
  const utilizationWarningEmployeeNumbers = new Set(
    utilizationWarnings.map((warning) => warning.employeeNumber),
  );
  const projectStart = result?.projectStartDate ?? project.server?.plannedStartDate ?? "미정";
  const projectEnd = result?.projectEndDate ?? project.server?.plannedEndDate ?? project.dueDate ?? "미정";
  const totalAmount = result?.totalAmount ?? 0;

  if (loading) return (
    <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-border bg-card/80">
      <div className="text-center"><Loader2 className="mx-auto size-7 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">저장된 견적을 불러오는 중입니다</p></div>
    </div>
  );

  if (needsEstimate) return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 text-center shadow-sm">
      <div className="grid size-12 place-items-center rounded-2xl bg-primary/10"><BrainCircuit className="size-6 text-primary" /></div>
      <h2 className="mt-4 text-lg font-semibold">아직 생성된 견적이 없습니다</h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">확정된 WBS·일정·담당자를 기준으로 AI가 공수를 산정하고, 직접인건비와 제경비·기술료를 자동 계산합니다.</p>
      {error && <p className="mt-3 flex items-center gap-1.5 text-sm text-amber-600"><AlertCircle className="size-4" />{error}</p>}
      <Button className="mt-5" onClick={() => void generateEstimate()} disabled={generating}>{generating ? <Loader2 className="size-4 animate-spin" /> : <BrainCircuit className="size-4" />}{generating ? "AI 공수 산정 중…" : "AI 공수 산정하기"}</Button>
    </div>
  );

  return (
    <div className="space-y-4 pb-6">
      <section className="overflow-hidden rounded-2xl border border-slate-800/10 bg-[#102c46] text-white shadow-[0_18px_45px_rgba(15,45,70,0.16)] dark:border-violet-900/50 dark:bg-[#160e21]">
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl border border-white/15 bg-white/10"><ReceiptText className="size-5" /></div>
            <div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200 dark:text-violet-300">Project cost desk</p><h2 className="text-xl font-semibold tracking-tight">프로젝트 견적</h2></div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">KOSA {result?.kosaRateYear ?? 2026}</span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5">{dirty ? "편집 중" : result?.confirmed ? "저장됨" : "AI 초안"}</span>
            <Button
              size="sm"
              variant="outline"
              className="border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              onClick={() => void regenerateEstimate()}
              disabled={regenerating || saving || calculating}
            >
              {regenerating ? <Loader2 className="size-4 animate-spin" /> : <BrainCircuit className="size-4" />}
              {regenerating ? "AI 재생성 중" : "AI 견적 재생성"}
            </Button>
            <Button size="sm" className="bg-white text-[#12324c] hover:bg-cyan-50" onClick={() => void save()} disabled={saving || regenerating || calculating || personnel.length === 0}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} {saving ? "저장 중" : "최종 견적 저장"}
            </Button>
          </div>
        </div>
        <div className="grid border-t border-white/10 bg-black/10 sm:grid-cols-[1fr_auto]">
          <div className="px-5 py-3"><span className="text-xs text-white/55">프로젝트명</span><p className="mt-0.5 text-sm font-medium">{result?.projectName ?? project.name}</p></div>
          <div className="border-t border-white/10 px-5 py-3 sm:min-w-72 sm:border-l sm:border-t-0"><span className="text-xs text-white/55">프로젝트 기간</span><p className="mt-0.5 text-sm">{projectStart} — {projectEnd}</p></div>
        </div>
      </section>

      {error && <div className="flex items-center gap-2 rounded-xl border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-200"><AlertCircle className="size-4 shrink-0" />{error}</div>}

      {result?.hasUtilizationWarning && utilizationWarnings.length > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 text-amber-950 shadow-sm dark:border-amber-700/70 dark:bg-amber-950/25 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">담당자 투입률을 확인해 주세요</h3>
              <div className="mt-2 space-y-2">
                {utilizationWarnings.map((warning) => (
                  <div key={warning.employeeNumber} className="text-xs leading-5">
                    <p>{warning.message}</p>
                    <p className="text-amber-800/75 dark:text-amber-200/70">
                      합산 {warning.totalUtilizationRate}% · 초과 {warning.excessUtilizationRate}%
                      {warning.detailedJobs.length > 0 ? ` · ${warning.detailedJobs.join(", ")}` : ""}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-amber-800/80 dark:text-amber-200/75">저장은 가능하지만 투입률이나 담당 업무를 확인하는 것을 권장합니다.</p>
            </div>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border bg-muted/45 px-5 py-3.5"><div><h3 className="text-sm font-semibold">프로젝트 투입인력</h3><p className="mt-0.5 text-xs text-muted-foreground">배정된 인력의 직무와 투입 조건을 조정하면 자동으로 다시 계산됩니다.</p></div>{calculating && <span className="flex items-center gap-1.5 text-xs text-primary"><Loader2 className="size-3.5 animate-spin" /> 계산 중</span>}</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1160px] border-collapse text-sm">
            <thead className="bg-[#eaf1f5] text-[#26445a] dark:bg-muted dark:text-foreground"><tr className="border-b border-border">
              {['No','이름','세부직무','KOSA 직무','인원','기간(개월)','투입률(%)','M/M','표준단가(M/M)','제안단가(M/M)','금액',''].map((label, index) => <th key={`${label}-${index}`} className="whitespace-nowrap border-r border-border/70 px-2.5 py-2.5 text-center text-xs font-semibold last:border-r-0">{label}</th>)}
            </tr></thead>
            <tbody>{personnel.map((row, index) => (
              <tr
                key={`${row.employeeNumber}-${index}`}
                className={cn(
                  "border-b border-border/80 bg-card align-middle hover:bg-muted/20",
                  utilizationWarningEmployeeNumbers.has(row.employeeNumber) &&
                    "bg-amber-50/80 hover:bg-amber-100/70 dark:bg-amber-950/20 dark:hover:bg-amber-950/30",
                )}
              >
                <td className="px-2 py-2 text-center text-xs text-muted-foreground">{index + 1}</td>
                <td className="min-w-28 px-2 py-2 font-medium">{row.employeeName}</td>
                <td className="min-w-44 px-1.5 py-1.5"><Input className="h-8 rounded-md text-xs" value={row.detailedJob} maxLength={100} onChange={(e) => updatePerson(index, { detailedJob: e.target.value })} /></td>
                <td className="min-w-44 px-1.5 py-1.5"><select className="h-8 w-full rounded-md border border-input bg-input-background px-2 text-xs" value={row.kosaJobCategory} onChange={(e) => updatePerson(index, { kosaJobCategory: e.target.value })}>{KOSA_JOBS.map((job) => <option key={job}>{job}</option>)}</select></td>
                <td className="w-20 px-1.5"><Input className="h-8 text-right text-xs" type="number" min="1" value={row.headcount} onChange={(e) => updatePerson(index, { headcount: numberValue(e.target.value) })} /></td>
                <td className="w-24 px-1.5"><Input className="h-8 text-right text-xs" type="number" min="0" step="0.1" value={row.durationMonths} onChange={(e) => updatePerson(index, { durationMonths: numberValue(e.target.value) })} /></td>
                <td className="w-24 px-1.5"><Input className="h-8 text-right text-xs" type="number" min="0" max="100" value={row.utilizationRate} onChange={(e) => updatePerson(index, { utilizationRate: numberValue(e.target.value) })} /></td>
                <td className="whitespace-nowrap px-3 text-right font-semibold text-primary">{(row.calculatedMm ?? row.estimatedMm ?? 0).toFixed(2)}</td>
                <td className="whitespace-nowrap px-3 text-right text-xs text-muted-foreground">{won(row.standardMonthlyRate)}</td>
                <td className="w-36 px-1.5"><Input className="h-8 text-right text-xs" type="number" min="0" step="10000" value={row.proposedMonthlyRate} onChange={(e) => updatePerson(index, { proposedMonthlyRate: numberValue(e.target.value) })} /></td>
                <td className="whitespace-nowrap px-3 text-right font-bold text-[#153f5e] dark:text-violet-200">{won(row.amount)}</td>
                <td className="w-12 px-1 text-center">
                  <button
                    type="button"
                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-35"
                    onClick={() => removePerson(index)}
                    disabled={personnel.length <= 1 || calculating || regenerating || saving}
                    aria-label={`${row.employeeName} ${row.detailedJob} 투입 인력 삭제`}
                    title={personnel.length <= 1 ? "투입 인력은 최소 1명 이상이어야 합니다." : "투입 인력 삭제"}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card px-5 py-5 shadow-sm sm:px-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2"><BrainCircuit className="size-5 text-primary" /><h3 className="text-base font-semibold">WBS별 AI 산정 근거</h3></div>
            <p className="mt-1.5 text-xs text-muted-foreground">AI 공수 산정 결과를 직무별로 모아 표시합니다 · 총 {totalEvidenceMm.toFixed(2)} MM</p>
          </div>
          <span className="text-xs text-muted-foreground">총 {evidence.length}개 WBS</span>
        </div>
        <div className="mt-5 space-y-2.5">
          {evidenceGroups.map(({ role, items, totalMm }) => {
            const open = openEvidenceGroups.has(role);
            return (
              <div key={role} className="overflow-hidden rounded-xl border border-border bg-card">
                <button type="button" className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/35" onClick={() => setOpenEvidenceGroups((current) => { const next = new Set(current); next.has(role) ? next.delete(role) : next.add(role); return next; })}>
                  <span className="flex min-w-0 items-center gap-3"><ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} /><strong className="truncate text-sm">{role}</strong><span className="shrink-0 text-xs text-muted-foreground">{items.length}건</span></span>
                  <span className="shrink-0 text-sm font-semibold text-muted-foreground">{totalMm.toFixed(2)} MM</span>
                </button>
                {open && <div className="grid gap-2 border-t border-border bg-[#f7fbfc] p-3 dark:bg-black/10 lg:grid-cols-2">{items.map((item) => <article key={`${item.wbsId}-${item.employeeNumber}`} className="rounded-lg border border-border bg-card px-3.5 py-3"><div className="flex justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-semibold">{item.wbsName}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{item.employeeName} · {item.estimatedPersonDays} 인일</p></div><span className="shrink-0 text-xs font-bold text-primary">{item.estimatedMm.toFixed(2)} MM</span></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{item.estimationReason}</p><div className="mt-2 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(0, Math.min(100, item.confidence * 100))}%` }} /></div><p className="mt-1 text-right text-[10px] text-muted-foreground">신뢰도 {Math.round(item.confidence * 100)}%</p></article>)}</div>}
              </div>
            );
          })}
          {evidenceGroups.length === 0 && <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">저장된 견적에는 AI 산정 근거가 포함되지 않습니다. 새 AI 산정 시 이곳에 표시됩니다.</div>}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border bg-muted/45 px-5 py-3.5"><h3 className="text-sm font-semibold">개발비 산출</h3><p className="mt-0.5 text-xs text-muted-foreground">직접인건비를 기준으로 제경비와 기술료를 계산합니다.</p></div>
          <div className="divide-y divide-border/70 text-sm">
            <CostRow label="직접인건비" description="투입인력 금액 합계" value={result?.directLaborCost} />
            <CostInputRow label="제경비" description="직접인건비 × 적용률" value={overheadRate} suffix="%" onChange={(v) => setCostValue(setOverheadRate, v)} amount={result?.overheadAmount} />
            <CostInputRow label="기술료·이윤" description="(직접인건비 + 제경비) × 적용률" value={technicalFeeRate} suffix="%" onChange={(v) => setCostValue(setTechnicalFeeRate, v)} amount={result?.technicalFeeAmount} />
            <CostInputRow label="직접경비" description="출장비·장비비 등" value={directExpense} suffix="원" onChange={(v) => setCostValue(setDirectExpense, v)} amount={directExpense} />
            <div className="flex items-center justify-between bg-primary/8 px-5 py-4"><span className="font-semibold">개발비 소계</span><strong className="text-base text-primary">{won(result?.developmentCost)}</strong></div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border bg-muted/45 px-5 py-3.5"><div><h3 className="text-sm font-semibold">추가 비용</h3><p className="mt-0.5 text-xs text-muted-foreground">라이선스, 클라우드 등 별도 비용을 관리합니다.</p></div><Button variant="outline" size="sm" onClick={() => { setExpenses((rows) => [...rows, { ...EMPTY_EXPENSE }]); setDirty(true); }}><CirclePlus className="size-3.5" /> 항목 추가</Button></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-xs"><thead className="border-b border-border bg-muted/20 text-muted-foreground"><tr>{['품목명','수량','단위','단가','금액','포함',''].map((x, i) => <th key={`${x}-${i}`} className="px-2 py-2 font-medium">{x}</th>)}</tr></thead><tbody>{expenses.map((item, index) => <tr key={index} className="border-b border-border/70"><td className="w-40 px-1.5 py-1.5"><Input className="h-8 text-xs" value={item.name} placeholder="비용 항목" onChange={(e) => updateExpense(index, { name: e.target.value })} /></td><td className="w-16 px-1"><Input className="h-8 text-right text-xs" type="number" min="0" value={item.quantity} onChange={(e) => updateExpense(index, { quantity: numberValue(e.target.value) })} /></td><td className="w-20 px-1"><Input className="h-8 text-xs" value={item.unit} onChange={(e) => updateExpense(index, { unit: e.target.value })} /></td><td className="w-28 px-1"><Input className="h-8 text-right text-xs" type="number" min="0" value={item.unitPrice} onChange={(e) => updateExpense(index, { unitPrice: numberValue(e.target.value) })} /></td><td className="whitespace-nowrap px-2 text-right font-semibold">{won(item.amount ?? item.quantity * item.unitPrice)}</td><td className="px-2 text-center"><Checkbox checked={item.included} onCheckedChange={(v) => updateExpense(index, { included: v === true })} /></td><td className="px-1"><button className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => { setExpenses((rows) => rows.filter((_, i) => i !== index)); setDirty(true); }} aria-label="비용 항목 삭제"><Trash2 className="size-3.5" /></button></td></tr>)}{expenses.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">추가 비용이 없습니다.</td></tr>}</tbody></table></div>
          <div className="flex items-center justify-between bg-primary/8 px-5 py-4 text-sm"><span className="font-semibold">추가 비용 소계</span><strong className="text-base text-primary">{won(result?.expenseItemTotal)}</strong></div>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#183d58]/20 bg-card shadow-[0_14px_35px_rgba(15,45,70,0.12)] dark:border-violet-900/50">
        <div className="grid gap-px bg-border lg:grid-cols-[1fr_1fr_1.2fr_2fr]">
          <SummaryCell label="개발비" value={won(result?.developmentCost)} />
          <SummaryCell label="추가 비용" value={won(result?.expenseItemTotal)} />
          <div className="flex items-center gap-3 bg-card px-4 py-3"><label className="text-xs text-muted-foreground">할인</label><Input className="h-8 text-right text-xs" type="number" min="0" value={discountAmount} onChange={(e) => setCostValue(setDiscountAmount, e.target.value)} /><span className="text-xs text-muted-foreground">원</span></div>
          <div className="flex items-center justify-between bg-[#155d91] px-5 py-3 text-white dark:bg-violet-800"><div><p className="text-xs text-white/65">최종 금액</p><p className="text-[10px] text-white/50">공급가액 {won(result?.supplyAmount)}</p></div><strong className="text-2xl tracking-tight">{won(totalAmount)}</strong></div>
        </div>
        <div className="flex flex-col gap-3 border-t border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between"><Input className="h-9 flex-1 text-xs" value={note} placeholder="견적 메모" onChange={(e) => { setNote(e.target.value); setDirty(true); }} /><label className="flex items-center gap-2 text-xs text-muted-foreground"><Checkbox checked={includeVat} onCheckedChange={(v) => { setIncludeVat(v === true); setDirty(true); }} />VAT 10% 포함</label><span className="flex items-center gap-1.5 text-xs text-muted-foreground">{result?.confirmed ? <Check className="size-3.5 text-emerald-500" /> : null}{result?.confirmed ? "저장된 최종 견적" : "저장 전 견적"}</span></div>
      </section>
    </div>
  );
}

function CostRow({ label, description, value }: { label: string; description: string; value?: number }) {
  return <div className="grid grid-cols-[1fr_auto] items-center px-5 py-3"><div><p className="font-medium">{label}</p><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div><strong className="text-sm">{won(value)}</strong></div>;
}

function CostInputRow({ label, description, value, suffix, onChange, amount }: { label: string; description: string; value: number; suffix: string; onChange: (value: string) => void; amount?: number }) {
  return <div className="grid grid-cols-[1fr_110px_120px] items-center gap-3 px-5 py-2.5"><div><p className="font-medium">{label}</p><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div><div className="relative"><Input className="h-8 pr-8 text-right text-xs" type="number" min="0" value={value} onChange={(e) => onChange(e.target.value)} /><span className="absolute right-2 top-2 text-[10px] text-muted-foreground">{suffix}</span></div><strong className="text-right text-xs">{won(amount)}</strong></div>;
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between bg-card px-4 py-3"><span className="text-xs text-muted-foreground">{label}</span><strong className="text-sm">{value}</strong></div>;
}
