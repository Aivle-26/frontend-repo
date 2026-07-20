import { Sparkles } from "lucide-react";
import landingBackground from "@assets/landing/landing-background.png";
import featureRfpAnalysis from "@assets/landing/feature-rfp-analysis.png";
import featureSchedule from "@assets/landing/feature-schedule.png";
import featureRisk from "@assets/landing/feature-risk.png";
import { Label } from "@/app/components/ui/label";
import { cn } from "@/app/components/ui/utils";

export const LOGIN_BLUE = "#2F6FF2";
export const EMAIL_EXAMPLE = "user@bidworks.ai";

/** 로그인·회원가입 입력칸 공통 스타일 */
export const INPUT_CLASS =
  "h-11 rounded-2xl border-slate-200 !bg-[#f3f5f8] px-4 text-[15px] text-slate-900 shadow-none caret-slate-900 [color-scheme:light] placeholder:text-slate-400 focus-visible:ring-[#2F6FF2]/15";

/** 자동완성 시 브라우저가 배경색을 노랗게 덮는 것 방지 */
export const INPUT_STYLE = { WebkitBoxShadow: "0 0 0 1000px #f3f5f8 inset" };

const LANDING_FEATURES = [
  {
    title: "AI 기반 RFP 분석",
    description:
      "AI가 문서를 분석해 핵심 요구사항과 평가 기준을 추출하고 정리합니다.",
    icon: featureRfpAnalysis,
  },
  {
    title: "스마트 일정 관리",
    description:
      "주요 마일스톤과 일정을 시작부터 진행 상황까지 한눈에 파악하세요.",
    icon: featureSchedule,
  },
  {
    title: "리스크 감지 & 대응",
    description:
      "잠재 리스크를 AI가 사전에 감지하고 대응 우선순위를 제안합니다.",
    icon: featureRisk,
  },
] as const;

/** 좌측 브랜드/소개 패널 */
function LandingPanel() {
  return (
    <section className="relative overflow-hidden rounded-[36px] bg-white/70 px-6 py-8 sm:px-8 lg:min-h-[820px] lg:px-10 lg:py-10 xl:px-14 xl:py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[36px]">
        <img
          src={landingBackground}
          alt=""
          className="absolute bottom-0 right-0 h-auto w-[82%] max-w-[980px] opacity-70"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(248,251,255,0.985)_0%,rgba(248,251,255,0.965)_32%,rgba(248,251,255,0.84)_57%,rgba(248,251,255,0.48)_100%)]" />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        <div className="text-[1.9rem] font-semibold tracking-tight text-slate-950 sm:text-[2.15rem]">
          <span className="text-[#2F6FF2]">BidWorks</span> AI
        </div>

        <div className="mt-10 max-w-[720px] lg:mt-16">
          <h1 className="text-[2.85rem] font-bold leading-[1.16] text-[#0f172a] sm:text-[3.5rem] lg:text-[4.2rem]">
            <span className="block">공공 RFP 프로젝트 관리,</span>
            <span className="mt-2 block text-[#2F6FF2]">더 빠르고 똑똑하게.</span>
          </h1>
          <p className="mt-8 max-w-[620px] text-[1.18rem] leading-[1.75] text-slate-700 sm:text-[1.28rem]">
            BidWorks AI는 RFP를 분석하고 요구사항을 체계화하여
            <br />
            PM과 팀의 업무를 효율화합니다.
            <br />
            일정·평가·리스크를 한눈에 관리하고,
            <br />
            프로젝트 성공 가능성을 높여 드립니다.
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3 lg:mt-auto lg:pt-16">
          {LANDING_FEATURES.map((feature, index) => (
            <div
              key={feature.title}
              className={cn(
                "relative flex max-w-[280px] flex-col",
                index < LANDING_FEATURES.length - 1 &&
                  "md:pr-8 md:after:absolute md:after:right-0 md:after:top-3 md:after:h-[190px] md:after:w-px md:after:bg-slate-200/90",
              )}
            >
              <img
                src={feature.icon}
                alt={feature.title}
                className="h-20 w-20 object-contain"
              />
              <h2 className="mt-5 text-[1.8rem] font-bold tracking-tight text-[#0f172a]">
                {feature.title}
              </h2>
              <p className="mt-4 text-[1.05rem] leading-8 text-slate-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** 좌측 소개 패널 + 우측 카드 2단 레이아웃 */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[#f8fbff] px-4 py-4 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1560px] items-center">
        <div className="grid w-full items-center gap-8 lg:grid-cols-[minmax(0,1.65fr)_minmax(460px,1fr)] lg:gap-12 xl:gap-16">
          <LandingPanel />

          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-[520px] rounded-[28px] border border-white/80 bg-white px-6 py-5 shadow-[0_24px_80px_rgba(15,23,42,0.10)] sm:px-8 sm:py-6">
              <div className="mx-auto mb-5 flex w-fit items-center gap-3">
                <div
                  className="flex size-10 items-center justify-center rounded-xl text-white shadow-[0_12px_32px_rgba(47,111,242,0.28)]"
                  style={{ backgroundColor: LOGIN_BLUE }}
                >
                  <Sparkles className="size-5" />
                </div>
                <span className="text-[1.8rem] font-semibold text-slate-900">
                  BidWorks AI
                </span>
              </div>

              <div className="mb-5 text-center">
                <h1 className="text-[1.85rem] font-bold text-slate-950">{title}</h1>
                <p className="mt-1.5 text-base text-slate-500">{subtitle}</p>
              </div>

              {children}

              {footer ? <div className="mt-6">{footer}</div> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FormFieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
}

export function FormField({ label, error, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-base font-semibold text-slate-950">{label}</Label>
      {children}
      {error ? <p className="text-[13px] text-rose-600">{error}</p> : null}
    </div>
  );
}

interface RoleCardProps {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}

export function RoleCard({
  active,
  disabled = false,
  onClick,
  icon,
  title,
  desc,
}: RoleCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative overflow-hidden rounded-[22px] border px-4 py-3 text-left transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-80",
        active
          ? "translate-y-[-1px] border-[#6b9aff] bg-[#f4f8ff] shadow-[0_14px_28px_rgba(47,111,242,0.14)] ring-1 ring-[#cfe0ff]"
          : "border-slate-200 bg-white hover:border-[#cbdcfb] hover:bg-[#fafcff] hover:shadow-[0_10px_20px_rgba(15,23,42,0.06)]",
      )}
    >
      <div
        className={cn(
          "absolute inset-0 opacity-0 transition-opacity duration-200",
          active
            ? "bg-[radial-gradient(circle_at_top_left,_rgba(47,111,242,0.10),_transparent_55%)] opacity-100"
            : "group-hover:opacity-100 bg-[radial-gradient(circle_at_top_left,_rgba(47,111,242,0.06),_transparent_55%)]",
        )}
      />
      <div className="relative mb-2 flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-full transition-all duration-200",
            active
              ? "bg-[#2F6FF2] text-white shadow-[0_8px_18px_rgba(47,111,242,0.30)]"
              : "bg-slate-100 text-slate-500 group-hover:bg-[#eef4ff] group-hover:text-[#2F6FF2]",
          )}
        >
          {icon}
        </span>
        <span
          className={cn(
            "text-[1.05rem] font-semibold transition-colors duration-200",
            active ? "text-[#0f172a]" : "text-slate-950",
          )}
        >
          {title}
        </span>
      </div>
      <p className="relative text-[12px] leading-5 text-slate-500">{desc}</p>
    </button>
  );
}

interface PrimaryButtonProps {
  children: React.ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
}

export function PrimaryButton({
  children,
  type = "submit",
  disabled = false,
  onClick,
}: PrimaryButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="h-11 w-full rounded-2xl text-[15px] font-semibold text-white shadow-[0_16px_34px_rgba(47,111,242,0.28)] transition-opacity hover:opacity-95 disabled:opacity-60"
      style={{ background: "linear-gradient(90deg, #2F6FF2 0%, #3779F6 100%)" }}
    >
      {children}
    </button>
  );
}
