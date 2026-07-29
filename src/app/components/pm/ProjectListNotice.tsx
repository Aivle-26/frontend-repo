import { ApiError } from "@/app/api/projectRepository";
import { Alert, AlertDescription } from "@/app/components/ui/alert";

export type ProjectLoadStatus =
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "unauthorized"
  | "forbidden"
  | "error";

export function getProjectLoadStatus(error: unknown): ProjectLoadStatus {
  if (error instanceof ApiError) {
    if (error.status === 401) return "unauthorized";
    if (error.status === 403) return "forbidden";
  }
  return "error";
}

export function getProjectLoadError(error: unknown) {
  if (
    error instanceof ApiError &&
    error.status !== 401 &&
    error.status !== 403
  ) {
    return error.message;
  }
  return "프로젝트 목록을 불러오지 못했습니다.";
}

export function ProjectListNotice({
  status,
  error,
}: {
  status: ProjectLoadStatus;
  error: string;
}) {
  if (status === "idle" || status === "loading") {
    return (
      <Alert>
        <AlertDescription>프로젝트 목록을 불러오는 중입니다.</AlertDescription>
      </Alert>
    );
  }

  if (status === "empty") {
    return (
      <Alert>
        <AlertDescription>등록된 프로젝트가 없습니다.</AlertDescription>
      </Alert>
    );
  }

  if (status === "unauthorized") {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          세션이 만료되어 다시 로그인이 필요합니다.
        </AlertDescription>
      </Alert>
    );
  }

  if (status === "forbidden") {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          프로젝트 목록을 조회할 권한이 없습니다.
        </AlertDescription>
      </Alert>
    );
  }

  if (status === "error") {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {error || "프로젝트 목록을 불러오지 못했습니다."}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
