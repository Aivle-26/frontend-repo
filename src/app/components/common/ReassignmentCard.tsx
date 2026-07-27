import { useCallback, useState } from "react";
import {
  Users,
  Wand2,
  Star,
  ListChecks,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { cn } from "@/app/components/ui/utils";
import { getAccessToken } from "@/app/api/authToken";
import {
  reassignmentApi,
  riskLevelLabel,
  riskLevelTone,
  type ReassignmentResult,
  type CandidateResult,
} from "@/app/api/reassignmentApi";

interface ReassignmentCardProps {
  projectId: string;
}

export function ReassignmentCard({ projectId }: ReassignmentCardProps) {
  const [assignmentId, setAssignmentId] = useState(101);
  const [result, setResult] = useState<ReassignmentResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRecommend = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reassignmentApi.recommend(projectId, assignmentId, getAccessToken());
      setResult(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "재배정 추천에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [projectId, assignmentId]);

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-4 flex items-center gap-2">
          <Users className="size-4 text-indigo-600" />
          <span className="text-foreground">담당자 재배정 추천</span>
        </div>

        <div className="mb-4 flex items-end gap-2">
          <div className="w-32">
            <Label className="text-muted-foreground text-xs">업무 ID</Label>
            <Input
              type="number"
              min={1}
              className="mt-1"
              value={assignmentId}
              onChange={(e) => setAssignmentId(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <Button onClick={() => void handleRecommend()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            추천받기
          </Button>
          <p className="text-muted-foreground pb-2 text-xs">
            현재 담당자·후보는 프로젝트 팀원 데이터에서 불러옵니다.
          </p>
        </div>

        {result ? (
          <ResultView result={result} />
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Users className="size-6 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">
              업무를 선택하고 추천받기를 누르면 재배정 필요 여부와 추천 담당자가 표시됩니다.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResultView({ result }: { result: ReassignmentResult }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm">재배정 판정</span>
        <Badge
          variant="outline"
          className={cn(
            "font-normal",
            result.reassignmentRequired
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200",
          )}
        >
          {result.reassignmentRequired ? "재배정 권장" : "재배정 불필요"}
        </Badge>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
        <span className="text-muted-foreground text-sm">현재 담당자 리스크</span>
        <Badge variant="outline" className={cn("font-normal", riskLevelTone(result.currentAssigneeRiskLevel))}>
          {riskLevelLabel(result.currentAssigneeRiskLevel)} · {result.currentAssigneeRiskScore}
        </Badge>
      </div>

      {result.recommendedAssignee && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-sm text-foreground">
            <Star className="size-4 text-amber-500" />
            추천 담당자
          </p>
          <RecommendedCard candidate={result.recommendedAssignee} />
        </div>
      )}

      {result.alternativeCandidates.length > 0 && (
        <div>
          <p className="mb-1 text-muted-foreground text-xs">대안 후보</p>
          <div className="divide-y divide-border rounded-lg border border-border">
            {result.alternativeCandidates.map((c) => (
              <div key={c.memberId} className="flex items-center justify-between px-3 py-2">
                <span className="text-foreground text-sm">{c.memberName}</span>
                <span className="text-muted-foreground text-xs">
                  적합도 {c.matchScore} · 스킬 {Math.round(c.skillMatchRate)}% · 업무량 {Math.round(c.workloadRate)}% · 지연 {c.overdueTaskCount}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.reasons.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-sm text-foreground">
            <ListChecks className="size-4 text-blue-600" />
            판단 근거
          </p>
          <ul className="space-y-1">
            {result.reasons.map((r) => (
              <li key={r} className="text-muted-foreground text-sm leading-snug">
                · {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RecommendedCard({ candidate }: { candidate: CandidateResult }) {
  const initials = candidate.memberName.slice(0, 2);
  return (
    <div className="rounded-xl border-2 border-blue-200 p-3 dark:border-blue-900">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-full bg-blue-50 text-sm font-medium text-blue-700 dark:bg-blue-950">
          {initials}
        </div>
        <div className="flex-1">
          <p className="text-foreground font-medium">{candidate.memberName}</p>
          <p className="text-muted-foreground text-xs">
            적합도 {candidate.matchScore} · 스킬 일치 {Math.round(candidate.skillMatchRate)}%
          </p>
        </div>
        <span className="text-2xl font-medium text-blue-700 dark:text-blue-400">
          {candidate.matchScore}
        </span>
      </div>
      <p className="text-muted-foreground mt-1 text-xs">{candidate.reason}</p>
    </div>
  );
}
