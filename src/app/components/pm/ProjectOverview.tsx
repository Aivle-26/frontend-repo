import type { Dispatch, SetStateAction } from "react";

import { ProjectBoard } from "@/app/components/pm/ProjectBoard";
import {
  ProjectListNotice,
  type ProjectLoadStatus,
} from "@/app/components/pm/ProjectListNotice";
import { StaffNotice } from "@/app/components/staff/StaffNotice";
import type { ProjectSummary } from "@/app/projects/projectTypes";

interface ProjectOverviewProps {
  projects: ProjectSummary[];
  setProjects: Dispatch<SetStateAction<ProjectSummary[]>>;
  pmEmployeeNumber: string;
  /** 공지 등록 시 작성자명으로 기록됩니다. */
  noticeAuthorName?: string;
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
 * 별도 공지사항 메뉴를 없애고, 이 페이지 상단에 공지사항 요약을 바로 노출한다.
 * 그 아래에 프로젝트 목록(보드)을 배치한다.
 */
export function ProjectOverview({
  projects,
  setProjects,
  pmEmployeeNumber,
  noticeAuthorName = "PM",
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
      {/* 상단: 공지사항 요약 (공지사항 메뉴 통합) */}
      <StaffNotice
        variant="compact"
        limit={4}
        canCreate
        authorName={noticeAuthorName}
        excludeCategories={["PM 피드백"]}
      />

      {/* 하단: 프로젝트 보드 */}
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
