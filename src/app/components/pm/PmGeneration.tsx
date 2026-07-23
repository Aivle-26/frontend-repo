import { useState } from "react";
import {
  Bot,
  Sparkles,
  Wand2,
  ArrowRight,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Figma,
  Presentation,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Checkbox } from "@/app/components/ui/checkbox";
import { cn } from "@/app/components/ui/utils";
import { projectRepository } from "@/app/api/projectRepository";
import type { FileKind, ProjectSummary } from "@/app/data/demoData";

const KIND_ICON: Record<FileKind, typeof FileText> = {
  pdf: FileText,
  word: FileText,
  excel: FileSpreadsheet,
  ppt: Presentation,
  image: ImageIcon,
  figma: Figma,
};

const KIND_STYLE: Record<FileKind, string> = {
  pdf: "bg-red-50 text-red-600",
  word: "bg-blue-50 text-blue-600",
  excel: "bg-emerald-50 text-emerald-600",
  ppt: "bg-orange-50 text-orange-600",
  image: "bg-purple-50 text-purple-600",
  figma: "bg-pink-50 text-pink-600",
};

export function PmGeneration({
  project,
  onOpenDocuments,
}: {
  project: ProjectSummary;
  onOpenDocuments?: () => void;
}) {
  const { artifacts } = projectRepository.getPmDocuments();
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(artifacts.map((a) => [a.id, true])),
  );
  const [generated, setGenerated] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const selectedIds = artifacts.filter((a) => selected[a.id]).map((a) => a.id);
  const allSelected = selectedIds.length === artifacts.length;

  const toggle = (id: string) =>
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleAll = () => {
    const next = !allSelected;
    setSelected(Object.fromEntries(artifacts.map((a) => [a.id, next])));
  };

  const generate = async () => {
    if (selectedIds.length === 0) return toast.error("생성할 산출물을 선택하세요.");
    setBusy(true);
    await projectRepository.reanalyzeRfp();
    setGenerated(selectedIds);
    setBusy(false);
    toast.success(`선택한 ${selectedIds.length}개 산출물을 생성했어요.`);
  };

  const generatedArtifacts = artifacts.filter((a) => generated.includes(a.id));

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <Card className="border-blue-100 bg-blue-50/40">
        <CardContent className="pt-6 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Bot className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="text-foreground">Planning Agent</span>
              <Badge variant="secondary" className="font-normal">
                {project.name}
              </Badge>
            </div>
            <div className="text-muted-foreground text-xs mt-0.5">
              초기 문서 분석을 바탕으로, 생성할 산출물을 선택하고 생성하세요.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 산출물 선택 */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>생성할 산출물 선택</CardTitle>
            <CardDescription>
              필요한 산출물만 골라 생성할 수 있어요. 현재 {selectedIds.length}개 선택됨.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={toggleAll}>
            {allSelected ? "전체 해제" : "전체 선택"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {artifacts.map((a) => {
              const Icon = KIND_ICON[a.kind];
              const on = !!selected[a.id];
              return (
                <button
                  key={a.id}
                  onClick={() => toggle(a.id)}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors",
                    on
                      ? "border-blue-300 bg-blue-50/50"
                      : "border-border bg-card hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={cn(
                        "flex size-9 items-center justify-center rounded-md",
                        KIND_STYLE[a.kind],
                      )}
                    >
                      <Icon className="size-5" />
                    </div>
                    <Checkbox checked={on} className="pointer-events-none" />
                  </div>
                  <div className="text-foreground text-sm leading-tight">{a.title}</div>
                  <span className="text-muted-foreground text-xs">{a.meta}</span>
                </button>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button onClick={generate} disabled={busy || selectedIds.length === 0}>
              <Wand2 className="size-4" />
              {busy ? "생성 중…" : `선택한 ${selectedIds.length}개 생성`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 생성 결과 */}
      {generatedArtifacts.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-blue-600" /> 생성 완료
              </CardTitle>
              <CardDescription>
                {generatedArtifacts.length}개 산출물이 생성돼 문서함에 저장됐어요.
              </CardDescription>
            </div>
            {onOpenDocuments && (
              <Button variant="ghost" size="sm" onClick={onOpenDocuments}>
                문서함에서 보기 <ArrowRight className="size-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {generatedArtifacts.map((a) => {
                const Icon = KIND_ICON[a.kind];
                return (
                  <div
                    key={a.id}
                    className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className={cn(
                          "flex size-9 items-center justify-center rounded-md",
                          KIND_STYLE[a.kind],
                        )}
                      >
                        <Icon className="size-5" />
                      </div>
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    </div>
                    <div className="text-foreground text-sm leading-tight">{a.title}</div>
                    <div className="mt-auto flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">{a.meta}</span>
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 font-normal text-emerald-700"
                      >
                        생성 완료
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
