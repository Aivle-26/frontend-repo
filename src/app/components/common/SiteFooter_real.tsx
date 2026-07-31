import { cn } from "@/app/components/ui/utils";

/**
 * [대안 버전] KT AIVLE 공식 사이트 푸터를 그대로 참고한 사업자 신원정보 푸터.
 * 값은 ㈜케이티의 실제 공개 사업자 정보입니다.
 *
 * ⚠️ 이 버전은 KT의 실제 등록정보를 표기합니다. 교육용 데모로만 사용하고,
 * 우리 팀 프로젝트 정보를 넣고 싶으면 SiteFooter.tsx(프로젝트 버전)를 쓰세요.
 * 두 파일 모두 `SiteFooter`를 export하므로, authShared.tsx의 import 경로만
 * 바꾸면 됩니다.
 */
const BUSINESS = {
  brand: "AIVLE",                                        // 좌측 브랜드 표기
  companyName: "㈜케이티",                                // 상호
  ceo: "박윤영",                                          // 대표자명
  address: "경기도 성남시 분당구 불정로 90 (정자동)",       // 주소
  bizRegNo: "102-81-42945",                              // 사업자등록번호
  mailOrderNo: "2002-경기성남-0048",                      // 통신판매업신고
  email: "ktaivle@kt.com",                               // 문의(Contact)
  copyright: "2021 KT Corp. All rights reserved.",       // 저작권
  privacyUrl: "https://aivle.kt.com",                    // 개인정보 처리방침 링크
} as const;

const FIELDS: { label?: string; value: string }[] = [
  { value: BUSINESS.companyName },
  { value: BUSINESS.address },
  { label: "대표자명", value: BUSINESS.ceo },
  { label: "사업자등록번호", value: BUSINESS.bizRegNo },
  { label: "통신판매업신고", value: BUSINESS.mailOrderNo },
];

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "w-full border-t border-border bg-muted/40 text-muted-foreground",
        className,
      )}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-start sm:gap-8">
        {/* 좌측 브랜드 */}
        <span className="text-lg font-semibold tracking-wide text-foreground/80">
          {BUSINESS.brand}
        </span>

        {/* 우측 사업자 정보 */}
        <div className="flex-1">
          {/* 신원정보 라인 */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-relaxed">
            {FIELDS.map((f, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && (
                  <span aria-hidden className="text-border">
                    |
                  </span>
                )}
                <span>
                  {f.label && (
                    <span className="font-medium text-foreground/80">
                      {f.label}{" "}
                    </span>
                  )}
                  {f.value}
                </span>
              </span>
            ))}
          </div>

          {/* 저작권 · 문의 · 개인정보 처리방침 */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span>Copyright© {BUSINESS.copyright}</span>
            <span>
              Contact:{" "}
              <a
                href={`mailto:${BUSINESS.email}`}
                className="underline underline-offset-2 hover:text-foreground"
              >
                {BUSINESS.email}
              </a>
            </span>
            <span aria-hidden className="text-border">
              |
            </span>
            <a
              href={BUSINESS.privacyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground underline underline-offset-2"
            >
              개인정보 처리방침
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
