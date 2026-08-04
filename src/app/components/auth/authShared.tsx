import { useEffect, useReducer, useState } from "react";
import {
  Check,
  FileText,
  ListChecks,
  Loader2,
  Network,
  Play,
  RotateCcw,
  Sparkles,
  Users,
} from "lucide-react";
import loginPageBackground from "@assets/landing/login-page-background.png";
import featureRfpAnalysis from "@assets/landing/feature-rfp-analysis.png";
import featureSchedule from "@assets/landing/feature-schedule.png";
import featureRisk from "@assets/landing/feature-risk.png";
import { Label } from "@/app/components/ui/label";
import { cn } from "@/app/components/ui/utils";
import { SiteFooter } from "@/app/components/common/SiteFooter_our";

export const LOGIN_BLUE = "#2F6FF2";
export const EMAIL_EXAMPLE = "user@bidworks.ai";

/** 로그인·회원가입 입력칸 공통 스타일 */
export const INPUT_CLASS =
  "h-11 rounded-2xl border-slate-200 !bg-[#f3f5f8] px-4 text-[15px] text-slate-900 shadow-none caret-slate-900 [color-scheme:light] placeholder:text-slate-400 focus-visible:ring-[#2F6FF2]/15";

/** 자동완성 시 브라우저가 배경색을 노랗게 덮는 것 방지 */
export const INPUT_STYLE = { WebkitBoxShadow: "0 0 0 1000px #f3f5f8 inset" };

/* 히어로 문구 글자별 등장 타이밍 */
const REVEAL_STEP = 0.05; // 글자 간 간격(초)
const LINE_PAUSE = 0.45; // 1줄 → 2줄 사이 한 템포(초)
const HERO_LINE_1 = "공공 사업 프로젝트 관리,";
const HERO_LINE_2 = "더 빠르고 똑똑하게.";
const HERO_LINE_2_DELAY = HERO_LINE_1.length * REVEAL_STEP + LINE_PAUSE;

/** 텍스트를 글자 하나씩 순차 등장시키는 컴포넌트 */
function RevealChars({ text, startDelay }: { text: string; startDelay: number }) {
  return (
    <>
      {Array.from(text).map((char, index) => (
        <span
          key={index}
          className="bw-reveal-char"
          style={{
            animationDelay: `${startDelay + index * REVEAL_STEP}s`,
            whiteSpace: "pre",
          }}
        >
          {char === " " ? " " : char}
        </span>
      ))}
    </>
  );
}

const LANDING_FEATURES = [
  {
    title: "AI 기반 문서 분석",
    short: "핵심 요구사항·평가 기준 추출",
    icon: featureRfpAnalysis,
  },
  {
    title: "스마트 일정 관리",
    short: "마일스톤·진행 현황 한눈에",
    icon: featureSchedule,
  },
  {
    title: "리스크 감지 & 대응",
    short: "잠재 리스크 사전 감지·대응",
    icon: featureRisk,
  },
] as const;

/* ================================================================== */
/* 라이브 데모 카드: "AI가 제안요청서를 분석해 결과를 채우는" 루프 연출  */
/* ================================================================== */

const DEMO_ROWS = [
  { icon: ListChecks, label: "요구사항 추출", target: 24, unit: "건", tone: "text-[#2F6FF2]", chip: "bg-[#eaf1ff]" },
  { icon: Network, label: "WBS · 일정 생성", target: 36, unit: "개", tone: "text-emerald-600", chip: "bg-emerald-50" },
  { icon: Users, label: "업무 배정", target: 8, unit: "명", tone: "text-violet-600", chip: "bg-violet-50" },
] as const;

// 각 단계 지속시간(ms). 마지막 단계는 '분석 완료' 정지 → 이후 루프 리셋.
const DEMO_PHASE_MS = [1200, 900, 900, 900, 2000];

/** 0 → target 까지 부드럽게 카운트업. run=false면 0으로 리셋. instant=true면 애니메이션 없이 즉시 target. */
function useCountUp(target: number, run: boolean, instant = false, duration = 650) {
  const [value, setValue] = useState(run && instant ? target : 0);
  useEffect(() => {
    if (!run) {
      setValue(0);
      return;
    }
    if (instant) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, instant, duration]);
  return value;
}

function DemoResultRow({
  row,
  visible,
  instant,
}: {
  row: (typeof DEMO_ROWS)[number];
  visible: boolean;
  instant: boolean;
}) {
  const value = useCountUp(row.target, visible, instant);
  const Icon = row.icon;
  const done = visible && value >= row.target;
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl px-2.5 py-2 transition-all duration-500 ease-out",
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      )}
    >
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", row.chip)}>
        <Icon className={cn("size-4", row.tone)} />
      </span>
      <span className="flex-1 text-[13px] text-slate-600">{row.label}</span>
      <span className={cn("text-lg font-bold tabular-nums", row.tone)}>
        {value}
        <span className="ml-0.5 text-xs font-semibold">{row.unit}</span>
      </span>
      <Check
        className={cn(
          "size-4 text-emerald-500 transition-opacity duration-300",
          done ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 데모 진행 엔진 (모듈 레벨)                                            */
/* 페이지(로그인↔회원가입) 이동으로 컴포넌트가 언마운트돼도 분석이         */
/* 끊기지 않고 계속 진행되며, 다시 돌아오면 그 시점부터 이어서 보인다.     */
/* ------------------------------------------------------------------ */
let demoStarted = false;
let demoCompleted = false;
let demoPhase = 0;
let demoTimer: ReturnType<typeof setTimeout> | null = null;
const demoListeners = new Set<() => void>();

function emitDemo() {
  demoListeners.forEach((listener) => listener());
}

function scheduleDemoTick() {
  const last = DEMO_PHASE_MS.length - 1;
  if (demoTimer !== null || demoPhase >= last) return;
  demoTimer = setTimeout(() => {
    demoTimer = null;
    demoPhase = Math.min(demoPhase + 1, last);
    if (demoPhase >= last) demoCompleted = true;
    emitDemo();
    scheduleDemoTick();
  }, DEMO_PHASE_MS[demoPhase]);
}

function startDemo() {
  if (demoTimer !== null) {
    clearTimeout(demoTimer);
    demoTimer = null;
  }
  demoStarted = true;
  demoCompleted = false;
  demoPhase = 0;
  emitDemo();
  scheduleDemoTick();
}

function LiveExtractDemo() {
  const lastPhase = DEMO_PHASE_MS.length - 1;
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  // 이 마운트에서 버튼으로 새로 시작한 경우만 카운트업 애니메이션 재생
  const [justStarted, setJustStarted] = useState(false);

  useEffect(() => {
    demoListeners.add(forceRender);
    // 마운트 시 진행 중이던 분석이 있으면 이어서 진행
    if (demoStarted && !demoCompleted) scheduleDemoTick();
    return () => {
      demoListeners.delete(forceRender);
    };
  }, [forceRender]);

  const started = demoStarted;
  const phase = demoPhase;
  const done = started && phase >= lastPhase;
  const running = started && !done;
  // 새로 시작한 경우가 아니면(복원/이어보기) 숫자 애니메이션 없이 즉시 표시
  const instant = !justStarted;

  const start = () => {
    setJustStarted(true);
    startDemo();
  };

  const progress = started ? (phase / lastPhase) * 100 : 0;

  return (
    <div className="w-full max-w-[380px] shrink-0 rounded-3xl border border-white/80 bg-white/85 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur-sm">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf1ff]">
          <FileText className="size-5 text-[#2F6FF2]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-900">
            제안요청서.pdf
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
            {done ? (
              <>
                <Check className="size-3.5 text-emerald-500" /> 분석 완료
              </>
            ) : running ? (
              <>
                <Loader2 className="size-3.5 animate-spin text-[#2F6FF2]" /> 제안요청서
                분석 중…
              </>
            ) : (
              <>분석 대기</>
            )}
          </div>
        </div>
        <span className="rounded-full bg-[#2F6FF2]/10 px-2.5 py-1 text-[11px] font-bold text-[#2F6FF2]">
          AI
        </span>
      </div>

      {/* 진행 바 */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#2F6FF2] to-[#5b8cff] transition-[width] duration-700 ease-out"
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>

      {/* 결과 영역 — 높이 완전 고정으로 시작 전/후 크기 변화 없음 */}
      <div className="mt-3 flex h-[152px] flex-col justify-center overflow-hidden">
        {started ? (
          <div className="space-y-1">
            {DEMO_ROWS.map((row, index) => (
              <DemoResultRow
                key={row.label}
                row={row}
                visible={phase >= index + 1}
                instant={instant}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <button
              type="button"
              onClick={start}
              className="inline-flex items-center gap-2 rounded-full bg-[#2F6FF2] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(47,111,242,0.30)] transition hover:opacity-95"
            >
              <Play className="size-4" /> 분석 시작
            </button>
            <span className="text-xs text-slate-400">
              버튼을 누르면 AI가 문서를 분석합니다
            </span>
          </div>
        )}
      </div>

      {/* 하단 액션 — 높이를 항상 고정해 완료 시 카드 크기가 변하지 않게 */}
      <div className="mt-2 flex h-6 items-center justify-end">
        {done && (
          <button
            type="button"
            onClick={start}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2F6FF2] transition hover:underline"
          >
            <RotateCcw className="size-3.5" /> 다시 분석
          </button>
        )}
      </div>
    </div>
  );
}

// 히어로 글자 애니메이션은 한 세션에 한 번만. (로그인↔회원가입 이동 시 재생 방지)
let heroRevealed = false;

/** 좌측 브랜드/소개 패널 */
function LandingPanel() {
  const [revealHero] = useState(() => !heroRevealed);
  useEffect(() => {
    heroRevealed = true;
  }, []);

  return (
    <section className="relative overflow-hidden rounded-[36px] bg-white/70 px-6 py-8 sm:px-8 lg:min-h-[820px] lg:px-10 lg:py-10 xl:px-14 xl:py-12">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[36px]">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(248,251,255,0.92)_0%,rgba(248,251,255,0.82)_42%,rgba(248,251,255,0.56)_100%)]" />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        <div className="text-[1.9rem] font-semibold tracking-tight text-slate-950 sm:text-[2.15rem]">
          <span className="text-[#2F6FF2]">BidWorks</span> AI
        </div>

        <div className="mt-10 max-w-[720px] lg:mt-16">
          <h1 className="text-[2.85rem] font-bold leading-[1.16] text-[#0f172a] sm:text-[3.5rem] lg:text-[4.2rem]">
            <span className="block">
              {revealHero ? (
                <RevealChars text={HERO_LINE_1} startDelay={0} />
              ) : (
                HERO_LINE_1
              )}
            </span>
            <span className="mt-2 block text-[#2F6FF2]">
              {revealHero ? (
                <RevealChars text={HERO_LINE_2} startDelay={HERO_LINE_2_DELAY} />
              ) : (
                HERO_LINE_2
              )}
            </span>
          </h1>
          <p className="mt-8 max-w-[620px] text-[1.18rem] leading-[1.75] text-slate-700 sm:text-[1.28rem]">
            BidWorks AI는 사업 문서를 분석해 요구사항을 체계화하여
            <br />
            PM과 팀의 업무를 효율화합니다.
            <br />
            일정·평가·리스크를 한눈에 관리하고,
            <br />
            프로젝트 성공 가능성을 높여 드립니다.
          </p>
        </div>

        {/* 데모 카드(왼쪽) + 기능 한 줄 3개(오른쪽) */}
        <div className="mt-10 flex flex-col gap-5 lg:mt-14 lg:flex-row lg:items-stretch lg:gap-8">
          <LiveExtractDemo />

          {/* 반투명 배경으로 뒤 배경 이미지 위에서도 가독성 확보 */}
          <div className="flex flex-1 flex-col justify-center gap-1 rounded-3xl bg-white/45 p-2.5 backdrop-blur-sm">
            {LANDING_FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group flex cursor-default items-center gap-3 rounded-2xl p-3 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_14px_30px_rgba(15,23,42,0.10)]"
              >
                <img
                  src={feature.icon}
                  alt=""
                  className="size-11 shrink-0 object-contain transition-transform duration-300 ease-out group-hover:scale-110"
                />
                <div className="min-w-0">
                  <div className="text-[1.05rem] font-bold text-[#0f172a] transition-colors duration-200 group-hover:text-[#2F6FF2]">
                    {feature.title}
                  </div>
                  <div className="truncate text-[13px] leading-5 text-slate-500">
                    {feature.short}
                  </div>
                </div>
              </div>
            ))}
          </div>
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
    <div
      className="relative flex min-h-screen flex-col bg-[#f8fbff] bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${loginPageBackground})` }}
    >
      <div className="pointer-events-none absolute inset-0 bg-white/12" />
      <div className="relative z-10 mx-auto flex w-full max-w-[1560px] flex-1 items-center px-4 py-4 sm:px-6">
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
      <div className="relative z-10">
        <SiteFooter />
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
}

export function RoleCard({
  active,
  disabled = false,
  onClick,
  icon,
  title,
}: RoleCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative overflow-hidden rounded-[18px] border px-3 py-2 text-left transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-80",
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
      <div className="relative flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-full transition-all duration-200",
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
