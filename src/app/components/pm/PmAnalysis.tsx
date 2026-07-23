import { useState } from "react";
import { FileText, RefreshCw, AlertTriangle } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { projectRepository } from "@/app/api/projectRepository";
import { projectRequirements, type ProjectSummary } from "@/app/data/demoData";

function priorityVariant(p: string) {
  if (p === "높음") return "destructive" as const;
  if (p === "중간") return "secondary" as const;
  return "outline" as const;
}

export function PmAnalysis({ project }: { project: ProjectSummary }) {
  const { risks } = projectRepository.getPmAnalysis();
  const requirements = projectRequirements(project);
  const [selectedId, setSelectedId] = useState<number | null>(requirements[0].id);

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {/* File info */}
        <Card>
          <CardContent className="pt-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-md bg-muted">
                <FileText className="size-5 text-muted-foreground" />
              </div>
              <div className="leading-tight">
                <div className="text-foreground">사내-협업툴-개발-rfp-2026.pdf</div>
                <div className="text-muted-foreground text-xs">
                  4.2MB · 24개 요구사항 추출 완료
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await projectRepository.uploadRfp();
                  toast("공고문 업로드 흐름을 다시 시작했습니다.");
                }}
              >
                다시 업로드
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  await projectRepository.reanalyzeRfp();
                  toast.success("AI 재분석을 시작했습니다.");
                }}
              >
                <RefreshCw className="size-4" /> 다시 분석
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Requirements table */}
        <Card>
          <CardHeader>
            <CardTitle>AI 추출 요구사항</CardTitle>
            <CardDescription>공고문에서 AI가 추출한 요구사항입니다. 업무 배정은 사이드바의 &lsquo;업무 배정&rsquo; 메뉴에서 진행하세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>요구사항</TableHead>
                  <TableHead className="w-20">분류</TableHead>
                  <TableHead className="w-20">우선순위</TableHead>
                  <TableHead className="w-16">난이도</TableHead>
                  <TableHead className="w-24">추천 담당자</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requirements.map((r) => (
                  <TableRow
                    key={r.id}
                    data-state={selectedId === r.id ? "selected" : undefined}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(r.id)}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedId === r.id}
                        onCheckedChange={() => setSelectedId(r.id)}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.id}</TableCell>
                    <TableCell>{r.text}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={priorityVariant(r.priority)}>{r.priority}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.difficulty}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.recommendedOwner}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Risk cards */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="size-4 text-destructive" />
            <span className="text-foreground">AI 리스크 분석</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {risks.map((risk) => (
              <Card key={risk.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{risk.title}</CardTitle>
                    <Badge
                      variant={risk.level === "높음" ? "destructive" : "secondary"}
                    >
                      {risk.level}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">{risk.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
