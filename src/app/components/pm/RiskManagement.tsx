import { CommunicationRiskCard } from "@/app/components/common/CommunicationRiskCard";
import { ImpactAnalysisCard } from "@/app/components/common/ImpactAnalysisCard";
import { MemberDelayCard } from "@/app/components/common/MemberDelayCard";
import type { ProjectSummary } from "@/app/data/demoData";

/**
 * [실행 > 리스크] 화면.
 * 기존 데모(MANAGED_RISKS) 기반 목업 리스크 목록/상세/KPI 블록은 제거하고,
 * 실제 AI 서버에 연동된 리스크 카드 3종만 노출한다.
 */
export function RiskManagement({ project }: { project: ProjectSummary }) {
  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="leading-tight">
        <h2 className="text-foreground text-lg">리스크</h2>
        <p className="text-muted-foreground text-sm">
          AI 서버가 분석한 프로젝트 리스크입니다.
        </p>
      </div>

      {/* Slack 커뮤니케이션 리스크 (AI 서버 연동) */}
      <CommunicationRiskCard projectId={project.id} />

      {/* 프로젝트 조정 여부 평가 (요구사항 변경 영향도, AI 서버 연동) */}
      <ImpactAnalysisCard projectId={project.id} />

      {/* 팀원별 업무 진행 지연 분석 (AI 서버 연동, 팀원 데이터 기반) */}
      <MemberDelayCard projectId={project.id} />
    </div>
  );
}
