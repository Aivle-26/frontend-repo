import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileSearch,
  Loader2,
} from "lucide-react";
import type { PDFDocumentProxy, TextItem } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import {
  projectRepository,
  type RequirementEvidence,
} from "@/app/api/projectRepository";
import { cn } from "@/app/components/ui/utils";

let pdfJsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import("pdfjs-dist").then((module) => {
      module.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      return module;
    });
  }
  return pdfJsPromise;
}

interface RequirementEvidenceViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | number;
  requirementTitle: string;
  evidences: RequirementEvidence[];
  fallbackSourceDocument?: string | null;
  fallbackExcerpt?: string | null;
}

interface TextSpan {
  element: HTMLSpanElement;
  text: string;
}

export function RequirementEvidenceViewer({
  open,
  onOpenChange,
  projectId,
  requirementTitle,
  evidences,
  fallbackSourceDocument,
  fallbackExcerpt,
}: RequirementEvidenceViewerProps) {
  const [evidenceIndex, setEvidenceIndex] = useState(0);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [viewPage, setViewPage] = useState<number | null>(null);
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [isRenderingPage, setIsRenderingPage] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [quoteMatched, setQuoteMatched] = useState<boolean | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  const activeEvidence = evidences[evidenceIndex] ?? null;
  const activeDocumentId = activeEvidence?.documentId ?? null;

  useEffect(() => {
    if (!open) return;
    setEvidenceIndex(0);
  }, [open, requirementTitle]);

  useEffect(() => {
    setViewPage(activeEvidence?.pageNumber ?? null);
  }, [activeEvidence?.chunkId, activeEvidence?.pageNumber]);

  useEffect(() => {
    if (
      !open ||
      activeDocumentId === null ||
      activeEvidence?.pageNumber == null
    ) {
      setPdfDocument(null);
      setIsLoadingDocument(false);
      setLoadError("");
      setQuoteMatched(null);
      return;
    }

    let disposed = false;
    let loadedDocument: PDFDocumentProxy | null = null;
    const abortController = new AbortController();
    setPdfDocument(null);
    setIsLoadingDocument(true);
    setLoadError("");
    setQuoteMatched(null);

    projectRepository
      .getProjectDocumentContent(
        projectId,
        activeDocumentId,
        abortController.signal,
      )
      .then((blob) => blob.arrayBuffer())
      .then(async (data) => (await loadPdfJs()).getDocument({ data }).promise)
      .then((document) => {
        if (disposed) {
          void document.destroy();
          return;
        }
        loadedDocument = document;
        setPdfDocument(document);
      })
      .catch((error) => {
        if (!disposed && !isAbortError(error)) {
          setPdfDocument(null);
          setLoadError(
            error instanceof Error
              ? error.message
              : "원본 PDF를 불러오지 못했습니다.",
          );
        }
      })
      .finally(() => {
        if (!disposed) {
          setIsLoadingDocument(false);
        }
      });

    return () => {
      disposed = true;
      abortController.abort();
      if (loadedDocument) {
        void loadedDocument.destroy();
      }
    };
  }, [
    activeDocumentId,
    activeEvidence?.chunkId,
    activeEvidence?.evidenceId,
    activeEvidence?.pageNumber,
    open,
    projectId,
  ]);

  useEffect(() => {
    if (
      !pdfDocument ||
      viewPage === null ||
      !canvasRef.current ||
      !textLayerRef.current ||
      !pageContainerRef.current
    ) {
      setIsRenderingPage(false);
      return;
    }

    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;
    setIsRenderingPage(true);
    setLoadError("");
    setQuoteMatched(null);

    const render = async () => {
      const { Util } = await loadPdfJs();
      if (viewPage < 1 || viewPage > pdfDocument.numPages) {
        throw new Error("근거 페이지가 PDF 범위를 벗어났습니다.");
      }
      const page = await pdfDocument.getPage(viewPage);
      const baseViewport = page.getViewport({ scale: 1 });
      const availableWidth = Math.max(
        320,
        pageContainerRef.current!.clientWidth - 24,
      );
      const scale = Math.min(1.6, availableWidth / baseViewport.width);
      const viewport = page.getViewport({ scale });
      const pixelRatio = window.devicePixelRatio || 1;
      const canvas = canvasRef.current!;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("PDF 캔버스를 초기화하지 못했습니다.");
      }
      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      renderTask = page.render({
        canvas,
        canvasContext: context,
        viewport,
      });
      await renderTask.promise;
      if (cancelled) return;

      const textContent = await page.getTextContent();
      const textLayer = textLayerRef.current!;
      textLayer.replaceChildren();
      textLayer.style.width = `${viewport.width}px`;
      textLayer.style.height = `${viewport.height}px`;
      const spans: TextSpan[] = [];
      for (const item of textContent.items) {
        if (!("str" in item) || !item.str) continue;
        const textItem = item as TextItem;
        const transform = Util.transform(viewport.transform, textItem.transform);
        const fontHeight = Math.hypot(transform[2], transform[3]);
        const style = textContent.styles[textItem.fontName];
        const ascent = style?.ascent
          ? style.ascent * fontHeight
          : style?.descent
            ? (1 + style.descent) * fontHeight
            : fontHeight;
        const span = document.createElement("span");
        span.textContent = textItem.str;
        span.style.position = "absolute";
        span.style.left = `${transform[4]}px`;
        span.style.top = `${transform[5] - ascent}px`;
        span.style.fontSize = `${fontHeight}px`;
        span.style.fontFamily = style?.fontFamily || "sans-serif";
        span.style.transformOrigin = "0 0";
        span.style.whiteSpace = "pre";
        span.style.color = "transparent";

        context.font = `${fontHeight}px ${style?.fontFamily || "sans-serif"}`;
        const measuredWidth = context.measureText(textItem.str).width;
        if (measuredWidth > 0 && textItem.width > 0) {
          span.style.transform = `scaleX(${(textItem.width * scale) / measuredWidth})`;
        }
        textLayer.appendChild(span);
        spans.push({ element: span, text: textItem.str });
      }
      const matched = highlightQuote(spans, activeEvidence?.quoteText ?? "");
      setQuoteMatched(matched);
    };

    void render()
      .catch((error) => {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "PDF 페이지를 표시하지 못했습니다.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsRenderingPage(false);
        }
      });

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [activeEvidence?.quoteText, pdfDocument, viewPage]);

  const evidenceLabel = useMemo(() => {
    if (!activeEvidence) return fallbackSourceDocument ?? "근거 문서";
    return `${activeEvidence.sourceDocument}${
      activeEvidence.pageNumber ? ` · ${activeEvidence.pageNumber}쪽` : ""
    }`;
  }, [activeEvidence, fallbackSourceDocument]);

  const quoteText = activeEvidence?.quoteText || fallbackExcerpt || "";
  const canRenderPage =
    activeEvidence !== null && activeEvidence.pageNumber !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-[min(1180px,calc(100%-1.5rem))] overflow-hidden p-0 sm:max-w-[min(1180px,calc(100%-2rem))]">
        <DialogHeader className="border-b px-5 py-4 pr-12">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{requirementTitle}</DialogTitle>
            <Badge variant="outline">{evidenceLabel}</Badge>
          </div>
          <DialogDescription>
            저장된 문서 ID와 검증된 인용문을 기준으로 원문 근거를 표시합니다.
          </DialogDescription>
        </DialogHeader>

        {evidences.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto border-b px-5 py-3">
            {evidences.map((evidence, index) => (
              <Button
                key={`${evidence.chunkId}-${index}`}
                type="button"
                size="sm"
                variant={index === evidenceIndex ? "default" : "outline"}
                onClick={() => setEvidenceIndex(index)}
              >
                근거 {index + 1}
                {evidence.pageNumber ? ` · ${evidence.pageNumber}쪽` : ""}
              </Button>
            ))}
          </div>
        ) : null}

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div
            ref={pageContainerRef}
            className="relative min-h-[420px] overflow-auto bg-neutral-100 p-3 lg:max-h-[72vh]"
          >
            {isLoadingDocument || isRenderingPage ? (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : null}

            {!canRenderPage ? (
              <div className="flex min-h-[420px] items-center justify-center p-6 text-center">
                <div>
                  <FileSearch className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-3 font-medium">페이지 정보가 없습니다.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    임의의 페이지로 이동하지 않고 저장된 원문 인용만 표시합니다.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mx-auto w-fit shadow-sm">
                <div className="relative">
                  <canvas ref={canvasRef} className="block bg-white" />
                  <div
                    ref={textLayerRef}
                    className="absolute inset-0 select-text overflow-hidden"
                    aria-label="PDF 텍스트 레이어"
                  />
                </div>
              </div>
            )}
          </div>

          <aside className="min-h-0 space-y-4 overflow-y-auto border-t p-5 lg:max-h-[72vh] lg:border-l lg:border-t-0">
            {loadError ? (
              <Alert variant="destructive">
                <AlertDescription>{loadError}</AlertDescription>
              </Alert>
            ) : null}

            {pdfDocument && viewPage !== null ? (
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  disabled={viewPage <= 1 || isRenderingPage}
                  title="이전 페이지"
                  onClick={() => setViewPage((page) => Math.max(1, (page ?? 1) - 1))}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-sm font-medium">
                  {viewPage} / {pdfDocument.numPages}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  disabled={
                    viewPage >= pdfDocument.numPages || isRenderingPage
                  }
                  title="다음 페이지"
                  onClick={() =>
                    setViewPage((page) =>
                      Math.min(pdfDocument.numPages, (page ?? 1) + 1),
                    )
                  }
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            ) : null}

            <section>
              <h3 className="text-sm font-semibold">원문 근거</h3>
              <blockquote
                className={cn(
                  "mt-2 rounded-md border-l-4 px-3 py-3 text-sm leading-6",
                  quoteMatched
                    ? "border-yellow-400 bg-yellow-50"
                    : "border-border bg-muted/50",
                )}
              >
                {quoteText || "저장된 원문 인용이 없습니다."}
              </blockquote>
              {quoteMatched === false && canRenderPage ? (
                <p className="mt-2 text-xs text-amber-700">
                  PDF 텍스트 레이어에서 정확한 인용문을 찾지 못해 별도 영역에
                  표시했습니다.
                </p>
              ) : null}
            </section>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function highlightQuote(spans: TextSpan[], quote: string) {
  const quoteText = normalizeWhitespace(quote);
  if (!quoteText) return false;

  const normalizedItems = spans.map((span) => normalizeWhitespace(span.text));
  const ranges: Array<{ start: number; end: number }> = [];
  let combined = "";
  for (const text of normalizedItems) {
    if (!text) {
      ranges.push({ start: combined.length, end: combined.length });
      continue;
    }
    if (combined) combined += " ";
    const start = combined.length;
    combined += text;
    ranges.push({ start, end: combined.length });
  }
  const matchStart = combined.indexOf(quoteText);
  if (matchStart < 0) return false;
  const matchEnd = matchStart + quoteText.length;
  ranges.forEach((range, index) => {
    if (range.end > matchStart && range.start < matchEnd) {
      spans[index].element.style.background = "rgba(250, 204, 21, 0.52)";
      spans[index].element.style.borderRadius = "2px";
    }
  });
  return true;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}
