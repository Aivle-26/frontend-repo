import { useCallback, useState } from "react";
import { UserCog, Activity, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Progress } from "@/app/components/ui/progress";
import { cn } from "@/app/components/ui/utils";
import { getAccessToken } from "@/app/api/authToken";
import {
  memberDelayApi,
  riskLevelLabel,
  riskLevelTone,
  type MemberDelayResult,
  type MemberDelayItem,
} from "@/app/api/memberDelayApi";

interface MemberDelayCardProps {
  projectId: string;
}

export function MemberDelayCard({ projectId }: MemberDelayCardProps) {
  const [result, setResult] = useState<MemberDelayResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    try {
      const res = await memberDelayApi.analyze(projectId, getAccessToken());
      setResult(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "지연 분석에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <UserCog className="size-4 text-violet-600" />
            <span className="text-foreground">팀원별 업무 진행 지연 분석</span>
          </div>
          <Button size="sm" onClick={() => void handleAnalyze()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Activity className="size-4" />}
            분석하기
          </Button>
        </div>

        {result ? (
          <ResultView result={result} />
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <UserCog className="size-6 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">
              분석하기를 누르면 팀원별 지연 위험 점수와 근거가 표시됩니다.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResultView({ result }: { result: MemberDelayResult }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border px-3 py-2.5">
          <span className="text-muted-foreground text-xs">분석 팀원</span>
          <p className="text-foreground">{result.analyzedMemberCount}명</p>
        </div>
        <div className="rounded-lg border border-border px-3 py-2.5">
          <span className="text-muted-foreground text-xs">고위험 팀원</span>
          <p className={cn(result.highRiskMemberCount > 0 && "text-red-600", "text-foreground")}>
            {result.highRiskMemberCount}명
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {result.memberResults.map((m) => (
          <MemberRow key={m.memberId} member={m} />
        ))}
      </div>
    </div>
  );
}

function MemberRow({ member }: { member: MemberDelayItem }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-foreground text-sm font-medium">{member.memberName}</span>
          <Badge variant="outline" className={cn("font-normal", riskLevelTone(member.riskLevel))}>
            {riskLevelLabel(member.riskLevel)}
          </Badge>
        </div>
        <span className="text-muted-foreground text-xs">
          지연점수 {member.delayScore} · 완료 {Math.round(member.completionRate)}% · 지연 {Math.round(member.overdueRate)}%
        </span>
      </div>

      <Progress value={member.delayScore} className="mb-2 h-1.5" />

      {member.reasons.length > 0 && (
        <ul className="mb-1.5 space-y-0.5">
          {member.reasons.map((r) => (
            <li key={r} className="flex items-start gap-1.5 text-muted-foreground text-xs leading-snug">
              <AlertCircle className="mt-0.5 size-3 shrink-0 text-amber-600" />
              {r}
            </li>
          ))}
        </ul>
      )}
      <p className="text-foreground text-xs leading-snug">{member.recommendedAction}</p>
    </div>
  );
}
