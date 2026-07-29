import { useMemo, useState } from "react";
import {
  ClipboardCheck,
  Check,
  X,
  Search,
  Paperclip,
  MessageSquare,
  Eye,
  FileText,
  FileSpreadsheet,
  File as FileIcon,
} from "lucide-react";
import { toast } from "sonner";
import { SecurityCheckCard } from "@/app/components/common/SecurityCheckCard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { cn } from "@/app/components/ui/utils";
import { demoRepository } from "@/app/data/demoRepository";
import type {
  ProjectSummary,
  ReviewState,
  ReviewSubmission,
} from "@/app/data/demoData";

type Filter = "전체" | ReviewState;

function stateClass(s: ReviewState) {
  if (s === "승인") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "반려") return "bg-red-50 text-red-700 border-red-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function getFileExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension || "file";
}

function getFileTypeLabel(fileName: string) {
  const extension = getFileExtension(fileName);

  if (extension === "doc" || extension === "docx") return "WORD";
  if (extension === "xls" || extension === "xlsx") return "EXCEL";
  if (extension === "ppt" || extension === "pptx") return "PPT";
  return extension.toUpperCase();
}

function FileTypeIcon({ fileName }: { fileName: string }) {
  const extension = getFileExtension(fileName);

  if (extension === "xls" || extension === "xlsx") {
    return <FileSpreadsheet className="size-4" />;
  }

  if (
    extension === "pdf" ||
    extension === "doc" ||
    extension === "docx" ||
    extension === "txt"
  ) {
    return <FileText className="size-4" />;
  }

  return <FileIcon className="size-4" />;
}

export function PmReview({ project }: { project: ProjectSummary }) {
  const base = demoRepository.getPmReview();
  const feedback = base.feedback;
  const submissions =
    project.status === "진행중" ? base.submissions : base.submissions.slice(0, 1);
  const [items, setItems] = useState<ReviewSubmission[]>(submissions);
  const [filter, setFilter] = useState<Filter>("전체");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>(submissions[0]?.id ?? "");
  const [memo, setMemo] = useState("");
  const [previewItem, setPreviewItem] = useState<ReviewSubmission | null>(null);

  const counts = useMemo(
    () => ({
      전체: items.length,
      "검토 대기": items.filter((i) => i.state === "검토 대기").length,
      승인: items.filter((i) => i.state === "승인").length,
      반려: items.filter((i) => i.state === "반려").length,
    }),
    [items],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      const matchState = filter === "전체" || i.state === filter;
      const matchQuery =
        !q ||
        i.title.toLowerCase().includes(q) ||
        i.author.toLowerCase().includes(q) ||
        i.relatedReq.toLowerCase().includes(q) ||
        i.attachment.toLowerCase().includes(q);
      return matchState && matchQuery;
    });
  }, [items, filter, query]);

  const selected = items.find((i) => i.id === selectedId) ?? null;

  const setState = async (id: string, state: ReviewState) => {
    await demoRepository.requestReview({ taskId: id });
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, state } : i)));
    toast.success(
      state === "승인"
        ? "산출물을 승인 처리했습니다."
        : "반려하고 수정 요청을 보냈습니다.",
    );
  };

  const sendMemo = async () => {
    if (!selected) return toast.error("검토할 산출물을 선택하세요.");
    if (!memo.trim()) return toast.error("피드백 내용을 입력하세요.");
    await demoRepository.addComment({ taskId: selected.id, text: memo });
    toast.success(`"${selected.title}"에 피드백을 남겼습니다.`);
    setMemo("");
  };

  const openPreview = (item: ReviewSubmission) => {
    setSelectedId(item.id);
    setPreviewItem(item);
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="size-4" /> 산출물 검토
              </CardTitle>
              <CardDescription>
                제출된 산출물을 확인하고 승인 또는 반려할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {(["전체", "검토 대기", "승인", "반려"] as Filter[]).map((f) => (
                  <button
                    type="button"
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors",
                      filter === f
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/70",
                    )}
                  >
                    {f}
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-xs",
                        filter === f ? "bg-white/20" : "bg-background",
                      )}
                    >
                      {counts[f]}
                    </span>
                  </button>
                ))}
                <div className="relative ml-auto">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="제목·담당자 검색"
                    className="h-8 w-44 pl-8"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>산출물</TableHead>
                      <TableHead className="w-20">담당자</TableHead>
                      <TableHead className="w-24">상태</TableHead>
                      <TableHead className="w-24 text-center">파일</TableHead>
                      <TableHead className="w-32 text-right">검토</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((i) => (
                      <TableRow
                        key={i.id}
                        data-state={selectedId === i.id ? "selected" : undefined}
                        className="cursor-pointer"
                        onClick={() => setSelectedId(i.id)}
                      >
                        <TableCell>
                          <div className="text-sm text-foreground">{i.title}</div>
                          <button
                            type="button"
                            className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
                            onClick={(event) => {
                              event.stopPropagation();
                              openPreview(i);
                            }}
                          >
                            <Paperclip className="size-3" />
                            {i.attachment}
                          </button>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {i.author}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn("font-normal", stateClass(i.state))}
                          >
                            {i.state}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 w-full gap-1 px-2"
                            onClick={(event) => {
                              event.stopPropagation();
                              openPreview(i);
                            }}
                          >
                            <Eye className="size-3.5" />
                            미리보기
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-emerald-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                void setState(i.id, "승인");
                              }}
                            >
                              <Check className="size-3.5" /> 승인
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-red-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                void setState(i.id, "반려");
                              }}
                            >
                              <X className="size-3.5" /> 반려
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-8 text-center text-muted-foreground"
                        >
                          해당하는 산출물이 없습니다.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* 산출물 보안검사 (AI 서버 연동) — 검토표 아래, 피드백 위 */}
          <SecurityCheckCard projectId={project.id} />
        </div>

        <div className="space-y-6 xl:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="size-4" /> 검토 피드백
              </CardTitle>
              <CardDescription>선택한 산출물에 피드백을 남깁니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                {selected ? (
                  <>
                    <div className="text-foreground">{selected.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {selected.author} · {selected.submittedAt}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => openPreview(selected)}
                    >
                      <Eye className="size-4" />
                      첨부 파일 미리보기
                    </Button>
                  </>
                ) : (
                  <span className="text-muted-foreground">산출물을 선택하세요.</span>
                )}
              </div>
              <Textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="피드백 내용을 입력하세요."
                rows={4}
              />
              <Button className="w-full" onClick={sendMemo}>
                피드백 전송
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>최근 검토 피드백</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {feedback.map((f) => (
                <div key={f.id} className="rounded-md border border-border p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm text-foreground">{f.author}</span>
                    <span className="text-xs text-muted-foreground">{f.date}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{f.text}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog
        open={previewItem !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewItem(null);
        }}
      >
        <DialogContent
          className="flex flex-col overflow-hidden p-0"
          style={{
            width: "min(1100px, 92vw)",
            height: "82vh",
            minWidth: "min(680px, 90vw)",
            minHeight: "min(520px, 80vh)",
            maxWidth: "95vw",
            maxHeight: "95vh",
            resize: "both",
          }}
        >
          {previewItem && (
            <>
              <DialogHeader className="shrink-0 border-b border-border px-6 py-5 pr-12">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileTypeIcon fileName={previewItem.attachment} />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="truncate text-left">
                      {previewItem.title}
                    </DialogTitle>
                    <DialogDescription className="mt-1 flex flex-wrap items-center gap-2 text-left">
                      <span>{previewItem.attachment}</span>
                      <Badge variant="outline">
                        {getFileTypeLabel(previewItem.attachment)}
                      </Badge>
                      <span>·</span>
                      <span>{previewItem.author}</span>
                      <span>·</span>
                      <span>{previewItem.submittedAt}</span>
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/30">
                <div className="p-6">
                  <SubmissionPreview submission={previewItem} project={project} />
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-background px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  현재 화면은 프론트엔드 확인용 미리보기입니다. 실제 파일 URL 연결 시 원본 내용으로 교체됩니다.
                  <span className="mt-1 block">
                    내용 영역은 마우스 휠로 스크롤하고, 팝업 오른쪽 아래 모서리를 드래그해 크기를 조절할 수 있습니다.
                  </span>
                </p>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="text-red-700"
                    onClick={() => {
                      void setState(previewItem.id, "반려");
                      setPreviewItem(null);
                    }}
                  >
                    <X className="size-4" /> 반려
                  </Button>
                  <Button
                    type="button"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      void setState(previewItem.id, "승인");
                      setPreviewItem(null);
                    }}
                  >
                    <Check className="size-4" /> 승인
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SubmissionPreview({
  submission,
  project,
}: {
  submission: ReviewSubmission;
  project: ProjectSummary;
}) {
  const extension = getFileExtension(submission.attachment);

  if (extension === "xlsx" || extension === "xls") {
    return <SpreadsheetPreview submission={submission} />;
  }

  if (extension === "pdf") {
    return <PdfPreview submission={submission} project={project} />;
  }

  if (extension === "docx" || extension === "doc" || extension === "txt") {
    return <DocumentPreview submission={submission} project={project} />;
  }

  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background text-center">
      <FileIcon className="size-12 text-muted-foreground" />
      <div className="mt-4 font-medium text-foreground">미리보기 준비 중</div>
      <p className="mt-1 text-sm text-muted-foreground">
        이 파일 형식은 원본 파일 서버 연결 후 미리보기를 지원합니다.
      </p>
    </div>
  );
}

function DocumentPreview({
  submission,
  project,
}: {
  submission: ReviewSubmission;
  project: ProjectSummary;
}) {
  return (
    <div className="mx-auto min-h-[650px] max-w-3xl bg-white px-12 py-14 text-slate-800 shadow-sm ring-1 ring-slate-200">
      <div className="border-b border-slate-200 pb-6">
        <div className="text-xs font-semibold tracking-[0.2em] text-blue-600">
          BIDWORKS AI PROJECT DOCUMENT
        </div>
        <h1 className="mt-4 text-3xl font-semibold">{submission.title}</h1>
        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm text-slate-500">
          <span>프로젝트</span>
          <span className="text-slate-700">{project.name}</span>
          <span>작성자</span>
          <span className="text-slate-700">{submission.author}</span>
          <span>관련 요구사항</span>
          <span className="text-slate-700">{submission.relatedReq}</span>
          <span>제출일</span>
          <span className="text-slate-700">{submission.submittedAt}</span>
        </div>
      </div>

      <section className="mt-9">
        <h2 className="text-lg font-semibold">1. 작성 목적</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          본 산출물은 {submission.relatedReq} 기준을 충족하기 위한 세부 이행 방안과
          검토 근거를 정리한 문서입니다. 프로젝트 수행 과정에서 확인된 조건과 담당자
          검토 사항을 반영했습니다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">2. 주요 검토 내용</h2>
        <div className="mt-3 space-y-3 text-sm text-slate-600">
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="font-medium text-slate-800">요구사항 반영 여부</div>
            <p className="mt-1 leading-6">
              관련 RFP 조항과 산출물 내 세부 항목의 연결 관계를 확인했습니다.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="font-medium text-slate-800">검증 및 근거 자료</div>
            <p className="mt-1 leading-6">
              적용 기준, 점검 결과, 담당자 확인 내역을 근거 자료로 포함했습니다.
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="font-medium text-slate-800">추가 조치 사항</div>
            <p className="mt-1 leading-6">
              PM 검토 결과에 따라 보완이 필요한 항목은 다음 버전에 반영합니다.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">3. 결론</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          제출된 내용은 현재 프로젝트 범위와 요구사항을 기준으로 작성되었습니다. 승인
          또는 반려 결과에 따라 후속 업무 상태가 갱신됩니다.
        </p>
      </section>

      <div className="mt-14 border-t border-slate-200 pt-4 text-right text-xs text-slate-400">
        {submission.attachment}
      </div>
    </div>
  );
}

function PdfPreview({
  submission,
  project,
}: {
  submission: ReviewSubmission;
  project: ProjectSummary;
}) {
  return (
    <div className="space-y-3">
      <div className="mx-auto flex max-w-3xl items-center justify-between text-xs text-muted-foreground">
        <span>PDF 미리보기</span>
        <span>1 / 4 페이지</span>
      </div>
      <div className="mx-auto min-h-[650px] max-w-3xl bg-white px-12 py-14 text-slate-800 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-start justify-between border-b-2 border-blue-600 pb-6">
          <div>
            <div className="text-sm font-medium text-blue-600">{project.name}</div>
            <h1 className="mt-3 text-3xl font-bold">{submission.title}</h1>
            <p className="mt-2 text-sm text-slate-500">{submission.relatedReq}</p>
          </div>
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
            PDF
          </div>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4">
          <PreviewStat label="작성자" value={submission.author} />
          <PreviewStat label="제출 일시" value={submission.submittedAt} />
          <PreviewStat label="검토 상태" value={submission.state} />
        </div>

        <section className="mt-10">
          <h2 className="border-l-4 border-blue-600 pl-3 text-lg font-semibold">
            설계 기준 요약
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            주요 설비의 연속 운영과 장애 대응을 위해 이중화 구성 기준을 정의합니다.
            단일 장애점 제거, 자동 절체, 운영 상태 모니터링을 핵심 검토 항목으로
            설정했습니다.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="border-l-4 border-blue-600 pl-3 text-lg font-semibold">
            구성 원칙
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            {["전원 공급 경로 이중화", "장애 발생 시 자동 절체", "주요 상태 실시간 감시", "정기 복구 시험 수행"].map(
              (item, index) => (
                <div key={item} className="rounded-lg border border-slate-200 p-4">
                  <span className="mr-2 font-semibold text-blue-600">0{index + 1}</span>
                  {item}
                </div>
              ),
            )}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="border-l-4 border-blue-600 pl-3 text-lg font-semibold">
            PM 확인 항목
          </h2>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            {["RFP 요구사항과 설계 기준 간 추적성", "장애 시나리오 및 복구 시간 목표", "시험 절차와 승인 기준의 구체성"].map(
              (item) => (
                <div key={item} className="flex gap-3 border-b border-slate-100 pb-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs text-blue-600">
                    ✓
                  </span>
                  <span>{item}</span>
                </div>
              ),
            )}
          </div>
        </section>

        <div className="mt-14 flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-400">
          <span>{submission.attachment}</span>
          <span>BidWorks AI</span>
        </div>
      </div>
    </div>
  );
}

function SpreadsheetPreview({ submission }: { submission: ReviewSubmission }) {
  const rows = [
    ["1", "정기 점검 계획 수립", "최예나", "2026-07-05", "완료"],
    ["2", "주요 설비 상태 확인", "박민수", "2026-07-12", "진행 중"],
    ["3", "예비 부품 재고 점검", "김지훈", "2026-07-18", "예정"],
    ["4", "장애 대응 훈련", "이서연", "2026-07-25", "예정"],
    ["5", "월간 결과 보고", "최예나", "2026-07-31", "예정"],
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-300 bg-emerald-700 px-4 py-3 text-white">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileSpreadsheet className="size-4" />
          {submission.attachment}
        </div>
        <span className="text-xs text-emerald-100">Sheet1</span>
      </div>

      <div className="overflow-x-auto p-4">
        <table className="min-w-[720px] w-full border-collapse text-xs text-slate-700">
          <thead>
            <tr>
              {["No.", "유지보수 항목", "담당자", "예정일", "상태"].map((header) => (
                <th
                  key={header}
                  className="border border-slate-300 bg-slate-100 px-3 py-2 text-left font-semibold"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[0]}>
                {row.map((cell, index) => (
                  <td
                    key={`${row[0]}-${index}`}
                    className={cn(
                      "border border-slate-300 px-3 py-2",
                      index === 4 && cell === "완료" && "bg-emerald-50 text-emerald-700",
                      index === 4 && cell === "진행 중" && "bg-amber-50 text-amber-700",
                    )}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-1 border-t border-slate-300 bg-slate-50 px-4 py-2 text-xs">
        <span className="rounded-t border border-b-0 border-slate-300 bg-white px-4 py-1 text-emerald-700">
          유지보수 일정
        </span>
        <span className="px-4 py-1 text-slate-400">점검 기준</span>
      </div>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-700">{value}</div>
    </div>
  );
}
