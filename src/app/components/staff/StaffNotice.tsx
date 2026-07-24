import { useMemo, useState } from "react";
import {
  Megaphone,
  Eye,
  AlertTriangle,
  Clock,
  Pin,
  ChevronRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/app/components/ui/dialog";
import {
  projectRepository,
  type Notice,
  type NoticeCategory,
} from "@/app/api/projectRepository";
import { CountUp } from "@/app/components/common/CountUp";

const FILTERS: (NoticeCategory | "전체")[] = [
  "전체",
  "PM 피드백",
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

interface StaffNoticeProps {
  /** 이 화면에서 숨길 공지 카테고리. 예: PM 화면에서는 PM 피드백을 숨김. */
  excludeCategories?: NoticeCategory[];
}

export function StaffNotice({ excludeCategories = [] }: StaffNoticeProps) {
  const { notices: allNotices } = projectRepository.getStaffNotices();
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

  const unreadCount = notices.filter((n) => !readIds.has(n.id)).length;
  const importantCount = notices.filter((n) => n.priority === "높음").length;
  const thisWeekCount = notices.filter((n) => n.date >= THIS_WEEK_FROM).length;

  const list = useMemo(
    () =>
      filter === "전체"
        ? notices
        : notices.filter((n) => n.category === filter),
    [notices, filter],
  );

  const openNotice = (n: Notice) => {
    setSelected(n);
    setReadIds((prev) => new Set(prev).add(n.id));
  };

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard icon={<Megaphone className="size-4" />} label="전체 공지" value={notices.length} />
        <KpiCard icon={<Eye className="size-4 text-destructive" />} label="읽지 않음" value={unreadCount} />
        <KpiCard icon={<AlertTriangle className="size-4" />} label="중요 공지" value={importantCount} />
        <KpiCard icon={<Clock className="size-4" />} label="이번 주 신규" value={thisWeekCount} />
      </div>

      {/* 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="size-4" /> 공지 목록
          </CardTitle>
          <CardDescription>
            공지를 클릭하면 상세 내용을 확인할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <div className="space-y-3">
            {list.map((n) => (
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
            {list.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-10">
                해당 카테고리의 공지가 없습니다.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

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
              <DialogFooter>
                <Button onClick={() => setSelected(null)}>확인</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
}

function KpiCard({ icon, label, value }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">{label}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <div className="mt-2 text-foreground text-2xl">
          <CountUp value={`${value}건`} />
        </div>
      </CardContent>
    </Card>
  );
}