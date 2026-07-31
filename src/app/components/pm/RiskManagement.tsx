import { useMemo, useState } from "react";
import {
  Shield,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Sparkles,
  FileText,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";

import { toast } from "sonner";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { cn } from "@/app/components/ui/utils";
import { CountUp } from "@/app/components/common/CountUp";
import { CommunicationRiskCard } from "@/app/components/common/CommunicationRiskCard";
import { ImpactAnalysisCard } from "@/app/components/common/ImpactAnalysisCard";
import {
  MANAGED_RISKS,
  type ManagedRisk,
  type ManagedRiskSeverity,
  type ManagedRiskStatus,
  type ProjectSummary,
  type RiskLevel,
} from "@/app/data/demoData";

/** Slack 커뮤니케이션 리스크 카드를 화면에 보여줄지 여부. 연동 코드는 그대로 두고 노출만 끈다. */
const SHOW_COMMUNICATION_RISK = false;

function severityClass(s: ManagedRiskSeverity) {
  const map: Record<ManagedRiskSeverity, string> = {
    심각: "bg-red-50 text-red-700 border-red-200",
    높음: "bg-orange-50 text-orange-700 border-orange-200",
    보통: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return map[s];
}

function severityDot(s: ManagedRiskSeverity) {
  const map: Record<ManagedRiskSeverity, string> = {
    심각: "bg-red-500",
    높음: "bg-orange-500",
    보통: "bg-amber-500",
  };
  return map[s];
}

function statusClass(s: ManagedRiskStatus) {
  const map: Record<ManagedRiskStatus, string> = {
    "검토 대기": "bg-amber-50 text-amber-700 border-amber-200",
    "PM 수정": "bg-blue-50 text-blue-700 border-blue-200",
    "AI 생성": "bg-purple-50 text-purple-700 border-purple-200",
    "해결 완료": "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  return map[s];
}

function levelClass(l: RiskLevel) {
  const map: Record<RiskLevel, string> = {
    높음: "bg-red-50 text-red-700",
    보통: "bg-amber-50 text-amber-700",
    낮음: "bg-emerald-50 text-emerald-700",
  };
  return map[l];
}

export function RiskManagement({ project }: { project: ProjectSummary }) {
  const [risks, setRisks] = useState<ManagedRisk[]>(MANAGED_RISKS);
  const [selectedId, setSelectedId] = useState<string>(MANAGED_RISKS[0]?.id ?? "");

  const selected = risks.find((r) => r.id === selectedId) ?? null;

  const [reporting, setReporting] = useState(false);
  const [lastReportAt, setLastReportAt] = useState<string | null>(null);

  const generateWeeklyReport = async () => {
    setReporting(true);
    // UI 확인용 임시 동작. 백엔드 연동 시 리스크 보고서 생성 API로 교체합니다.
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    setReporting(false);
    setLastReportAt("방금 전");
    toast.success("이번 주 리스크 보고서를 생성해 문서함에 저장했어요.");
  };

  const stats = useMemo(
    () => ({
      total: risks.length,
      critical: risks.filter((r) => r.severity === "심각").length,
      pending: risks.filter((r) => r.status === "검토 대기").length,
      resolved: risks.filter((r) => r.status === "해결 완료").length,
    }),
    [risks],
  );

  const resolve = (id: string) => {
    setRisks((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "해결 완료" } : r)),
    );
    toast.success("리스크를 해결 처리했어요.");
  };

  return (
    <div className="space-y-4">
      {/* 헤더 + 주간 리스크 보고서 생성 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="leading-tight">
          <h2 className="text-foreground text-lg">리스크 관리</h2>
          <p className="text-muted-foreground text-sm">
            AI가 탐지한 리스크를 검토하고 주간 보고서로 정리합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastReportAt && (
            <span className="text-muted-foreground text-xs">
              최근 생성 {lastReportAt}
            </span>
          )}
          <Button onClick={generateWeeklyReport} disabled={reporting}>
            {reporting ? (
              <>
                <Clock className="size-4 animate-spin" /> 생성 중…
              </>
            ) : (
              <>
                <FileText className="size-4" /> 주간 리스크 보고서 생성
              </>
            )}
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          icon={<Shield className="size-5" />}
          tone="bg-muted text-muted-foreground"
          value={`${stats.total}`}
          label="전체 리스크"
        />
        <StatCard
          icon={<AlertTriangle className="size-5" />}
          tone="bg-red-50 text-red-600"
          value={`${stats.critical}`}
          label="심각 리스크"
          highlight="border-red-100 bg-red-50/40"
        />
        <StatCard
          icon={<Clock className="size-5" />}
          tone="bg-amber-50 text-amber-600"
          value={`${stats.pending}`}
          label="검토 대기"
          highlight="border-amber-100 bg-amber-50/40"
        />
        <StatCard
          icon={<CheckCircle2 className="size-5" />}
          tone="bg-emerald-50 text-emerald-600"
          value={`${stats.resolved}`}
          label="해결 완료"
          highlight="border-emerald-100 bg-emerald-50/40"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4">
        {/* 리스크 리스트 */}
        <div className="space-y-3">
          {risks.map((r) => {
            const active = r.id === selectedId;
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={cn(
                  "w-full rounded-xl border bg-card p-4 text-left transition-all",
                  active
                    ? "border-primary ring-1 ring-primary/30"
                    : "border-border hover:border-border hover:shadow-sm",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", severityDot(r.severity))} />
                  <Badge variant="outline" className={cn("font-normal", severityClass(r.severity))}>
                    {r.severity}
                  </Badge>
                  <Badge variant="secondary" className="font-normal">
                    {r.category}
                  </Badge>
                  <Badge variant="outline" className={cn("font-normal", statusClass(r.status))}>
                    {r.status}
                  </Badge>
                  <MoreHorizontal className="ml-auto size-4 text-muted-foreground" />
                </div>

                <div className="mt-2 text-foreground">{r.title}</div>
                <p className="mt-1 text-muted-foreground text-sm">{r.description}</p>

                <div className="mt-3 flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">영향도</span>
                    <span className={cn("rounded px-1.5 py-0.5 font-medium", levelClass(r.impact))}>
                      {r.impact}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">발생 가능성</span>
                    <span
                      className={cn("rounded px-1.5 py-0.5 font-medium", levelClass(r.likelihood))}
                    >
                      {r.likelihood}
                    </span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* 상세 패널 */}
        <div>
          {selected ? (
            <Card className="sticky top-4">
              <CardContent className="space-y-4 pt-5">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn("font-normal", severityClass(selected.severity))}
                  >
                    {selected.severity}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn("font-normal", statusClass(selected.status))}
                  >
                    {selected.status}
                  </Badge>
                </div>

                <div className="leading-tight">
                  <h3 className="text-foreground">{selected.title}</h3>
                  <p className="text-muted-foreground text-sm mt-0.5">{selected.category}</p>
                </div>

                <Section title="리스크 원인">
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                    {selected.cause}
                  </div>
                </Section>

                <Section title="영향 분석">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-border p-3 text-center">
                      <div className="text-muted-foreground text-xs">영향도</div>
                      <div className="mt-1 text-foreground">{selected.impact}</div>
                    </div>
                    <div className="rounded-lg border border-border p-3 text-center">
                      <div className="text-muted-foreground text-xs">발생 가능성</div>
                      <div className="mt-1 text-foreground">{selected.likelihood}</div>
                    </div>
                  </div>
                </Section>

                <Section title="AI 대응 방안">
                  <div className="rounded-lg bg-emerald-50 p-3">
                    <div className="flex items-center gap-1.5 text-emerald-700 text-xs">
                      <Sparkles className="size-3.5" /> 리스크 관리 AI
                    </div>
                    <p className="mt-1.5 text-sm text-emerald-900">{selected.aiSolution}</p>
                  </div>
                </Section>

                <Section title="근거 문서">
                  <div className="space-y-1.5">
                    {selected.evidence.map((doc) => (
                      <button
                        key={doc}
                        onClick={() => toast(`'${doc}' 열기`)}
                        className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
                      >
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate text-foreground">{doc}</span>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </Section>

                <Button
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-600/90"
                  disabled={selected.status === "해결 완료"}
                  onClick={() => resolve(selected.id)}
                >
                  <CheckCircle2 className="size-4" />
                  {selected.status === "해결 완료" ? "해결 완료됨" : "리스크 해결 처리"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                왼쪽에서 리스크를 선택하세요.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Slack 커뮤니케이션 리스크 (AI 서버 연동) — 요청으로 화면에서만 숨김. 연동 코드는 그대로 둠 */}
      {SHOW_COMMUNICATION_RISK && <CommunicationRiskCard projectId={project.id} />}

      {/* 프로젝트 조정 여부 평가 (요구사항 변경 영향도, AI 서버 연동) */}
      <ImpactAnalysisCard projectId={project.id} />

      <p className="text-muted-foreground text-xs">
        {project.name} 기준 · AI가 탐지한 리스크를 검토합니다.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-muted-foreground text-xs">{title}</div>
      {children}
    </div>
  );
}

function StatCard({
  icon,
  tone,
  value,
  label,
  highlight,
}: {
  icon: React.ReactNode;
  tone: string;
  value: string;
  label: string;
  highlight?: string;
}) {
  return (
    <Card className={cn(highlight)}>
      <CardContent className="flex items-center gap-3 py-4">
        <span className={cn("flex size-10 items-center justify-center rounded-xl", tone)}>
          {icon}
        </span>
        <div className="leading-tight">
          <div className="text-foreground text-2xl">
            <CountUp value={value} />
          </div>
          <div className="text-muted-foreground text-sm">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}