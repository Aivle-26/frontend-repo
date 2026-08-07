import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Database,
  Download,
  FileJson,
  LayoutTemplate,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  downloadUiPrototypeJson,
  downloadUiPrototypeSvg,
  generateUiPrototype,
  loadStoredUiPrototype,
  uiPrototypeErrorMessage,
  type UiPrototypeResult,
  type UiPrototypeScreen,
  type UiPrototypeStyle,
} from "@/app/api/uiPrototypeApi";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import type { ProjectSummary } from "@/app/projects/projectTypes";
import {
  isProjectUiPrototypeCompleted,
  markProjectUiPrototypeCompleted,
} from "@/app/projects/projectProgress";

const STYLE_LABELS: Record<UiPrototypeStyle, string> = {
  WORKSPACE: "업무형 대시보드",
  MINIMAL: "미니멀 웹 서비스",
  MOBILE_FIRST: "모바일 우선",
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ko-KR");
}

function llmStatusLabel(status: string) {
  if (status === "SUCCEEDED") return "AI 생성";
  if (status === "SKIPPED_NO_API_KEY") return "규칙 기반 생성";
  if (status === "FALLBACK") return "AI 대체 응답";
  if (status === "DISABLED") return "AI 비활성";
  return status;
}

export function PmUiPrototype({ project }: { project: ProjectSummary }) {
  const [completed, setCompleted] = useState(() =>
    isProjectUiPrototypeCompleted(project.id),
  );
  const [result, setResult] = useState<UiPrototypeResult | null>(() =>
    loadStoredUiPrototype(project.id),
  );
  const [selectedScreenId, setSelectedScreenId] = useState(
    () => loadStoredUiPrototype(project.id)?.screens[0]?.id ?? "",
  );
  const [request, setRequest] = useState(
    "PM이 프로젝트 진행률, 일정, 리스크, 팀 업무를 빠르게 파악할 수 있는 화면",
  );
  const [style, setStyle] = useState<UiPrototypeStyle>("WORKSPACE");
  const [generating, setGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const selectedScreen = useMemo(() => {
    if (!result) return null;
    return (
      result.screens.find((screen) => screen.id === selectedScreenId) ??
      result.screens[0] ??
      null
    );
  }, [result, selectedScreenId]);

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    setErrorMessage("");
    try {
      const generated = await generateUiPrototype({
        projectId: project.id,
        projectName: project.name,
        request: request.trim(),
        style,
      });
      setResult(generated);
      setSelectedScreenId(generated.screens[0]?.id ?? "");
      if (generated.structuredFromAi) {
        toast.success("프로젝트 데이터를 바탕으로 UI 화면 시안을 생성했습니다.");
      } else {
        toast.success("AI 응답을 화면 구조로 정리해 시안을 생성했습니다.");
      }
    } catch (error) {
      const message = uiPrototypeErrorMessage(error);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const handleComplete = () => {
    if (!result) return;
    markProjectUiPrototypeCompleted(project.id);
    setCompleted(true);
    toast.success("UI 프로토타입 단계를 완료 처리했습니다.");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-foreground text-xl font-semibold tracking-tight">
            <LayoutTemplate className="size-5" /> UI 프로토타입
          </h2>
          <p className="mt-1 text-[0.82rem] leading-5 text-muted-foreground">
            프로젝트 산출물을 AI가 분석해 대시보드·목록·상세 화면 구조를 제안합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 font-normal">
            <Database className="size-3.5" /> 백엔드 AI 질의 연동
          </Badge>
          {completed ? (
            <Badge
              variant="outline"
              className="gap-1 border-emerald-200 bg-emerald-50 font-normal text-emerald-700"
            >
              <CheckCircle2 className="size-3.5" /> 완료됨
            </Badge>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold tracking-tight">AI 화면 시안 생성</CardTitle>
          <CardDescription className="mt-1 text-[0.82rem] leading-5 text-muted-foreground">
            추가 요청과 화면 스타일을 지정하면 통합 질의응답 API가 현재 프로젝트의
            요구사항·WBS·일정 맥락을 참고해 화면 구조를 생성합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-foreground">추가 요청</span>
              <textarea
                value={request}
                onChange={(event) => setRequest(event.target.value)}
                rows={4}
                maxLength={800}
                placeholder="예: 모바일에서 리스크와 업무 현황을 먼저 보여 주세요."
                className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="block text-right text-xs text-muted-foreground">
                {request.length}/800
              </span>
            </label>
            <div className="space-y-2 text-sm">
              <span className="font-medium text-foreground">디자인 방향</span>
              <Select
                value={style}
                onValueChange={(value) => setStyle(value as UiPrototypeStyle)}
              >
                <SelectTrigger className="h-10 w-full border-teal-200 bg-white text-sm font-medium text-foreground shadow-sm transition-colors hover:border-teal-300 focus:ring-teal-300/40 dark:border-violet-800 dark:bg-zinc-950 dark:hover:border-violet-700 dark:focus:ring-violet-700/40">
                  <SelectValue placeholder="디자인 방향을 선택하세요" />
                </SelectTrigger>
                <SelectContent className="border-teal-100 dark:border-violet-900">
                  {Object.entries(STYLE_LABELS).map(([value, label]) => (
                    <SelectItem
                      key={value}
                      value={value}
                      className="cursor-pointer focus:bg-teal-50 focus:text-teal-900 dark:focus:bg-violet-950/55 dark:focus:text-violet-100"
                    >
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs leading-5 text-muted-foreground">
                생성 결과는 프로젝트별로 브라우저에 저장되어 새로고침 후에도 유지됩니다.
              </p>
            </div>
          </div>

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex justify-end">
            <Button onClick={() => void handleGenerate()} disabled={generating}>
              {generating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : result ? (
                <RefreshCw className="size-4" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {generating
                ? "프로젝트 데이터를 분석하고 있습니다"
                : result
                  ? "AI 시안 재생성"
                  : "AI 화면 시안 생성"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && selectedScreen ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-lg font-semibold tracking-tight">생성된 화면 시안</CardTitle>
                  <Badge variant="secondary">
                    {llmStatusLabel(result.llmStatus)}
                  </Badge>
                  <Badge variant="outline">{STYLE_LABELS[result.style]}</Badge>
                </div>
                <CardDescription className="mt-2 max-w-3xl text-[0.82rem] leading-5">
                  {result.summary}
                </CardDescription>
                <p className="mt-2 text-xs text-muted-foreground">
                  생성 시각 {formatDate(result.generatedAt)}
                  {result.sourceLabels.length > 0
                    ? ` · 참고 산출물 ${result.sourceLabels.length}개`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => downloadUiPrototypeJson(result)}
                >
                  <FileJson className="size-4" /> JSON
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => downloadUiPrototypeSvg(result, selectedScreen)}
                >
                  <Download className="size-4" /> SVG 이미지
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="생성 화면 선택">
              {result.screens.map((screen) => (
                <Button
                  key={screen.id}
                  type="button"
                  size="sm"
                  variant={screen.id === selectedScreen.id ? "default" : "outline"}
                  role="tab"
                  aria-selected={screen.id === selectedScreen.id}
                  onClick={() => setSelectedScreenId(screen.id)}
                >
                  {screen.name}
                </Button>
              ))}
            </div>

            <PrototypeCanvas
              projectName={project.name}
              screen={selectedScreen}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <LayoutTemplate className="size-6" />
            </span>
            <div>
              <p className="text-base font-semibold text-foreground">아직 생성된 화면 시안이 없습니다.</p>
              <p className="mt-1 text-[0.82rem] leading-5 text-muted-foreground">
                위 요청을 확인한 뒤 AI 화면 시안 생성 버튼을 눌러 주세요.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={handleComplete} disabled={completed || !result}>
          <CheckCircle2 className="size-4" />
          {completed ? "완료 처리됨" : "이 단계 완료 처리"}
        </Button>
      </div>
    </div>
  );
}

function PrototypeCanvas({
  projectName,
  screen,
}: {
  projectName: string;
  screen: UiPrototypeScreen;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-muted/30 p-3 sm:p-4">
      <div className="mx-auto min-w-[900px] max-w-[1180px] overflow-hidden rounded-xl border bg-background shadow-sm">
        <div className="grid min-h-[620px] grid-cols-[190px_1fr]">
          <aside className="border-r bg-card p-4">
            <div className="mb-8 flex items-center gap-2 font-semibold text-foreground">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Sparkles className="size-4" />
              </span>
              Pmate AI
            </div>
            <p className="mb-3 text-[10px] font-medium tracking-wider text-muted-foreground">
              WORKSPACE
            </p>
            <nav className="space-y-1">
              {screen.navigation.map((item, index) => (
                <div
                  key={`${item}-${index}`}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                    index === 0
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      index === 0 ? "bg-primary" : "bg-muted-foreground/50"
                    }`}
                  />
                  {item}
                </div>
              ))}
            </nav>
          </aside>

          <section className="min-w-0 bg-muted/20">
            <header className="flex items-center justify-between border-b bg-background px-6 py-4">
              <div>
                <p className="text-xs text-muted-foreground">{projectName}</p>
                <p className="font-semibold text-foreground">{screen.name}</p>
              </div>
              <Button size="sm">{screen.primaryAction}</Button>
            </header>

            <div className="space-y-5 p-6">
              <div>
                <h3 className="text-xl font-semibold text-foreground">
                  {screen.headline}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {screen.purpose}
                </p>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {screen.kpis.slice(0, 4).map((kpi, index) => (
                  <div key={`${kpi.label}-${index}`} className="rounded-xl border bg-card p-4">
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {kpi.value}
                    </p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {kpi.helper}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {screen.sections.slice(0, 4).map((section, index) => (
                  <div key={`${section.title}-${index}`} className="rounded-xl border bg-card p-5">
                    <h4 className="font-semibold text-foreground">{section.title}</h4>
                    <div className="mt-4 space-y-3">
                      {section.items.slice(0, 5).map((item, itemIndex) => (
                        <div
                          key={`${item}-${itemIndex}`}
                          className="flex items-start gap-2 text-sm text-muted-foreground"
                        >
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
