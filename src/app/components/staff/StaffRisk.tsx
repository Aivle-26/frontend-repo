import {
  Search,
  ShieldCheck,
  Share2,
  Download,
  Plus,
  Settings,
  Github,
  Cloud,
  Bot,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { cn } from "@/app/components/ui/utils";
import { projectRepository } from "@/app/api/projectRepository";
import { CommunicationRiskCard } from "@/app/components/common/CommunicationRiskCard";
import type { RiskSeverity, OpenRiskState } from "@/app/data/demoData";

function severityBadge(s: RiskSeverity) {
  const map: Record<RiskSeverity, string> = {
    "심각": "bg-red-50 text-red-700 border-red-200",
    "주의": "bg-amber-50 text-amber-700 border-amber-200",
    "정보": "bg-blue-50 text-blue-700 border-blue-200",
  };
  return map[s];
}

function stateBadge(s: OpenRiskState) {
  const map: Record<OpenRiskState, string> = {
    "미해결": "bg-red-50 text-red-700 border-red-200",
    "처리 중": "bg-blue-50 text-blue-700 border-blue-200",
    "대기 중": "bg-amber-50 text-amber-700 border-amber-200",
    "주의": "bg-amber-50 text-amber-700 border-amber-200",
  };
  return map[s];
}

const SERVICE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  github: Github,
  jira: Share2,
  cloudwatch: Cloud,
};

interface StaffRiskProps {
  /** 대상 프로젝트. 커뮤니케이션 리스크 분석 단위. */
  projectId: string;
}

export function StaffRisk({ projectId }: StaffRiskProps) {
  const { detections, openRisks, solutions } = projectRepository.getRiskBoard();

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* AI 리스크 탐지 현황 */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Search className="size-4 text-blue-600" />
              <span className="text-foreground">AI 리스크 탐지 현황 (FE/BE/CLOUD)</span>
            </div>
            <span className="flex size-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <ShieldCheck className="size-5" />
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">리스크 ID</TableHead>
                <TableHead>서비스</TableHead>
                <TableHead>탐지 소스</TableHead>
                <TableHead className="w-28">탐지 일시</TableHead>
                <TableHead className="w-16">심각도</TableHead>
                <TableHead>설명</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detections.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-foreground text-sm">{d.id}</TableCell>
                  <TableCell className="text-foreground text-sm">{d.service}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{d.source}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{d.detectedAt}</TableCell>
                  <TableCell>
                    <RiskPill label={d.severity} critical={d.severity === "심각"} tone={severityBadge(d.severity)} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{d.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Slack 커뮤니케이션 리스크 (AI 서버 연동) */}
      <CommunicationRiskCard projectId={projectId} />

      {/* 미해결 주요 리스크 */}
      <Card className="border-red-100 bg-red-50/30">
        <CardContent className="pt-5">
          <div className="mb-4">
            <span className="text-foreground">미해결 주요 리스크</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>리스크</TableHead>
                <TableHead className="w-32">연동 서비스</TableHead>
                <TableHead className="w-24">발생 시간</TableHead>
                <TableHead className="w-20">상태</TableHead>
                <TableHead className="w-16">심각도</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {openRisks.map((r) => {
                const SIcon = SERVICE_ICON[r.serviceIcon] ?? Share2;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-foreground text-sm">{r.title}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                        <SIcon className="size-4 text-muted-foreground" />
                        {r.service}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{r.occurredAt}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("font-normal", stateBadge(r.state))}>
                        {r.state}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.severity && (
                        <RiskPill label={r.severity} critical={r.severity === "심각"} tone={severityBadge(r.severity)} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* AI 리스크 해결 방안 */}
      <Card>
        <CardContent className="pt-5">
          <div className="mb-4 flex items-center gap-2">
            <Bot className="size-4 text-blue-600" />
            <span className="text-foreground">AI 리스크 해결 방안 (AI 기능: GitHub 연동 등)</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>항목</TableHead>
                <TableHead className="w-20">담당자</TableHead>
                <TableHead className="w-24">예상 소요 시간</TableHead>
                <TableHead className="w-16 text-center">자동화</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {solutions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex size-7 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                        <Settings className="size-4" />
                      </span>
                      <span className="text-foreground text-sm">{s.item}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{s.owner}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{s.eta}</TableCell>
                  <TableCell className="text-center">
                    {s.automated && (
                      <CheckCircle2 className="mx-auto size-5 text-emerald-500" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* 리스크 상태/심각도 배지 — 심각은 솔리드 빨강 + 라이브 핑 점 */
function RiskPill({
  label,
  critical,
  tone,
}: {
  label: string;
  critical: boolean;
  tone: string;
}) {
  if (critical) {
    return (
      <Badge className="border-transparent bg-red-700 text-white font-normal dark:bg-red-800">
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn("font-normal", tone)}>
      {label}
    </Badge>
  );
}

/* 상단 액션 바 (공유/내보내기/새 리스크) — 페이지 헤더 보조용 export */
export function StaffRiskActions() {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => toast("공유 링크를 생성했습니다.")}>
        <Share2 className="size-4" /> 공유
      </Button>
      <Button variant="outline" size="sm" onClick={() => toast("리스크 현황을 내보냈습니다.")}>
        <Download className="size-4" /> 내보내기
      </Button>
      <Button size="sm" onClick={() => toast.success("새 리스크 등록 화면")}>
        <Plus className="size-4" /> 새 리스크 등록
      </Button>
    </div>
  );
}
