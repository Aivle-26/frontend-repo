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
  Share2,
  Download,
  Plus,
  Megaphone,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { cn } from "@/app/components/ui/utils";
import { CountUp } from "@/app/components/common/CountUp";
import { CommunicationRiskCard } from "@/app/components/common/CommunicationRiskCard";
import {
  MANAGED_RISKS,
  type ManagedRisk,
  type ManagedRiskSeverity,
  type ManagedRiskStatus,
  type RiskLevel,
} from "@/app/data/demoData";

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

interface StaffRiskProps {
  /** 대상 프로젝트. 커뮤니케이션 리스크 분석 단위. */
  projectId: string;
}

export function StaffRisk({ projectId }: StaffRiskProps) {
  const risks = MANAGED_RISKS;
  const [selectedId, setSelectedId] = useState<string>(MANAGED_RISKS[0]?.id ?? "");
  const [reported, setReported] = useState<Set<string>>(new Set());

  const selected = risks.find((r) => r.id === selectedId) ?? null;

  const stats = useMemo(
    () => ({
      total: risks.length,
      critical: risks.filter((r) => r.severity === "심각").length,
      pending: risks.filter((r) => r.status === "검토 대기").length,
      resolved: risks.filter((r) => r.status === "해결 완료").length,
    }),
    [risks],
  );

  const report = (id: string) => {
    setReported((prev) => new Set(prev).add(id));
    toast.success("대응 상황을 PM에게 보고했어요.");
  };

  return (
    <div className="space-y-4">
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
                  {reported.has(r.id) && (
                    <Badge variant="outline" className="border-blue-200 bg-blue-50 font-normal text-blue-700">
                      보고함
                    </Badge>
                  )}
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
                    <span className={cn("rounded px-1.5 py-0.5 font-medium", levelClass(r.likelihood))}>
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
                  <Badge variant="outline" className={cn("font-normal", severityClass(selected.severity))}>
                    {selected.severity}
                  </Badge>
                  <Badge variant="outline" className={cn("font-normal", statusClass(selected.status))}>
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
                  className="w-full"
                  variant={reported.has(selected.id) ? "outline" : "default"}
                  disabled={reported.has(selected.id)}
                  onClick={() => report(selected.id)}
                >
                  <Megaphone className="size-4" />
                  {reported.has(selected.id) ? "PM에게 보고됨" : "내 대응 상황 보고"}
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

      {/* Slack 커뮤니케이션 리스크 (AI 서버 연동) */}
      <CommunicationRiskCard projectId={projectId} />

      <p className="text-muted-foreground text-xs">
        AI가 탐지한 리스크를 확인하고, 내 업무와 관련된 대응 상황을 PM에게 보고합니다.
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

/* 상단 액션 바 (공유/내보내기/리스크 신고) — 페이지 헤더 보조용 export */
export function StaffRiskActions() {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => toast("공유 링크를 생성했습니다.")}>
        <Share2 className="size-4" /> 공유
      </Button>
      <Button variant="outline" size="sm" onClick={() => toast("리스크 현황을 내보냈습니다.")}>
        <Download className="size-4" /> 내보내기
      </Button>
      <Button size="sm" onClick={() => toast.success("리스크 신고 화면을 엽니다.")}>
        <Plus className="size-4" /> 리스크 신고
      </Button>
    </div>
  );
}
