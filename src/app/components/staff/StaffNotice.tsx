import { useMemo, useState } from "react";
import {
  Megaphone,
  Eye,
  AlertTriangle,
  Clock,
  Pin,
  ChevronRight,
  Plus,
  MessageSquareText,
  CalendarCheck2,
} from "lucide-react";
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
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { Label } from "@/app/components/ui/label";
import { Switch } from "@/app/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/app/components/ui/dialog";
import type { Notice, NoticeCategory } from "@/app/data/demoData";
import { addNotice, useNotices } from "@/app/state/noticeStore";
import { PmFeedbackChat } from "@/app/components/staff/PmFeedbackChat";
import { type Priority } from "@/app/data/demoData";
import { CountUp } from "@/app/components/common/CountUp";
import { cn } from "@/app/components/ui/utils";

const FILTERS: (NoticeCategory | "전체")[] = [
  "전체",
  "마감 안내",
  "시스템 공지",
  "업데이트",
];

function priorityVariant(p: string) {
  if (p === "높음") return "destructive" as const;
  if (p === "중간") return "secondary" as const;
  return "outline" as const;
}

const THIS_WEEK_FROM = "2026-07-18";

const CREATE_CATEGORIES: NoticeCategory[] = [
  "시스템 공지",
  "마감 안내",
  "업데이트",
  "PM 피드백",
  "위클리 스크럼",
];
const PRIORITIES: Priority[] = ["높음", "중간", "낮음"];

function todayStr(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

interface StaffNoticeProps {
  /** 이 화면에서 숨길 공지 카테고리. 예: PM 화면에서는 PM 피드백을 숨김. */
  excludeCategories?: NoticeCategory[];
  /** PM 등 공지 작성 권한이 있는 화면에서 true. 등록 버튼이 표시됩니다. */
  canCreate?: boolean;
  /** 등록 시 기록할 작성자명. */
  authorName?: string;
  /**
   * "full": 독립 공지 화면(KPI·필터·전체 목록).
   * "compact": 다른 화면(예: 프로젝트 페이지 상단)에 끼워 넣는 요약 패널.
   */
  variant?: "full" | "compact";
  /** compact 변형에서 노출할 공지 개수. */
  limit?: number;
  /** PM 피드백 채팅에서 "나"로 표시할 로그인 사용자 이름. */
  currentUserName?: string;
}

export function StaffNotice({
  excludeCategories = [],
  canCreate = false,
  authorName = "PM",
  variant = "full",
  limit = 4,
  currentUserName = "나",
}: StaffNoticeProps) {
  const isCompact = variant === "compact";
  const allNotices = useNotices();
  const notices = useMemo(
    () => allNotices.filter((n) => !excludeCategories.includes(n.category)),
    [allNotices, excludeCategories],
  );
  const filters = useMemo(
    () => FILTERS.filter((f) => f === "전체" || !excludeCategories.includes(f)),
    [excludeCategories],
  );
  const [filter, setFilter] = useState<NoticeCategory | "전체">("전체");
  const [selected, setSelected] = useState<Notice | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  // 등록 폼
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    category: "시스템 공지" as NoticeCategory,
    priority: "중간" as Priority,
    title: "",
    summary: "",
    content: "",
    pinned: false,
  });

  const resetForm = () =>
    setForm({
      category: "시스템 공지",
      priority: "중간",
      title: "",
      summary: "",
      content: "",
      pinned: false,
    });

  const submitNotice = () => {
    if (!form.title.trim()) {
      toast.error("제목을 입력하세요.");
      return;
    }
    const content = form.content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    addNotice({
      category: form.category,
      priority: form.priority,
      pinned: form.pinned,
      title: form.title.trim(),
      author: authorName,
      date: todayStr(),
      summary: form.summary.trim() || form.title.trim(),
      content: content.length > 0 ? content : [form.summary.trim() || form.title.trim()],
    });

    setCreateOpen(false);
    resetForm();
    toast.success(
      form.category === "PM 피드백"
        ? "PM 피드백을 등록해 직원에게 전달했어요."
        : form.category === "위클리 스크럼"
          ? "위클리 스크럼 제출 요청을 등록했어요."
          : "공지를 등록했어요.",
    );
  };

  const unreadCount = notices.filter((n) => !readIds.has(n.id)).length;
  const importantCount = notices.filter((n) => n.priority === "높음").length;
  const thisWeekCount = notices.filter((n) => n.date >= THIS_WEEK_FROM).length;

  const list = useMemo(() => {
    if (filter === "전체") {
      const sorted = [...notices].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
      });
      return sorted.slice(0, 3);
    }
    return notices.filter((n) => n.category === filter);
  }, [notices, filter]);

  // compact: 고정 공지 우선 → 최신순 → limit 개
  const compactList = useMemo(() => {
    const sorted = [...notices].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    });
    return sorted.slice(0, limit);
  }, [notices, limit]);

  const displayList = isCompact ? compactList : list;

  const openNotice = (n: Notice) => {
    setSelected(n);
    setReadIds((prev) => new Set(prev).add(n.id));
  };

  return (
    <div className={isCompact ? "" : "space-y-6"}>
      {/* KPI (full 전용) */}
      {!isCompact && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard icon={<Megaphone className="size-4" />} label="전체 공지" value={notices.length} tone="blue" />
          <KpiCard icon={<Eye className="size-4" />} label="읽지 않음" value={unreadCount} tone="red" />
          <KpiCard icon={<AlertTriangle className="size-4" />} label="중요 공지" value={importantCount} tone="amber" />
          <KpiCard icon={<Clock className="size-4" />} label="이번 주 신규" value={thisWeekCount} tone="violet" />
        </div>
      )}

      {/* 목록 */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="size-4" /> 공지사항
              {isCompact && unreadCount > 0 && (
                <Badge variant="destructive" className="ml-1">
                  읽지 않음 {unreadCount}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {isCompact
                ? "최근 공지입니다. 클릭하면 상세 내용을 확인할 수 있습니다."
                : "공지를 클릭하면 상세 내용을 확인할 수 있습니다."}
            </CardDescription>
          </div>
          {canCreate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> 공지 등록
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!isCompact && (
            <div className="flex flex-wrap gap-2">
              {filters.map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? "default" : "outline"}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </Button>
              ))}
            </div>
          )}

          <div className="space-y-3">
            {displayList.map((n) => (
              <button
                key={n.id}
                onClick={() => openNotice(n)}
                className="w-full rounded-lg border border-border p-4 text-left transition-shadow hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      {n.pinned && (
                        <Pin className="size-3.5 fill-primary text-primary shrink-0" />
                      )}
                      <Badge variant="outline">{n.category}</Badge>
                      <Badge variant={priorityVariant(n.priority)}>{n.priority}</Badge>
                      {!readIds.has(n.id) && (
                        <span className="size-1.5 rounded-full bg-primary" aria-label="읽지 않음" />
                      )}
                    </div>
                    <p className="text-foreground text-sm truncate">{n.title}</p>
                    <p className="text-muted-foreground text-sm mt-1 truncate">{n.summary}</p>
                    <div className="flex items-center gap-2 mt-2 text-muted-foreground text-xs">
                      <span>{n.author}</span>
                      <span>·</span>
                      <span>{n.date}</span>
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-1" />
                </div>
              </button>
            ))}
            {displayList.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-10">
                {isCompact ? "등록된 공지가 없습니다." : "해당 카테고리의 공지가 없습니다."}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* PM 피드백 | 위클리 스크럼 관련 PM 요청 */}
      {!isCompact && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquareText className="size-4" /> PM 피드백
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {notices
                .filter((n) => n.category === "PM 피드백")
                .slice(0, 3)
                .map((n) => (
                  <button
                    key={n.id}
                    onClick={() => openNotice(n)}
                    className="block w-full rounded-md border border-border p-3 text-left hover:bg-muted/50"
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-border/60 pb-1.5">
                      <span className="text-foreground text-sm">{n.title}</span>
                      <span className="shrink-0 text-muted-foreground text-xs">{n.date}</span>
                    </div>
                    <p className="line-clamp-1 text-muted-foreground text-xs">{n.summary}</p>
                  </button>
                ))}
              {notices.filter((n) => n.category === "PM 피드백").length === 0 && (
                <p className="py-4 text-center text-muted-foreground text-sm">
                  아직 PM 피드백이 없습니다.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarCheck2 className="size-4" /> 위클리 스크럼 요청
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {notices
                .filter((n) => n.category === "위클리 스크럼")
                .slice(0, 3)
                .map((n) => (
                  <button
                    key={n.id}
                    onClick={() => openNotice(n)}
                    className="block w-full rounded-md border border-border p-3 text-left hover:bg-muted/50"
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-border/60 pb-1.5">
                      <span className="text-foreground text-sm">{n.title}</span>
                      <span className="shrink-0 text-muted-foreground text-xs">{n.date}</span>
                    </div>
                    <p className="line-clamp-1 text-muted-foreground text-xs">{n.summary}</p>
                  </button>
                ))}
              {notices.filter((n) => n.category === "위클리 스크럼").length === 0 && (
                <p className="py-4 text-center text-muted-foreground text-sm">
                  아직 요청이 없습니다.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 상세 다이얼로그 */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-xl">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline">{selected.category}</Badge>
                  <Badge variant={priorityVariant(selected.priority)}>{selected.priority}</Badge>
                </div>
                <DialogTitle>{selected.title}</DialogTitle>
                <DialogDescription>
                  {selected.author} · {selected.date}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {selected.content.map((p, i) => (
                  <p key={i} className="text-muted-foreground text-sm leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>

              {selected.category === "PM 피드백" && (
                <div className="mt-2 border-t border-border pt-3">
                  <PmFeedbackChat currentUserName={currentUserName} compact />
                </div>
              )}

              <DialogFooter>
                <Button onClick={() => setSelected(null)}>
                  {selected.category === "PM 피드백" ? "닫기" : "확인"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 등록 다이얼로그 (PM 전용) */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>공지 등록</DialogTitle>
            <DialogDescription>
              등록한 공지는 대상자의 공지사항 화면에 표시됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>분류</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, category: v as NoticeCategory }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CREATE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>우선순위</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, priority: v as Priority }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>제목</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="공지 제목을 입력하세요"
              />
            </div>

            <div className="space-y-1.5">
              <Label>요약</Label>
              <Input
                value={form.summary}
                onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                placeholder="목록에 표시될 한 줄 요약 (선택)"
              />
            </div>

            <div className="space-y-1.5">
              <Label>내용</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="상세 내용을 입력하세요. 줄바꿈으로 문단을 나눕니다."
                rows={5}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="notice-pinned"
                checked={form.pinned}
                onCheckedChange={(v) => setForm((f) => ({ ...f, pinned: v }))}
              />
              <Label htmlFor="notice-pinned" className="cursor-pointer">
                목록 상단에 고정
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              취소
            </Button>
            <Button onClick={submitNotice}>등록</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "blue" | "red" | "amber" | "violet";
}

const KPI_TONE_STYLES: Record<
  NonNullable<KpiCardProps["tone"]>,
  { card: string; icon: string }
> = {
  blue: { card: "bg-blue-50/70 border-blue-100", icon: "text-blue-600" },
  red: { card: "bg-red-50/70 border-red-100", icon: "text-red-600" },
  amber: { card: "bg-amber-50/70 border-amber-100", icon: "text-amber-600" },
  violet: { card: "bg-violet-50/70 border-violet-100", icon: "text-violet-600" },
};

function KpiCard({ icon, label, value, tone }: KpiCardProps) {
  const toneStyle = tone ? KPI_TONE_STYLES[tone] : null;
  return (
    <Card className={toneStyle?.card}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">{label}</span>
          <span className={cn("text-muted-foreground", toneStyle?.icon)}>{icon}</span>
        </div>
        <div className="mt-2 text-foreground text-2xl">
          <CountUp value={`${value}건`} />
        </div>
      </CardContent>
    </Card>
  );
}