import { useState } from "react";
import { LayoutTemplate, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import type { ProjectSummary } from "@/app/projects/projectTypes";
import {
  isProjectUiPrototypeCompleted,
  markProjectUiPrototypeCompleted,
} from "@/app/projects/projectProgress";

/**
 * [UI 프로토타입] — 계획 단계의 마지막 스텝(예산 다음).
 *
 * 아직 이 단계를 실제로 만들어주는 AI 백엔드가 없어서, "생성" 버튼은 예시용
 * 화면만 보여준다. "완료 처리"는 예산 완료 추적과 동일한 방식(localStorage)으로
 * 기록하고, 그 값을 [프로젝트] 탭의 "대시보드 열기" 활성화 조건에도 같이 쓴다.
 */
export function PmUiPrototype({ project }: { project: ProjectSummary }) {
  const [completed, setCompleted] = useState(() => isProjectUiPrototypeCompleted(project.id));
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerated(true);
      setGenerating(false);
      toast.success("예시 화면을 만들었어요. (실제 AI 생성 기능은 아직 준비 중이에요)");
    }, 600);
  };

  const handleComplete = () => {
    markProjectUiPrototypeCompleted(project.id);
    setCompleted(true);
    toast.success("UI 프로토타입 단계를 완료 처리했어요. 이제 대시보드를 열 수 있어요.");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-foreground text-lg">
            <LayoutTemplate className="size-5" /> UI 프로토타입
          </h2>
          <p className="text-muted-foreground text-sm">
            요구사항·WBS를 바탕으로 화면 시안을 만들고 확인하는 단계예요.
          </p>
        </div>
        {completed && (
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50 font-normal text-emerald-700"
          >
            <CheckCircle2 className="size-3.5" /> 완료됨
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>화면 시안 생성</CardTitle>
          <CardDescription>
            아직 실제 AI 생성 기능은 준비 중이에요. 지금은 예시로만 확인할 수 있어요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!generated ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 py-12 text-center">
              <LayoutTemplate className="size-8 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">
                아직 생성된 화면 시안이 없습니다.
              </p>
              <Button onClick={handleGenerate} disabled={generating}>
                <Sparkles className="size-4" />
                {generating ? "생성 중…" : "AI 화면 시안 생성"}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {["대시보드", "목록 화면", "상세 화면"].map((name) => (
                <div
                  key={name}
                  className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-lg border border-border bg-muted/30 text-muted-foreground text-sm"
                >
                  <LayoutTemplate className="size-6" />
                  {name} (예시)
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleComplete} disabled={completed}>
          <CheckCircle2 className="size-4" />
          {completed ? "완료 처리됨" : "이 단계 완료 처리"}
        </Button>
      </div>
    </div>
  );
}