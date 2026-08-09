import { useRef } from "react";
import { FileText, UploadCloud, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import {
  PROJECT_DOCUMENT_ACCEPT,
  createPendingProjectDocuments,
  validateProjectDocumentFiles,
  type PendingProjectDocument,
} from "@/app/components/pm/projectDocumentUpload";
import type { ProjectDocType } from "@/app/data/demoData";

export const DOC_TYPE_OPTIONS: ProjectDocType[] = [
  "RFP",
  "요구사항정의서",
  "제안서",
];

interface DocPickerProps {
  documents: PendingProjectDocument[];
  onChange: (documents: PendingProjectDocument[]) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  showTypeSelector?: boolean;
}

export function DocPicker({
  documents,
  onChange,
  onError,
  disabled = false,
  showTypeSelector = true,
}: DocPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0 || disabled) return;

    const selectedFiles = Array.from(files);
    const nextFiles = [
      ...documents.map((document) => document.file),
      ...selectedFiles,
    ];
    const validationError = validateProjectDocumentFiles(nextFiles);
    if (validationError) {
      onError?.(validationError);
      return;
    }

    onError?.("");
    onChange([
      ...documents,
      ...createPendingProjectDocuments(selectedFiles),
    ]);
  };

  return (
    <div className="min-w-0 space-y-2 overflow-hidden">
      <input
        ref={inputRef}
        type="file"
        accept={PROJECT_DOCUMENT_ACCEPT}
        multiple
        disabled={disabled}
        className="hidden"
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          addFiles(event.dataTransfer.files);
        }}
        className="flex min-w-0 w-full cursor-pointer flex-col items-center gap-1.5 overflow-hidden rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-center transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-60"
      >
        <UploadCloud className="size-6 text-muted-foreground" />
        <span className="text-foreground text-sm">
          문서를 끌어다 놓거나 클릭해 선택
        </span>
        <span className="text-muted-foreground text-xs">
          PDF · DOCX · XLSX · PPTX · TXT · 파일당 최대 10MB
        </span>
      </button>
      {documents.length > 0 && (
        <div className="min-w-0 space-y-1.5 overflow-hidden">
          {documents.map((document) => (
            <div
              key={document.id}
              className={
                showTypeSelector
                  ? "grid min-w-0 w-full grid-cols-[minmax(0,1fr)_7rem_auto] items-center gap-2 overflow-hidden rounded-md border border-border px-2.5 py-1.5 sm:grid-cols-[minmax(0,1fr)_8rem_auto]"
                  : "grid min-w-0 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-md border border-border px-2.5 py-1.5"
              }
            >
              <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span
                  className="block min-w-0 flex-1 truncate text-sm text-foreground"
                  title={document.file.name}
                >
                  {document.file.name}
                </span>
              </div>
              {showTypeSelector ? (
                <Select
                  value={document.type}
                  disabled={disabled}
                  onValueChange={(value) =>
                    onChange(
                      documents.map((current) =>
                        current.id === document.id
                          ? { ...current, type: value as ProjectDocType }
                          : current,
                      ),
                    )
                  }
                >
                  <SelectTrigger className="h-7 min-w-0 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPE_OPTIONS.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange(
                    documents.filter((current) => current.id !== document.id),
                  )
                }
                className="shrink-0 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-60"
                aria-label={`${document.file.name} 제거`}
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
