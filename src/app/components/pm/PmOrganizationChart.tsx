import { OrganizationChartArtifactCard } from "@/app/components/common/OrganizationChartArtifactCard";
import type { ProjectSummary } from "@/app/projects/projectTypes";

/**
 * [조직도] — 확정 WBS·일정·팀원 역량을 기준으로 AI가 만든 조직도(JPG)를 확인/생성/다운로드하는 화면.
 * 실제 카드(OrganizationChartArtifactCard)는 이미 다른 화면(PmUpload 등)에서 쓰던 걸 그대로 재사용한다.
 */
export function PmOrganizationChart({ project }: { project: ProjectSummary }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-foreground text-lg">조직도</h2>
        <p className="text-muted-foreground text-sm">
          확정된 WBS·일정·팀원 역량을 바탕으로 AI가 생성한 조직도를 확인할 수 있어요.
        </p>
      </div>
      <OrganizationChartArtifactCard projectId={project.id} canGenerate />
    </div>
  );
}