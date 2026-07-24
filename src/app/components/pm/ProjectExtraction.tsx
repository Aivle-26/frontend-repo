import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Info,
} from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import type { ProjectSummary } from "@/app/data/demoData";

interface ProjectExtractionProps {
  project: ProjectSummary;
  onBack: () => void;
}

export function ProjectExtraction({
  project,
  onBack,
}: ProjectExtractionProps) {
  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
        <ArrowLeft className="size-4" /> 프로젝트 목록
      </Button>

      <div className="leading-tight">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <CheckCircle2 className="size-4" />
          </span>
          <h2 className="text-lg text-foreground">
            {project.name} · 문서 업로드 완료
          </h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          프로젝트와 원본 문서가 등록되었습니다.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            등록된 원본 문서 {project.docs.length}건
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {project.docs.map((document, index) => (
              <span
                key={`${document.name}-${index}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-sm"
              >
                <FileText className="size-3.5 text-muted-foreground" />
                {document.name}
                <Badge variant="secondary" className="font-normal">
                  {document.type}
                </Badge>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-900">
        <Info className="mt-0.5 size-5 shrink-0" />
        <div>
          <div className="font-medium">AI 요구사항 추출은 아직 연결되지 않았습니다.</div>
          <p className="mt-1 text-sm text-blue-800">
            현재 화면에서는 예시 요구사항을 실제 분석 결과처럼 표시하지
            않습니다. AI 서버 연동 후 실제 분석 결과를 이 단계에 연결할
            예정입니다.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onBack}>프로젝트 목록으로 돌아가기</Button>
      </div>
    </div>
  );
}
