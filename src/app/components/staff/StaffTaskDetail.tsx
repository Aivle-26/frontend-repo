import { useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  Flag,
  UserRound,
  Paperclip,
  Link2,
  Sparkles,
  MessageSquare,
  CheckCircle2,
  RotateCcw,
  UploadCloud,
  X,
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
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { Separator } from "@/app/components/ui/separator";
import {
  Avatar,
  AvatarFallback,
} from "@/app/components/ui/avatar";
import { demoRepository } from "@/app/data/demoRepository";
import {
  completeTask,
  updateTaskColumn,
  useTasks,
} from "@/app/state/taskStore";
import { projectRepository, ApiError } from "@/app/api/projectRepository";

function formatFileSize(bytes: number) {
  if (!bytes) return "-";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)}KB`;
  return `${(kb / 1024).toFixed(1)}MB`;
}

interface StaffTaskDetailProps {
  taskId: string;
  projectId: string;
  currentUserName: string;
  onBack: () => void;
}

export function StaffTaskDetail({
  taskId,
  projectId,
  currentUserName,
  onBack,
}: StaffTaskDetailProps) {
  const tasks = useTasks();

  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = (selected: File | null) => {
    setAttachedFile(selected);
  };

  const handleUploadAttachment = async () => {
    if (!attachedFile) {
      fileInputRef.current?.click();
      return;
    }
    setUploadingFile(true);
    try {
      await projectRepository.uploadProjectDocuments(projectId, [attachedFile]);
      toast.success(`${attachedFile.name} 파일을 첨부했어요.`);
      setAttachedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : "파일 첨부에 실패했습니다.");
    } finally {
      setUploadingFile(false);
    }
  };

  const task = tasks.find(
    (item) => item.id === taskId,
  );

  const isCompleted = task?.column === "done";

  const {
    checklist: initialChecklist,
    aiSummary,
    feedback,
  } = demoRepository.getTaskDetail();

  const [checklist, setChecklist] =
    useState(initialChecklist);

  const [comment, setComment] = useState("");

  const [comments, setComments] = useState([
    {
      id: "cm1",
      author: "나",
      text: "토큰 만료 예외 처리 초안 작성 중입니다.",
      date: "2026-06-30",
    },
  ]);

  const toggle = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              done: !item.done,
            }
          : item,
      ),
    );
  };

  const addComment = async () => {
    if (!comment.trim()) {
      return;
    }

    await demoRepository.addComment({
      text: comment,
    });

    setComments((prev) => [
      ...prev,
      {
        id: `cm${prev.length + 1}`,
        author: "나",
        text: comment,
        date: "2026-06-30",
      },
    ]);

    setComment("");
    toast.success("댓글을 등록했습니다.");
  };

  if (!task) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="-ml-2"
        >
          <ArrowLeft className="size-4" />
          업무 보드로 돌아가기
        </Button>

        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            해당 업무를 찾을 수 없습니다.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="-ml-2"
      >
        <ArrowLeft className="size-4" />
        업무 보드로 돌아가기
      </Button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 왼쪽 영역 */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="mb-1 flex items-center gap-2">
                <Badge
                  variant={
                    isCompleted
                      ? "default"
                      : "secondary"
                  }
                >
                  {isCompleted ? "완료" : "진행 중"}
                </Badge>

                <Badge
                  variant={
                    task.priority === "높음"
                      ? "destructive"
                      : task.priority === "중간"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {task.priority}
                </Badge>
              </div>
              <CardTitle>{task.title}</CardTitle>

              <CardDescription>
                {task.relatedReq} 관련 업무
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Meta
                  icon={
                    <CalendarClock className="size-4" />
                  }
                  label="마감일"
                  value={task.due || "미정"}
                />

                <Meta
                  icon={<Flag className="size-4" />}
                  label="우선순위"
                  value={task.priority}
                />

                <Meta
                  icon={
                    <UserRound className="size-4" />
                  }
                  label="담당자"
                  value={
                    currentUserName ||
                    task.assignee
                  }
                />
              </div>

              <div>
                <h3 className="mb-2 text-foreground">
                  관련 RFP 요구사항
                </h3>

                <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-foreground">
                  {task.relatedReq}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-foreground">
                  업무 설명
                </h3>

                <p className="text-sm text-muted-foreground">
                  {task.title} 업무를 수행합니다.
                  관련 요구사항을 검토하고 필요한
                  산출물을 작성하세요.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-foreground">
                  체크리스트
                </h3>

                <div className="space-y-2">
                  {checklist.map((item) => (
                    <label
                      key={item.id}
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <Checkbox
                        checked={item.done}
                        onCheckedChange={() =>
                          toggle(item.id)
                        }
                      />

                      <span
                        className={
                          item.done
                            ? "text-sm text-muted-foreground line-through"
                            : "text-sm text-foreground"
                        }
                      >
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                산출물 제출
              </CardTitle>

              <CardDescription>
                파일 또는 링크를 첨부하여
                검토를 요청하세요.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
              />
              {attachedFile ? (
                <div className="flex w-full items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                    <div className="min-w-0">
                      <p className="truncate text-emerald-900 text-sm">{attachedFile.name}</p>
                      <p className="text-emerald-700/80 text-xs">
                        {formatFileSize(attachedFile.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="shrink-0 rounded-md p-1.5 text-emerald-700 hover:bg-emerald-100"
                    title="선택 취소"
                  >
                    <X className="size-4" aria-label="선택 취소" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 py-8 text-center hover:bg-muted"
                >
                  <Paperclip className="size-6 text-muted-foreground" />

                  <span className="text-sm text-foreground">
                    파일을 끌어다 놓거나
                    클릭하여 첨부
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                {attachedFile && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    다른 파일로 바꾸기
                  </Button>
                )}
                <Button
                  onClick={() => void handleUploadAttachment()}
                  disabled={uploadingFile || !attachedFile}
                >
                  <UploadCloud className="size-4" />
                  {uploadingFile ? "업로드 중…" : "첨부 파일 업로드"}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Link2 className="size-4 text-muted-foreground" />

                <Input placeholder="링크 첨부 (https://...)" />
              </div>

              <Button
                className="w-full"
                onClick={async () => {
                  await demoRepository.requestReview();

                  toast.success(
                    "검토 요청을 제출했습니다.",
                  );
                }}
              >
                검토 요청 제출
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 오른쪽 영역 */}
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="size-4" />
                PM 피드백
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              {feedback.map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border border-border p-3"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm text-foreground">
                      {item.author}
                    </span>

                    <span className="text-xs text-muted-foreground">
                      {item.date}
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {item.text}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>댓글</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              {comments.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-2"
                >
                  <Avatar className="size-7">
                    <AvatarFallback>
                      {item.author.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground">
                        {item.author}
                      </span>

                      <span className="text-xs text-muted-foreground">
                        {item.date}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {item.text}
                    </p>
                  </div>
                </div>
              ))}

              <Separator />

              <Textarea
                placeholder="댓글을 입력하세요."
                value={comment}
                onChange={(event) =>
                  setComment(event.target.value)
                }
                rows={3}
              />

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={addComment}
              >
                댓글 등록
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4" />
                AI 업무 요약
              </CardTitle>
            </CardHeader>

            <CardContent>
              <ul className="space-y-3">
                {aiSummary.map((line) => (
                  <li
                    key={line}
                    className="flex items-start gap-2"
                  >
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />

                    <span className="text-sm text-foreground">
                      {line}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 업무 완료 버튼 */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="text-foreground">
              업무 처리 상태
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              완료 버튼을 누르면 업무 보드의
              완료 열로 이동합니다.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              size="lg"
              disabled={isCompleted}
              onClick={() => {
                completeTask(task.id);
                toast.success(
                  "업무를 완료 처리했습니다.",
                );
                onBack();
              }}
              className="sm:min-w-40"
            >
              <CheckCircle2 className="size-4" />

              {isCompleted
                ? "완료된 업무"
                : "업무 완료"}
            </Button>

            {isCompleted && (
              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={() => {
                  updateTaskColumn(task.id, "todo");
                  toast.success(
                    "완료 처리를 취소하고 할 일로 되돌렸습니다.",
                  );
                }}
              >
                <RotateCcw className="size-4" />
                완료 취소
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Meta({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>

      <div className="text-sm text-foreground">
        {value}
      </div>
    </div>
  );
}