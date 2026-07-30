import { cn } from "@/app/components/ui/utils";

/**
 * 사이트 하단 푸터. KT AIVLE 공식 사이트 푸터의 "형식"만 참고하고,
 * 실제 사업자 등록정보는 넣지 않습니다.
 *
 * 본 사이트는 KT AIVLE School 교육용 팀 프로젝트로, 상업적 서비스가 아니며
 * 사업자등록·통신판매업 신고 대상이 아닙니다. 따라서 사업자등록번호 등
 * 신원정보 대신 팀·기수·문의처만 표기합니다.
 */
const PROJECT = {
  brand: "BidWorks AI",                                 // 서비스명
  program: "KT AIVLE School AI 9기 빅프로젝트",        // 소속/기수
  team: "LangChaeeun",                             // 팀명
  //members: "",                          // 팀원 (필요 시 추가)
  email: "bidworks.aivle@gmail.com",                 // 문의 이메일
  year: new Date().getFullYear(),
} as const;

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "w-full border-t border-border bg-muted/40 text-muted-foreground",
        className,
      )}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-start sm:gap-8">
        {/* 좌측 브랜드 */}
        <span className="text-lg font-semibold tracking-wide text-foreground/80">
          {PROJECT.brand}
        </span>

        {/* 우측 프로젝트 정보 */}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-relaxed">
            <span>{PROJECT.program}</span>
            <span aria-hidden className="text-border">|</span>
            <span>
              <span className="font-medium text-foreground/80">팀 </span>
              {PROJECT.team} 
            </span>
            <span aria-hidden className="text-border">|</span>
            <span>
              <span className="font-medium text-foreground/80">문의 </span>
              <a
                href={`mailto:${PROJECT.email}`}
                className="underline underline-offset-2 hover:text-foreground"
              >
                {PROJECT.email}
              </a>
            </span>
          </div>

          <p className="mt-2 text-[11px] text-muted-foreground/70">
            본 사이트는 KT AIVLE School 교육용 프로젝트로, 상업적 서비스가 아닙니다.
          </p>

          <p className="mt-2 text-[11px] text-muted-foreground/70">
            © {PROJECT.year} {PROJECT.team}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
