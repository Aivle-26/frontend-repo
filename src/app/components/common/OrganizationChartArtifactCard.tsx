import { useEffect, useState } from "react";
import {
  Download,
  FileImage,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  ApiError,
  projectRepository,
  type OrganizationChartArtifact,
} from "@/app/api/projectRepository";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Checkbox } from "@/app/components/ui/checkbox";

interface OrganizationChartArtifactCardProps {
  projectId: string | number;
  canGenerate: boolean;
}

const prerequisiteMessages: Record<string, string> = {
  CONFIRMED_WBS_NOT_FOUND:
    "확정된 WBS가 필요합니다. WBS를 확정한 뒤 다시 생성해 주세요.",
  PLANNING_SCHEDULE_NOT_FOUND:
    "모든 최하위 WBS의 추천 일정이 필요합니다. 일정을 생성한 뒤 다시 시도해 주세요.",
  ACTIVE_PROJECT_MEMBER_NOT_FOUND:
    "활성 프로젝트 팀원이 없습니다. 팀원을 등록한 뒤 다시 생성해 주세요.",
};

function apiErrorCode(error: ApiError) {
  if (!error.payload || typeof error.payload !== "object") return "";
  const code = (error.payload as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

function organizationChartErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) {
    return "조직도를 처리하는 중 오류가 발생했습니다.";
  }
  const code = apiErrorCode(error);
  if (prerequisiteMessages[code]) return prerequisiteMessages[code];
  if (error.status === 403) return "이 프로젝트의 조직도에 접근할 권한이 없습니다.";
  if (error.status === 502 || error.status === 503) {
    return "조직도 생성 서버 또는 파일 저장소에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.";
  }
  return error.message;
}

function approvalLabel(status: OrganizationChartArtifact["approvalStatus"]) {
  if (status === "APPROVED") return "승인 완료";
  if (status === "REJECTED") return "반려";
  return "검토 대기";
}

function formatBytes(value: number) {
  if (value < 1024) return `${value}B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`;
  return `${(value / (1024 * 1024)).toFixed(1)}MB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ko-KR");
}

export function OrganizationChartArtifactCard({
  projectId,
  canGenerate,
}: OrganizationChartArtifactCardProps) {
  const [artifact, setArtifact] = useState<OrganizationChartArtifact | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    setIsLoading(true);
    setArtifact(null);
    setPreviewUrl(null);
    setErrorMessage("");

    const load = async () => {
      try {
        const metadata = await projectRepository.getLatestOrganizationChart(
          projectId,
        );
        if (cancelled) return;
        setArtifact(metadata);

        const blob = await projectRepository.getOrganizationChartBlob(projectId);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      } catch (error) {
        if (cancelled) return;
        if (
          error instanceof ApiError &&
          error.status === 404 &&
          apiErrorCode(error) === "ORGANIZATION_CHART_NOT_GENERATED"
        ) {
          setArtifact(null);
          return;
        }
        setErrorMessage(organizationChartErrorMessage(error));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [projectId, reloadKey]);

  const generate = async () => {
    if (!canGenerate || isGenerating) return;
    setIsGenerating(true);
    setErrorMessage("");
    try {
      const generated = await projectRepository.generateOrganizationChart(
        projectId,
      );
      toast.success(`조직도 ${generated.version} 버전을 생성했습니다.`);
      setReloadKey((value) => value + 1);
    } catch (error) {
      const message = organizationChartErrorMessage(error);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const download = async () => {
    if (!artifact || isDownloading) return;
    setIsDownloading(true);
    setErrorMessage("");
    try {
      const downloaded = await projectRepository.downloadOrganizationChart(
        projectId,
        artifact.version,
      );
      const url = URL.createObjectURL(downloaded.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = downloaded.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      const message = organizationChartErrorMessage(error);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileImage className="size-5" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>조직도</CardTitle>
                <Badge variant="secondary">필수 산출물</Badge>
              </div>
              <CardDescription className="mt-1">
                확정 WBS, 추천 일정, 팀원 역량을 기준으로 생성한 JPG입니다.
              </CardDescription>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked disabled aria-label="조직도 필수 산출물" />
            필수 선택
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-14 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            조직도 상태를 불러오는 중입니다.
          </div>
        ) : artifact ? (
          <div className="space-y-4">
            <div className="flex min-h-56 items-center justify-center overflow-hidden rounded-lg border bg-muted/30 p-3">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="프로젝트 조직도 미리보기"
                  className="max-h-[560px] w-full object-contain"
                />
              ) : (
                <div className="text-sm text-muted-foreground">
                  조직도 미리보기를 불러오지 못했습니다.
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">v{artifact.version}</Badge>
                <Badge variant="outline">
                  {approvalLabel(artifact.approvalStatus)}
                </Badge>
                <span className="text-muted-foreground">
                  {formatDate(artifact.generatedAt)} · {formatBytes(artifact.fileSize)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isDownloading}
                  onClick={() => void download()}
                >
                  {isDownloading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  다운로드
                </Button>
                {canGenerate ? (
                  <Button
                    type="button"
                    disabled={isGenerating}
                    onClick={() => void generate()}
                  >
                    {isGenerating ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                    {isGenerating ? "조직도를 생성하고 있습니다" : "재생성"}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed p-5">
            <div>
              <div className="font-medium text-foreground">아직 생성되지 않음</div>
              <p className="mt-1 text-sm text-muted-foreground">
                조직도는 필수 산출물이며 생성 후 검토 대기 상태로 등록됩니다.
              </p>
            </div>
            {canGenerate ? (
              <Button
                type="button"
                disabled={isGenerating}
                onClick={() => void generate()}
              >
                {isGenerating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {isGenerating ? "조직도를 생성하고 있습니다" : "조직도 생성"}
              </Button>
            ) : null}
          </div>
        )}

        {!isLoading && errorMessage ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setReloadKey((value) => value + 1)}
          >
            <RefreshCw className="size-4" />
            다시 불러오기
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
