import { useCallback, useEffect, useMemo, useState } from "react";
import { Hash, Lock, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Checkbox } from "@/app/components/ui/checkbox";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/app/components/ui/utils";
import {
  slackChannelApi,
  type SlackChannelCandidate,
} from "@/app/api/slackChannelApi";
import { loadAuthSession } from "@/app/auth/authSession";

function currentAccessToken(): string | null {
  return loadAuthSession()?.accessToken ?? null;
}

interface SlackChannelPickerProps {
  projectId: string;
  /** 저장이 끝나면(연결 1개 이상) 부모에게 알린다. 카드가 분석 단계로 넘어갈 때 사용. */
  onSaved: () => void;
}

/**
 * 프로젝트에 분석할 Slack 채널을 고르는 화면.
 *
 * 봇이 참여한 채널만 선택 가능하다. 미참여 채널은 회색으로 두고 "봇 초대 필요"를
 * 안내한다. 선택과 분석은 분리돼 있어, 여기서는 저장만 하고 분석은 카드가 맡는다.
 */
export function SlackChannelPicker({ projectId, onSaved }: SlackChannelPickerProps) {
  const [candidates, setCandidates] = useState<SlackChannelCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await slackChannelApi.candidates(projectId, currentAccessToken());
      setCandidates(list);
      // 이미 연결된 채널은 기본 선택 상태로 둔다.
      setSelected(new Set(list.filter((c) => c.alreadyLinked).map((c) => c.channelId)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "채널 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectableCount = useMemo(
    () => candidates.filter((c) => c.botJoined).length,
    [candidates],
  );

  const toggle = (channelId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) next.delete(channelId);
      else next.add(channelId);
      return next;
    });
  };

  const handleSave = useCallback(async () => {
    const token = currentAccessToken();
    // 새로 선택된 것만 등록, 해제된 것만 삭제 — 백엔드는 채널 하나씩 받는다.
    const toAdd = candidates.filter(
      (c) => selected.has(c.channelId) && !c.alreadyLinked,
    );
    const toRemove = candidates.filter(
      (c) => !selected.has(c.channelId) && c.alreadyLinked,
    );

    if (toAdd.length === 0 && toRemove.length === 0) {
      toast.info("변경된 채널이 없습니다.");
      return;
    }

    setSaving(true);
    try {
      for (const c of toAdd) {
        await slackChannelApi.register(projectId, c.channelId, token);
      }
      for (const c of toRemove) {
        await slackChannelApi.unregister(projectId, c.channelId, token);
      }
      toast.success("분석 채널을 저장했습니다.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "채널 저장에 실패했습니다.");
      // 부분 저장됐을 수 있으니 최신 상태로 다시 읽는다.
      await load();
    } finally {
      setSaving(false);
    }
  }, [candidates, selected, projectId, onSaved, load]);

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Info className="size-5 text-red-500" />
        <p className="text-muted-foreground text-sm">{error}</p>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        이 프로젝트의 커뮤니케이션을 분석할 Slack 채널을 선택하세요.
        {selectableCount === 0 && " 봇이 참여한 채널이 없습니다."}
      </p>

      <div className="divide-y divide-border rounded-lg border border-border">
        {candidates.map((c) => {
          const disabled = !c.botJoined;
          const checked = selected.has(c.channelId);
          return (
            <label
              key={c.channelId}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5",
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
              )}
            >
              <Checkbox
                checked={checked}
                disabled={disabled}
                onCheckedChange={() => !disabled && toggle(c.channelId)}
              />
              <span className="flex items-center gap-1.5 text-foreground text-sm">
                {c.isPrivate ? (
                  <Lock className="size-3.5 text-muted-foreground" />
                ) : (
                  <Hash className="size-3.5 text-muted-foreground" />
                )}
                {c.channelName}
              </span>
              {disabled && (
                <Badge
                  variant="outline"
                  className="ml-auto border-dashed font-normal text-muted-foreground text-xs"
                >
                  봇 초대 필요
                </Badge>
              )}
            </label>
          );
        })}
        {candidates.length === 0 && (
          <p className="px-3 py-6 text-center text-muted-foreground text-sm">
            워크스페이스에서 채널을 찾을 수 없습니다.
          </p>
        )}
      </div>

      {candidates.some((c) => !c.botJoined) && (
        <p className="flex items-start gap-1.5 text-muted-foreground text-xs">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          회색 채널은 봇이 참여하지 않아 분석할 수 없습니다. Slack에서 해당 채널에
          <code className="mx-1 rounded bg-muted px-1">/invite</code>로 봇을 초대하세요.
        </p>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          채널 저장
        </Button>
      </div>
    </div>
  );
}
