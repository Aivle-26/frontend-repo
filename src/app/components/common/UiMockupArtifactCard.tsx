import { useEffect, useState } from "react";
import {
  Download,
  ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  ApiError,
  projectRepository,
  type UiMockupArtifact,
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

interface UiMockupArtifactCardProps {
  projectId: string | number;
  canGenerate: boolean;
}

function apiErrorCode(error: ApiError) {
  if (!error.payload || typeof error.payload !== "object") return "";
  const code = (error.payload as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

function errorMessage(error: unknown) {
  if (!(error instanceof ApiError)) {
    return "UI 목업을 처리하는 중 오류가 발생했습니다.";
  }
  if (apiErrorCode(error) === "CONFIRMED_REQUIREMENT_NOT_FOUND") {
    return "확정된 요구사항이 필요합니다. 요구사항을 확정한 뒤 다시 생성해 주세요.";
  }
  if (error.status === 403) return "이 프로젝트의 UI 목업에 접근할 권한이 없습니다.";
  if (error.status === 502 || error.status === 503) {
    return "UI 목업 생성 서버 또는 파일 저장소에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.";
  }
  return error.message;
}

function approvalLabel(status: UiMockupArtifact["approvalStatus"]) {
  if (status === "APPROVED") return "승인 완료";
  if (status === "REJECTED") return "반려";
  return "검토 대기";
}

function formatBytes(value: number) {
  if (value < 1024) return `${value}B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`;
  return `${(value / (1024 * 1024)).toFixed(1)}MB`;
}

export function UiMockupArtifactCard({
  projectId,
  canGenerate,
}: UiMockupArtifactCardProps) {
  const [artifact, setArtifact] = useState<UiMockupArtifact | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setIsLoading(true);
    setArtifact(null);
    setPreviewUrl(null);
    setMessage("");

    const load = async () => {
      try {
        const metadata = await projectRepository.getLatestUiMockup(projectId);
        if (cancelled) return;
        setArtifact(metadata);
        const blob = await projectRepository.getUiMockupBlob(projectId);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      } catch (error) {
        if (cancelled) return;
        if (
          error instanceof ApiError &&
          error.status === 404 &&
          apiErrorCode(error) === "UI_MOCKUP_NOT_GENERATED"
        ) {
          setArtifact(null);
          return;
        }
        setMessage(errorMessage(error));
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
    setMessage("");
    try {
      const generated = await projectRepository.generateUiMockup(projectId);
      toast.success(`UI 목업 ${generated.version} 버전을 생성했습니다.`);
      setReloadKey((value) => value + 1);
    } catch (error) {
      const nextMessage = errorMessage(error);
      setMessage(nextMessage);
      toast.error(nextMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const download = async () => {
    if (!artifact || isDownloading) return;
    setIsDownloading(true);
    setMessage("");
    try {
      const downloaded = await projectRepository.downloadUiMockup(
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
      const nextMessage = errorMessage(error);
      setMessage(nextMessage);
      toast.error(nextMessage);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ImageIcon className="size-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>UI 목업</CardTitle>
              <Badge variant="secondary">JPG 산출물</Badge>
            </div>
            <CardDescription className="mt-1">
              확정 요구사항을 기반으로 설계한 핵심 화면 목업입니다.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {message ? (
          <Alert variant="destructive"><AlertDescription>{message}</AlertDescription></Alert>
        ) : null}

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-14 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            UI 목업 상태를 불러오는 중입니다.
          </div>
        ) : artifact ? (
          <div className="space-y-4">
            <div className="flex min-h-56 items-center justify-center overflow-hidden rounded-lg border bg-muted/30 p-3">
              {previewUrl ? (
                <img src={previewUrl} alt="프로젝트 UI 목업 미리보기" className="max-h-[560px] w-full object-contain" />
              ) : (
                <div className="text-sm text-muted-foreground">UI 목업 미리보기를 불러오지 못했습니다.</div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">v{artifact.version}</Badge>
                <Badge variant="outline">{approvalLabel(artifact.approvalStatus)}</Badge>
                <span className="text-muted-foreground">{formatBytes(artifact.fileSize)}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={isDownloading} onClick={() => void download()}>
                  {isDownloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  다운로드
                </Button>
                {canGenerate ? (
                  <Button type="button" disabled={isGenerating} onClick={() => void generate()}>
                    {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                    {isGenerating ? "UI 목업을 생성하고 있습니다" : "재생성"}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed p-5">
            <div>
              <div className="font-medium text-foreground">아직 생성되지 않음</div>
              <p className="mt-1 text-sm text-muted-foreground">확정 요구사항에서 대표 화면 최대 3개를 설계해 JPG로 저장합니다.</p>
            </div>
            {canGenerate ? (
              <Button type="button" disabled={isGenerating} onClick={() => void generate()}>
                {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {isGenerating ? "UI 목업을 생성하고 있습니다" : "UI 목업 생성"}
              </Button>
            ) : null}
          </div>
        )}

        {!isLoading && message ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setReloadKey((value) => value + 1)}>
            <RefreshCw className="size-4" /> 다시 불러오기
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
