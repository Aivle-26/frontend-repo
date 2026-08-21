import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import openSourceLicense from "@/app/content/legal/open-source-license.txt?raw";
import privacyPolicy from "@/app/content/legal/privacy-policy.txt?raw";
import termsOfService from "@/app/content/legal/terms-of-service.txt?raw";

export type LegalDocumentType = "privacy" | "terms" | "openSource";

export const LEGAL_DOCUMENT_LINKS: readonly {
  type: LegalDocumentType;
  label: string;
}[] = [
  { type: "privacy", label: "개인정보처리방침" },
  { type: "terms", label: "이용약관" },
  { type: "openSource", label: "오픈소스라이선스" },
];

const LEGAL_DOCUMENTS: Record<
  LegalDocumentType,
  { title: string; content: string }
> = {
  privacy: { title: "개인정보처리방침", content: privacyPolicy },
  terms: { title: "이용약관", content: termsOfService },
  openSource: { title: "오픈소스라이선스", content: openSourceLicense },
};

interface LegalDocumentModalProps {
  document: LegalDocumentType | null;
  onClose: () => void;
}

export function LegalDocumentModal({
  document,
  onClose,
}: LegalDocumentModalProps) {
  const activeDocument = document ? LEGAL_DOCUMENTS[document] : null;

  return (
    <Dialog open={activeDocument !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] w-[min(760px,calc(100vw-2rem))] max-w-[760px] flex-col gap-0 overflow-hidden rounded-2xl border-slate-200 bg-white p-0 text-slate-950 shadow-[0_28px_90px_rgba(15,23,42,0.28)] sm:max-w-[760px]">
        <DialogHeader className="shrink-0 border-b border-slate-200 px-6 py-5 pr-14 text-left">
          <DialogTitle className="text-xl leading-7 text-slate-950">
            {activeDocument?.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {activeDocument?.title} 전문
          </DialogDescription>
        </DialogHeader>

        <div
          className="min-h-0 max-h-[min(68vh,640px)] flex-1 overflow-y-auto overscroll-contain bg-slate-50 px-6 py-5"
          tabIndex={0}
          aria-label={`${activeDocument?.title ?? "문서"} 내용`}
        >
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-slate-700">
            {activeDocument?.content}
          </pre>
        </div>

        <div className="flex shrink-0 justify-end border-t border-slate-200 bg-white px-6 py-4">
          <Button
            type="button"
            className="bg-[#2F6FF2] px-5 text-white hover:bg-[#2464e8]"
            onClick={onClose}
          >
            닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
