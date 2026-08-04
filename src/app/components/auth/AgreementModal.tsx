import type { RefObject, UIEvent } from "react";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";

interface AgreementSection {
  heading: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
}

export interface AgreementContent {
  title: string;
  sections: readonly AgreementSection[];
}

export const AGREEMENT_CONTENT = {
  terms: {
    title: "[필수] PM Agent 서비스 이용약관",
    sections: [
      {
        heading: "제1조 (목적)",
        paragraphs: [
          "이 약관은 BidWorks AI가 제공하는 PM Agent 서비스의 이용과 관련하여 회사와 회원 사이의 권리, 의무 및 책임사항을 정하는 것을 목적으로 합니다.",
        ],
      },
      {
        heading: "제2조 (정의)",
        items: [
          "서비스란 회사가 제공하는 AI 기반 프로젝트 관리 및 문서 분석 도구 일체를 말합니다.",
          "회원이란 이 약관에 동의하고 회원가입 절차를 완료하여 서비스를 이용하는 사람을 말합니다.",
          "프로젝트란 회원이 서비스를 통해 생성·관리하는 업무 단위와 관련 데이터를 말합니다.",
        ],
      },
      {
        heading: "제3조 (약관의 효력 및 변경)",
        items: [
          "이 약관은 서비스 화면에 게시하거나 그 밖의 방법으로 회원에게 안내한 때부터 효력이 발생합니다.",
          "회사는 관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며, 변경 내용과 시행일을 서비스 내 공지사항으로 안내합니다.",
          "회원이 변경된 약관의 시행일 이후에도 서비스를 계속 이용하면 변경된 약관에 동의한 것으로 봅니다.",
        ],
      },
      {
        heading: "제4조 (서비스의 제공 및 변경)",
        items: [
          "회사는 특별한 사정이 없는 한 서비스를 연중무휴 24시간 제공하는 것을 원칙으로 합니다.",
          "점검, 장애, 설비 변경 등 운영상 필요한 경우 서비스의 전부 또는 일부가 일시 중단될 수 있습니다.",
          "회사는 서비스의 품질 개선 또는 운영상 필요에 따라 기능과 제공 방식을 변경할 수 있습니다.",
        ],
      },
      {
        heading: "제5조 (회원가입 및 계정 관리)",
        items: [
          "회원가입 신청자는 정확하고 최신의 정보를 제공해야 하며, 이메일 인증을 완료해야 계정을 사용할 수 있습니다.",
          "회원은 자신의 계정과 인증정보를 안전하게 관리해야 하며, 이를 제3자에게 공유하거나 양도할 수 없습니다.",
          "계정 정보가 도용되거나 무단 사용된 사실을 알게 된 경우 즉시 회사에 알려야 합니다.",
        ],
      },
      {
        heading: "제6조 (회원의 의무)",
        items: [
          "회원은 관련 법령, 이 약관 및 서비스 이용 안내를 준수해야 합니다.",
          "타인의 권리를 침해하거나 서비스 운영을 방해하는 행위를 해서는 안 됩니다.",
          "회원이 등록한 프로젝트 자료와 문서에 대한 적법한 사용 권한은 회원이 확보해야 합니다.",
        ],
      },
      {
        heading: "제7조 (서비스 이용 제한)",
        paragraphs: [
          "회사는 회원이 법령 또는 이 약관을 위반하거나 서비스의 정상적인 운영을 방해한 경우 사전 안내 후 서비스 이용을 제한할 수 있습니다. 긴급한 보안 위험이 있는 경우에는 먼저 제한한 뒤 사후 안내할 수 있습니다.",
        ],
      },
      {
        heading: "제8조 (책임 및 분쟁 해결)",
        paragraphs: [
          "회사는 안정적인 서비스 제공을 위해 노력합니다. 서비스 이용과 관련한 문의나 분쟁은 회사가 안내하는 고객지원 채널을 통해 협의하며, 해결되지 않는 경우 관련 법령과 관할 법원의 절차를 따릅니다.",
        ],
      },
    ],
  },
  privacy: {
    title: "[필수] 개인정보 수집·이용 안내",
    sections: [
      {
        heading: "1. 수집·이용 목적",
        items: [
          "회원 식별 및 회원가입 의사 확인",
          "이메일 인증, 로그인 및 계정 보안 관리",
          "PM Agent 서비스 제공과 사용자 문의 대응",
        ],
      },
      {
        heading: "2. 수집하는 개인정보 항목",
        items: [
          "필수 항목: 사번, 이름, 이메일 주소, 비밀번호, 역할 정보",
          "서비스 이용 과정에서 접속 기록, 오류 기록 등 서비스 운영 정보가 생성될 수 있습니다.",
          "비밀번호는 안전한 방식으로 암호화하여 저장하며 원문을 저장하지 않습니다.",
        ],
      },
      {
        heading: "3. 개인정보의 보유 및 이용 기간",
        paragraphs: [
          "회원의 개인정보는 회원 탈퇴 또는 수집·이용 목적 달성 시 지체 없이 파기합니다. 다만 관계 법령에 따라 보관할 의무가 있는 정보는 해당 법령에서 정한 기간 동안 별도로 보관합니다.",
        ],
      },
      {
        heading: "4. 개인정보의 제3자 제공",
        paragraphs: [
          "회사는 회원의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 다만 법령에 특별한 규정이 있거나 적법한 절차에 따른 요청이 있는 경우는 예외로 합니다.",
        ],
      },
      {
        heading: "5. 개인정보 처리의 위탁",
        paragraphs: [
          "서비스 운영에 필요한 업무를 외부 전문업체에 위탁하는 경우 위탁 업무의 내용과 수탁자를 관련 법령에 따라 공개하고 안전하게 관리·감독합니다.",
        ],
      },
      {
        heading: "6. 정보주체의 권리와 행사 방법",
        items: [
          "회원은 자신의 개인정보에 대한 열람, 정정, 삭제 및 처리정지를 요청할 수 있습니다.",
          "요청은 서비스 내 문의 채널 또는 개인정보보호책임자 연락처를 통해 접수할 수 있습니다.",
          "회사는 본인 확인 후 관련 법령에서 정한 기간 안에 처리 결과를 안내합니다.",
        ],
      },
      {
        heading: "7. 동의 거부 권리 및 불이익",
        paragraphs: [
          "회원은 개인정보 수집·이용 동의를 거부할 권리가 있습니다. 다만 위 필수 항목은 회원가입과 서비스 제공에 필요한 정보이므로 동의하지 않으면 회원가입 및 서비스 이용이 제한됩니다.",
        ],
      },
      {
        heading: "8. 개인정보 보호 문의",
        paragraphs: [
          "개인정보 처리에 관한 문의, 불만 또는 피해 구제 요청은 서비스 하단에 표시된 개인정보보호책임자 및 회사 연락처를 통해 접수할 수 있습니다.",
        ],
      },
    ],
  },
} as const satisfies Record<string, AgreementContent>;

interface AgreementModalProps {
  open: boolean;
  content: AgreementContent;
  hasReachedBottom: boolean;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
  onAgree: () => void;
  onClose: () => void;
}

export function AgreementModal({
  open,
  content,
  hasReachedBottom,
  scrollContainerRef,
  onScroll,
  onAgree,
  onClose,
}: AgreementModalProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] w-[min(560px,calc(100vw-2rem))] max-w-[560px] flex-col gap-0 overflow-hidden rounded-2xl border-slate-200 bg-white p-0 text-slate-950 shadow-[0_28px_90px_rgba(15,23,42,0.28)] sm:max-w-[560px]">
        <DialogHeader className="shrink-0 border-b border-slate-200 px-6 py-5 pr-14 text-left">
          <DialogTitle className="text-xl leading-7 text-slate-950">
            {content.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            내용을 끝까지 확인한 뒤 동의 여부를 선택해 주세요.
          </DialogDescription>
        </DialogHeader>

        <div
          ref={scrollContainerRef}
          onScroll={onScroll}
          className="min-h-0 max-h-[min(58vh,480px)] flex-1 space-y-6 overflow-y-auto overscroll-contain bg-slate-50 px-6 py-5 text-sm leading-6 text-slate-700"
          tabIndex={0}
          aria-label={`${content.title} 내용`}
        >
          {content.sections.map((section) => (
            <section key={section.heading} className="space-y-2">
              <h3 className="font-semibold text-slate-950">{section.heading}</h3>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.items ? (
                <ol className="list-decimal space-y-1 pl-5">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              ) : null}
            </section>
          ))}
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p
              className={
                hasReachedBottom
                  ? "flex items-center gap-1.5 text-xs font-medium text-emerald-600"
                  : "flex items-center gap-1.5 text-xs text-slate-500"
              }
              aria-live="polite"
            >
              <LockKeyhole className="size-3.5 shrink-0" />
              {hasReachedBottom
                ? "내용을 모두 확인했습니다."
                : "내용을 끝까지 확인한 뒤 동의함을 눌러주세요."}
            </p>

            <div className="flex shrink-0 justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                onClick={onClose}
              >
                취소
              </Button>
              <button
                type="button"
                disabled={!hasReachedBottom}
                onClick={onAgree}
                className="h-9 rounded-md bg-[#2F6FF2] px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(47,111,242,0.24)] transition hover:bg-[#2464e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F6FF2]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
              >
                동의함
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
