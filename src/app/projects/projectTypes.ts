export type ProjectStatus =
  | "분석중"
  | "준비"
  | "승인대기"
  | "진행중"
  | "완료";

export type ProjectDocType = "RFP" | "요구사항정의서" | "제안서";

export interface ProjectDoc {
  name: string;
  type: ProjectDocType;
}

export interface ProjectRequirement {
  id: number;
  text: string;
  category: string;
  priority: "높음" | "중간" | "낮음";
  source: string;
}

export interface ProjectServerMetadata {
  description: string | null;
  pmEmployeeNumber: string;
  status: string;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
}

export interface ProjectSummary {
  id: string;
  server?: ProjectServerMetadata;
  name: string;
  client: string;
  status: ProjectStatus;
  progress: number;
  dueDate: string;
  riskCount: number;
  reqCount: number;
  wizardStep: number;
  estimate: string;
  updatedAt: string;
  docs: ProjectDoc[];
  requirements?: ProjectRequirement[] | null;
}
