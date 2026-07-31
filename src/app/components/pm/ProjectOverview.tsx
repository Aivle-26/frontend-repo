import type { Dispatch, SetStateAction } from "react";

import { ProjectBoard } from "@/app/components/pm/ProjectBoard";
import {
  ProjectListNotice,
  type ProjectLoadStatus,
} from "@/app/components/pm/ProjectListNotice";
import type { ProjectSummary } from "@/app/projects/projectTypes";

interface ProjectOverviewProps {
  projects: ProjectSummary[];
  setProjects: Dispatch<SetStateAction<ProjectSummary[]>>;
  pmEmployeeNumber: string;
  projectLoadStatus: ProjectLoadStatus;
  projectLoadError: string;
  onProjectCreated: (project: ProjectSummary) => void;
  onProjectDeleted: (projectId: string) => Promise<void>;
  onOpenOperational: (project: ProjectSummary) => void;
  onOpenWizard: (project: ProjectSummary) => void;
  /** '요구사항 만들러 가기' 동선. [계획 > 요구사항] 화면으로 이동합니다. */
  onExtract: (project: ProjectSummary) => void;
}

/**
 * [개요 > 프로젝트] 페이지.
 * 프로젝트 목록과 생성·삭제·진입 기능만 담당합니다.
 */
export function ProjectOverview({
  projects,
  setProjects,
  pmEmployeeNumber,
  projectLoadStatus,
  projectLoadError,
  onProjectCreated,
  onProjectDeleted,
  onOpenOperational,
  onOpenWizard,
  onExtract,
}: ProjectOverviewProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <ProjectListNotice status={projectLoadStatus} error={projectLoadError} />
        <ProjectBoard
          projects={projects}
          setProjects={setProjects}
          pmEmployeeNumber={pmEmployeeNumber}
          onProjectCreated={onProjectCreated}
          onProjectDeleted={onProjectDeleted}
          onOpenOperational={onOpenOperational}
          onOpenWizard={onOpenWizard}
          onExtract={onExtract}
        />
      </div>
    </div>
  );
}
