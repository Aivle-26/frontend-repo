import { useCallback, useState } from "react";
import { ShieldCheck, ScanLine, Ban, CheckCircle2, Lightbulb, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { Label } from "@/app/components/ui/label";
import { cn } from "@/app/components/ui/utils";
import { getAccessToken } from "@/app/api/authToken";
import {
  securityCheckApi,
  detectionLabel,
  detectionTone,
  riskLevelLabel,
  riskLevelTone,
  type SecurityCheckResult,
} from "@/app/api/securityCheckApi";

interface SecurityCheckCardProps {
  projectId: string;
}

export function SecurityCheckCard({ projectId }: SecurityCheckCardProps) {
  const [artifactName, setArtifactName] = useState("");
  const [artifactType, setArtifactType] = useState("");
  const [textContent, setTextContent] = useState("");
  const [result, setResult] = useState<SecurityCheckResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCheck = useCallback(async () => {
    if (!textContent.trim()) {
      toast.error("검사할 산출물 본문을 입력하세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await securityCheckApi.check(
        projectId,
        1,
        { artifactName: artifactName || "산출물", artifactType: artifactType || "기타", textContent },
        getAccessToken(),
      );
      setResult(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "보안 검사에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [artifactName, artifactType, textContent, projectId]);

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="size-4 text-emerald-600" />
          <span className="text-foreground">산출물 보안검사</span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* 입력 */}
          <div className="rounded-lg border border-border p-4">
            <p className="mb-3 text-muted-foreground text-xs">검사할 산출물</p>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <Label className="text-muted-foreground text-xs">산출물명</Label>
                <Input
                  className="mt-1"
                  placeholder="예: 결제연동_설계서.md"
                  value={artifactName}
                  onChange={(e) => setArtifactName(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">유형</Label>
                <Input
                  className="mt-1"
                  placeholder="예: 설계서"
                  value={artifactType}
                  onChange={(e) => setArtifactType(e.target.value)}
                />
              </div>
            </div>
            <Label className="text-muted-foreground text-xs">본문</Label>
            <Textarea
              className="mt-1 min-h-[140px] font-mono text-xs"
              placeholder="검사할 산출물 텍스트를 붙여넣으세요."
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
            />
            <Button className="mt-3 w-full" onClick={() => void handleCheck()} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <ScanLine className="size-4" />}
              검사하기
            </Button>
          </div>

          {/* 결과 */}
          <div className="rounded-lg border border-border p-4">
            <p className="mb-3 text-muted-foreground text-xs">검사 결과</p>
            {result ? (
              <ResultView result={result} />
            ) : (
              <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 text-center">
                <ShieldCheck className="size-6 text-muted-foreground" />
                <p className="text-muted-foreground text-sm">
                  본문을 넣고 검사하기를 누르면 탐지·마스킹 결과가 표시됩니다.
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ResultView({ result }: { result: SecurityCheckResult }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span
            className={cn(
              "text-4xl font-medium leading-none",
              result.securityRiskScore >= 65 ? "text-red-600" : "text-foreground",
            )}
          >
            {result.securityRiskScore}
          </span>
          <span className="text-muted-foreground text-sm">/ 100</span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="outline" className={cn("font-normal", riskLevelTone(result.securityRiskLevel))}>
            {riskLevelLabel(result.securityRiskLevel)}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "font-normal",
              result.registrationAllowed
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-red-50 text-red-700 border-red-200",
            )}
          >
            {result.registrationAllowed ? (
              <>
                <CheckCircle2 className="mr-1 size-3" /> 등록 허용
              </>
            ) : (
              <>
                <Ban className="mr-1 size-3" /> 등록 차단
              </>
            )}
          </Badge>
        </div>
      </div>

      {result.detections.length > 0 && (
        <div>
          <p className="mb-1.5 text-sm text-foreground">탐지 항목 {result.detections.length}건</p>
          <div className="flex flex-wrap gap-1.5">
            {result.detections.map((d) => (
              <Badge
                key={d.detectionType}
                variant="outline"
                className={cn("font-normal", detectionTone(d.detectionType))}
              >
                {detectionLabel(d.detectionType)} ×{d.count}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-sm text-foreground">마스킹된 본문</p>
        <div className="max-h-40 overflow-auto rounded-lg border border-border bg-muted/30 px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
          {result.maskedContent}
        </div>
      </div>

      {result.recommendations.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2.5 dark:bg-blue-950/30">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-blue-600" />
          <div>
            <p className="text-muted-foreground text-xs">권고 조치</p>
            <ul className="mt-0.5 space-y-0.5">
              {result.recommendations.map((r) => (
                <li key={r} className="text-foreground text-sm leading-snug">
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
