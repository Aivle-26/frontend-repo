import { CommunicationRiskCard } from "@/app/components/common/CommunicationRiskCard";
import { ImpactAnalysisCard } from "@/app/components/common/ImpactAnalysisCard";
import type { ProjectSummary } from "@/app/data/demoData";

/** Slack 커뮤니케이션 리스크 카드를 화면에 보여줄지 여부. 연동 코드는 그대로 두고 노출만 끈다. */
const SHOW_COMMUNICATION_RISK = true;

/**
 * [실행 > 리스크] 화면.
 * 데모(MANAGED_RISKS) 기반 목업 리스크 목록/상세/KPI 블록은 제거하고,
 * 실제 AI 서버에 연동된 리스크 카드만 노출한다.
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
      {SHOW_COMMUNICATION_RISK && (
        <CommunicationRiskCard projectId={project.id} />
      )}

      {/* 프로젝트 조정 여부 평가 (요구사항 변경 영향도, AI 서버 연동) */}
      <ImpactAnalysisCard projectId={project.id} />
    </div>
  );
}
