import type { ProjectDocumentUploadItem } from "@/app/api/projectRepository";
import type { ProjectDoc, ProjectDocType } from "@/app/data/demoData";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_REQUEST_SIZE = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "xlsx", "pptx", "txt"]);

export const PROJECT_DOCUMENT_ACCEPT =
  ".pdf,.docx,.xlsx,.pptx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain";

export interface PendingProjectDocument {
  id: string;
  file: File;
  type: ProjectDocType;
}

export function createPendingProjectDocuments(
  files: File[],
): PendingProjectDocument[] {
  return files.map((file) => ({
    id: crypto.randomUUID(),
    file,
    type: "RFP",
  }));
}

export function validateProjectDocumentFiles(files: File[]) {
  const invalidType = files.find((file) => {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    return !ALLOWED_EXTENSIONS.has(extension);
  });
  if (invalidType) {
    return `"${invalidType.name}"은 지원하지 않는 파일 형식입니다.`;
  }

  const oversized = files.find((file) => file.size > MAX_FILE_SIZE);
  if (oversized) {
    return `"${oversized.name}"은 파일당 최대 10MB를 초과합니다.`;
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MAX_REQUEST_SIZE) {
    return "한 번에 업로드할 수 있는 전체 용량은 최대 50MB입니다.";
  }

  return null;
}

export function mapUploadedProjectDocuments(
  documents: ProjectDocumentUploadItem[],
  pendingDocuments: PendingProjectDocument[],
): ProjectDoc[] {
  return documents.map((document, index) => ({
    name: document.originalFileName,
    type: pendingDocuments[index]?.type ?? "RFP",
  }));
}
