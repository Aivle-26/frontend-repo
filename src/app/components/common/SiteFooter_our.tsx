import { cn } from "@/app/components/ui/utils";

/**
 * [대안 버전] 우리 사업자 정보 스타일 푸터.
 * 전자상거래법상 필수 신원정보 항목을 갖추되, 값은 예시(가상)로 채운 버전.
 *
 * ⚠️ KT AIVLE School 9기 팀 프로젝트 데모용입니다.
 * 아래 BUSINESS 값은 예시(가상) 값이며 실제 등록 정보가 아닙니다.
 * 실제 서비스로 운영·판매한다면 사업자등록·통신판매업 신고 후 발급받은
 * 정확한 값으로 교체하세요.
 *
 * 세 가지 푸터 버전 모두 `SiteFooter`를 export하므로,
 * authShared.tsx의 import 경로만 바꿔 골라 쓸 수 있습니다.
 *   - SiteFooter       : 프로젝트/팀 표기 버전
 *   - SiteFooter_our   : 우리 사업자정보 스타일(예시값) 버전  ← 이 파일
 *   - SiteFooter_real  : KT AIVLE 실제 정보 버전
 */
const BUSINESS = {
  companyName: "Pmate",                          // 상호(서비스명)
  team: "KT AIVLE School AI 9기 팀 프로젝트",        // 소속(데모 표기)
  ceo: "이채은",                                     // 대표자 성명
  address: "부산 동구 초량중로 29",                   // 사업장 주소
  phone: "070-4123-4567",                            // 전화번호
  email: "pmate.aivle@gmail.com",                 // 전자우편(이메일)
  bizRegNo: "123-45-67890",                          // 사업자등록번호
  mailOrderNo: "제2026-서울서초-1234호",              // 통신판매업 신고번호
  privacyOfficer: "이채은",                           // 개인정보 보호책임자
  hostingProvider: "Amazon Web Services",            // 호스팅 서비스 제공자
} as const;

const FIELDS: { label: string; value: string }[] = [
  { label: "상호", value: BUSINESS.companyName },
  { label: "대표", value: BUSINESS.ceo },
  { label: "주소", value: BUSINESS.address },
  { label: "전화", value: BUSINESS.phone },
  { label: "이메일", value: BUSINESS.email },
  { label: "사업자등록번호", value: BUSINESS.bizRegNo },
  { label: "통신판매업신고번호", value: BUSINESS.mailOrderNo },
  { label: "개인정보보호책임자", value: BUSINESS.privacyOfficer },
  { label: "호스팅 서비스 제공", value: BUSINESS.hostingProvider },
];

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "w-full border-t border-border bg-muted/40 text-muted-foreground",
        className,
      )}
    >
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* 소속 표기 (데모) */}
        <p className="mb-2 text-[11px] text-muted-foreground/70">
          {BUSINESS.team}
        </p>

        {/* 사업자 신원정보 */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-relaxed">
          {FIELDS.map((f, i) => (
            <span key={f.label} className="flex items-center gap-2">
              {i > 0 && (
                <span aria-hidden className="text-border">
                  |
                </span>
              )}
              <span>
                <span className="font-medium text-foreground/80">{f.label}</span>{" "}
                {f.value}
              </span>
            </span>
          ))}
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground/70">
          © {new Date().getFullYear()} {BUSINESS.companyName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export default SiteFooter;
