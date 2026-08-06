import { CheckCircle2, FileImage, Sparkles } from "lucide-react";
import { OrganizationChartArtifactCard } from "@/app/components/common/OrganizationChartArtifactCard";
import { Badge } from "@/app/components/ui/badge";
import type { ProjectSummary } from "@/app/projects/projectTypes";

const prerequisites = [
  "확정된 WBS",
  "최하위 WBS 일정",
  "활성 프로젝트 팀원 및 역량",
];

export function PmOrganizationChart({ project }: { project: ProjectSummary }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg text-foreground">
            <FileImage className="size-5" /> 조직도
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            확정 WBS·일정·팀원 역량을 AI 서버로 전달해 조직도 JPG를 생성하고 화면에 표시합니다.
          </p>
        </div>
        <Badge variant="outline" className="gap-1 font-normal">
          <Sparkles className="size-3.5" /> AI 이미지 산출물
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {prerequisites.map((item, index) => (
          <div key={item} className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="size-4" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">생성 조건 {index + 1}</p>
              <p className="text-sm font-medium text-foreground">{item}</p>
            </div>
          </div>
        ))}
      </div>

      <OrganizationChartArtifactCard projectId={project.id} canGenerate />
    </div>
  );
}
