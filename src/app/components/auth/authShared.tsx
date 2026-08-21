import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import {
  Check,
  FileText,
  ListChecks,
  Loader2,
  Network,
  RotateCcw,
  Sparkles,
  Users,
} from "lucide-react";
// 배경은 화면 전체를 bg-cover로 채우므로 고해상도/고DPI에서 크게 확대된다.
// 4K(3840x2160) 원본을 WebP로 변환해 사용한다. PNG 5.32MB → WebP 0.46MB.
import loginPageBackground from "@assets/landing/login-project-dashboard-background-v3.png";
import featureRfpAnalysis from "@assets/landing/feature-rfp-analysis.png";
import featureSchedule from "@assets/landing/feature-schedule.png";
import featureRisk from "@assets/landing/feature-risk.png";
import { Label } from "@/app/components/ui/label";
import { cn } from "@/app/components/ui/utils";
import { SiteFooter } from "@/app/components/common/SiteFooter_our";

export const LOGIN_BLUE = "#4F9FD8";
export const EMAIL_EXAMPLE = "user@pmate.ai";

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
          {char === " " ? " " : char}
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

function LiveExtractDemo({ expanded = false }: { expanded?: boolean }) {
  const lastPhase = DEMO_PHASE_MS.length - 1;
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  // 이 마운트에서 새로 시작한 경우만 카운트업 애니메이션 재생
  const [justStarted, setJustStarted] = useState(false);

  useEffect(() => {
    if (!demoStarted) {
      setJustStarted(true);
      startDemo();
    }
  }, []);

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
    <div
      className={cn(
        "w-full shrink-0 rounded-3xl border border-white/80 bg-white/85 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur-sm",
        expanded ? "max-w-[380px] p-5" : "max-w-[330px] p-3.5",
      )}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex shrink-0 items-center justify-center bg-[#eaf1ff]",
            expanded ? "size-10 rounded-xl" : "size-8 rounded-lg",
          )}
        >
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
      <div
        className={cn(
          "flex flex-col justify-center overflow-hidden",
          expanded ? "mt-3 h-[152px]" : "mt-2 h-24",
        )}
      >
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
            <div className="inline-flex items-center gap-2 rounded-full bg-[#eaf1ff] px-4 py-2 text-sm font-semibold text-[#2F6FF2]">
              <Loader2 className="size-4 animate-spin" /> 자동 분석 준비 중
            </div>
            <span className="text-xs text-slate-400">
              접속 시 문서 분석 데모가 자동으로 1회 재생됩니다
            </span>
          </div>
        )}
      </div>

      {/* 하단 액션 — 높이를 항상 고정해 완료 시 카드 크기가 변하지 않게 */}
      <div
        className={cn(
          "flex items-center justify-end",
          expanded ? "mt-2 h-6" : "mt-1 h-4",
        )}
      >
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
function LandingPanel({ expanded = false }: { expanded?: boolean }) {
  const [revealHero] = useState(() => !heroRevealed);
  useEffect(() => {
    heroRevealed = true;
  }, []);

  return (
    <section
      className={cn(
        "relative overflow-hidden border border-white/60 bg-[linear-gradient(135deg,rgba(246,253,253,0.78)_0%,rgba(229,247,248,0.66)_48%,rgba(232,242,253,0.60)_100%)] px-6 shadow-[0_28px_80px_rgba(23,99,114,0.13)] ring-1 ring-cyan-100/45 backdrop-blur-[17px] sm:px-8 lg:min-h-[570px]",
        expanded
          ? "rounded-[36px] py-8 lg:min-h-[826px] lg:px-10 lg:py-8 xl:px-12 xl:py-8"
          : "rounded-[32px] py-5 lg:px-8 lg:py-5 xl:px-10 xl:py-6",
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[36px]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.44)_0%,rgba(229,249,248,0.20)_44%,rgba(224,239,252,0.16)_100%)]" />
        <div className="absolute -left-24 -top-28 size-72 rounded-full bg-cyan-300/14 blur-3xl" />
        <div className="absolute -bottom-32 right-[-4rem] size-80 rounded-full bg-blue-300/12 blur-3xl" />
        <div className="absolute left-[38%] top-[-18%] h-[55%] w-[22%] rotate-12 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.24),transparent)] blur-2xl" />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        <div
          className={cn(
            "font-semibold tracking-tight text-slate-950",
            expanded
              ? "text-[1.9rem] sm:text-[2.15rem]"
              : "text-[1.8rem] sm:text-[1.95rem]",
          )}
        >
          <span className="text-[#2F6FF2]">Pmate</span> AI
        </div>

        <div
          className={cn(
            "max-w-[720px]",
            expanded ? "mt-10 lg:mt-12" : "mt-7 lg:mt-7",
          )}
        >
          <h1
            className={cn(
              "font-bold text-[#0f172a]",
              expanded
                ? "text-[2.85rem] leading-[1.16] sm:text-[3.5rem] lg:text-[4rem]"
                : "text-[2.5rem] leading-[1.12] sm:text-[2.8rem] lg:text-[3rem]",
            )}
          >
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
          <p
            className={cn(
              "max-w-[620px] text-slate-700",
              expanded
                ? "mt-6 text-[1.18rem] leading-[1.7] sm:text-[1.2rem]"
                : "mt-4 text-[0.98rem] leading-[1.5] sm:text-base",
            )}
          >
            Pmate AI는 사업 문서를 분석해 요구사항을 체계화하여
            <br />
            PM과 팀의 업무를 효율화합니다.
            <br />
            일정·평가·리스크를 한눈에 관리하고,
            <br />
            프로젝트 성공 가능성을 높여 드립니다.
          </p>
        </div>

        {/* 데모 카드(왼쪽) + 기능 한 줄 3개(오른쪽) */}
        <div
          className={cn(
            "flex flex-col gap-5 lg:flex-row lg:items-stretch",
            expanded ? "mt-8 lg:mt-10 lg:gap-8" : "mt-6 lg:mt-7 lg:gap-6",
          )}
        >
          <LiveExtractDemo expanded={expanded} />

          {/* 세 기능을 각각 독립 카드로 분리해 데모 카드와 같은 시각적 위계를 구성 */}
          <div className="grid flex-1 grid-rows-3 gap-3 self-stretch">
            {LANDING_FEATURES.map((feature) => (
              <div
                key={feature.title}
                className={cn(
                  "group flex min-h-0 cursor-default items-center gap-3 rounded-2xl border border-sky-100/90 bg-white/82 shadow-[0_12px_30px_rgba(30,93,125,0.08)] backdrop-blur-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-sky-200 hover:bg-white hover:shadow-[0_16px_34px_rgba(30,93,125,0.12)]",
                  expanded ? "px-4 py-3.5" : "px-3.5 py-2.5",
                )}
              >
                <span
                  className={cn(
                    "flex shrink-0 items-center justify-center",
                    expanded ? "size-12" : "size-10",
                  )}
                >
                  <img
                    src={feature.icon}
                    alt=""
                    className={cn(
                      "object-contain drop-shadow-[0_8px_14px_rgba(45,126,160,0.14)] transition-transform duration-300 ease-out group-hover:scale-110",
                      expanded ? "size-11" : "size-9",
                    )}
                  />
                </span>
                <div className="min-w-0">
                  <div
                    className={cn(
                      "font-bold text-slate-900 transition-colors duration-200 group-hover:text-[#3A8FB6]",
                      expanded ? "text-[1.04rem]" : "text-[0.94rem]",
                    )}
                  >
                    {feature.title}
                  </div>
                  <div className="mt-0.5 truncate text-[13px] leading-5 text-slate-500">
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
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  mainClassName?: string;
  matchPanelHeight?: boolean;
  fitViewport?: boolean;
}

/** 좌측 소개 패널 + 우측 카드 2단 레이아웃 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  mainClassName,
  matchPanelHeight = false,
  fitViewport = false,
}: AuthShellProps) {
  const mainRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, height: 0 });

  useLayoutEffect(() => {
    if (!fitViewport) return;

    const updateFit = () => {
      const main = mainRef.current;
      const grid = gridRef.current;
      if (!main || !grid || window.innerWidth < 1024) {
        setFit({ scale: 1, height: 0 });
        return;
      }

      const styles = window.getComputedStyle(main);
      const verticalPadding =
        Number.parseFloat(styles.paddingTop) +
        Number.parseFloat(styles.paddingBottom);
      const naturalHeight = grid.scrollHeight;
      const availableHeight = Math.max(0, main.clientHeight - verticalPadding);

      // 아직 레이아웃이 잡히기 전(높이 0)에 재면 scale이 0이 되어 화면 전체가
      // transform: scale(0)으로 사라진다. 새로고침하면 보이던 이유가 이것.
      // 측정값이 유효하지 않으면 축소하지 않고 원본 크기로 둔다.
      if (naturalHeight <= 0 || availableHeight <= 0) {
        setFit({ scale: 1, height: 0 });
        return;
      }

      const rawScale = availableHeight / naturalHeight;
      if (!Number.isFinite(rawScale) || rawScale <= 0) {
        setFit({ scale: 1, height: 0 });
        return;
      }

      const scale = Math.min(1, rawScale);
      setFit({ scale, height: naturalHeight * scale });
    };

    updateFit();

    // 폰트·이미지가 늦게 들어오면 높이가 바뀌므로 페인트 후 한 번 더 잰다.
    const raf = requestAnimationFrame(() => requestAnimationFrame(updateFit));
    document.fonts?.ready.then(updateFit).catch(() => {});

    const observer = new ResizeObserver(updateFit);
    if (mainRef.current) observer.observe(mainRef.current);
    if (gridRef.current) observer.observe(gridRef.current);
    if (footerRef.current) observer.observe(footerRef.current);
    window.addEventListener("resize", updateFit);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", updateFit);
    };
  }, [fitViewport]);

  return (
    <div
      className={cn(
        "relative flex min-h-screen flex-col overflow-hidden bg-[#eef9fb]",
        fitViewport && "lg:h-screen lg:min-h-0",
      )}
    >
      <style>{`
        @keyframes pmate-login-drift {
          0% {
            transform: scale(1.035) translate3d(-0.6%, -0.45%, 0);
          }
          48% {
            transform: scale(1.075) translate3d(0.75%, 0.5%, 0);
          }
          100% {
            transform: scale(1.045) translate3d(-0.25%, 0.9%, 0);
          }
        }

        @keyframes pmate-login-wave-one {
          0%, 100% {
            transform: translate3d(-8%, -3%, 0) scale(0.96) rotate(-4deg);
            opacity: 0.34;
          }
          50% {
            transform: translate3d(7%, 5%, 0) scale(1.09) rotate(5deg);
            opacity: 0.52;
          }
        }

        @keyframes pmate-login-wave-two {
          0%, 100% {
            transform: translate3d(8%, 3%, 0) scale(1.05) rotate(4deg);
            opacity: 0.24;
          }
          50% {
            transform: translate3d(-7%, -5%, 0) scale(0.94) rotate(-5deg);
            opacity: 0.42;
          }
        }

        @keyframes pmate-login-sheen {
          0% {
            transform: translate3d(-9%, 0, 0) skewX(-8deg);
            opacity: 0.10;
          }
          50% {
            opacity: 0.23;
          }
          100% {
            transform: translate3d(9%, 0, 0) skewX(8deg);
            opacity: 0.10;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .pmate-login-bg-image,
          .pmate-login-wave-one,
          .pmate-login-wave-two,
          .pmate-login-sheen {
            animation: none !important;
            transform: none !important;
          }
        }
      `}</style>

      {/* 생성한 프로젝트 관리 일러스트를 로그인 페이지 전체 배경으로 사용 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="pmate-login-bg-image absolute -inset-[4%] bg-cover bg-center will-change-transform"
          style={{
            backgroundImage: `url(${loginPageBackground})`,
            animation: "pmate-login-drift 24s ease-in-out infinite alternate",
          }}
        />

        {/* 배경이 너무 정적으로 보이지 않도록 아주 느린 일렁임을 겹친다. */}
        <div
          className="pmate-login-wave-one absolute -left-[14%] top-[4%] h-[76%] w-[64%] rounded-[48%] bg-[radial-gradient(ellipse_at_center,rgba(71,188,191,0.24)_0%,rgba(94,190,215,0.12)_45%,transparent_72%)] blur-3xl will-change-transform"
          style={{ animation: "pmate-login-wave-one 18s ease-in-out infinite" }}
        />
        <div
          className="pmate-login-wave-two absolute -right-[12%] bottom-[-16%] h-[78%] w-[60%] rounded-[48%] bg-[radial-gradient(ellipse_at_center,rgba(113,99,210,0.18)_0%,rgba(66,173,194,0.10)_48%,transparent_73%)] blur-3xl will-change-transform"
          style={{ animation: "pmate-login-wave-two 21s ease-in-out infinite" }}
        />
        <div
          className="pmate-login-sheen absolute -inset-y-[18%] left-[22%] w-[28%] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.34),transparent)] blur-2xl will-change-transform"
          style={{ animation: "pmate-login-sheen 16s ease-in-out infinite alternate" }}
        />

        {/* 로그인 카드/문구 가독성을 유지하되 새 일러스트는 충분히 보이도록 최소한의 wash만 적용 */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(241,250,251,0.22)_0%,rgba(245,251,252,0.10)_52%,rgba(238,248,250,0.18)_100%)]" />
      </div>
      <div
        ref={mainRef}
        className={cn(
          "relative z-10 mx-auto flex w-full max-w-[1560px] flex-1 items-center px-4 py-2 sm:px-6",
          fitViewport && "lg:min-h-0",
          mainClassName,
        )}
      >
        <div
          className="w-full"
          style={
            fitViewport && fit.height > 0 ? { height: `${fit.height}px` } : undefined
          }
        >
          <div
            ref={gridRef}
            className={cn(
              "relative grid w-full items-center gap-8 lg:top-3 lg:grid-cols-[minmax(0,1.65fr)_minmax(460px,1fr)] lg:gap-12 xl:top-4 xl:gap-16",
              matchPanelHeight && "lg:items-stretch",
            )}
            style={
              // scale이 0이나 NaN으로 새면 화면이 통째로 사라지므로 유효 범위만 적용
              fitViewport && fit.scale > 0 && fit.scale < 1
                ? {
                    transform: `scale(${fit.scale})`,
                    transformOrigin: "center top",
                  }
                : undefined
            }
          >
            <LandingPanel expanded={matchPanelHeight} />

            <div className="flex items-center justify-center lg:justify-end">
              <div className="relative w-full max-w-[520px] overflow-hidden rounded-[28px] border border-white/70 bg-[linear-gradient(145deg,rgba(255,255,255,0.91)_0%,rgba(239,250,250,0.86)_58%,rgba(240,244,253,0.82)_100%)] px-6 py-5 shadow-[0_30px_90px_rgba(13,75,96,0.18)] ring-1 ring-cyan-100/45 backdrop-blur-[18px] sm:px-8 sm:py-5">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute -right-20 -top-24 size-56 rounded-full bg-cyan-300/12 blur-3xl" />
                <div className="absolute -bottom-24 -left-16 size-52 rounded-full bg-violet-300/10 blur-3xl" />
                <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent" />
              </div>
              <div className="relative z-10">
              <div className="mx-auto mb-4 flex w-fit items-center gap-3">
                <div
                  className="flex size-10 items-center justify-center rounded-xl border border-white/55 text-white shadow-[0_12px_30px_rgba(57,135,177,0.22)]"
                  style={{ backgroundColor: LOGIN_BLUE }}
                >
                  <Sparkles className="size-5" />
                </div>
                <span className="text-[1.8rem] font-semibold text-slate-900">
                  Pmate AI
                </span>
              </div>

              <div className="mb-4 text-center">
                <h1 className="text-[1.85rem] font-bold text-[#18343d]">{title}</h1>
                {subtitle ? <p className="mt-1.5 text-base text-slate-500">{subtitle}</p> : null}
              </div>

                {children}

                {footer ? <div className="mt-4">{footer}</div> : null}
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div ref={footerRef} className="relative z-10 shrink-0">
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
  description?: string;
}

export function RoleCard({
  active,
  disabled = false,
  onClick,
  icon,
  title,
  description,
}: RoleCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative overflow-hidden rounded-xl border px-3.5 py-3 text-left transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-80",
        active
          ? "translate-y-[-1px] border-[#62A8CF] bg-gradient-to-br from-[#F3FAFE] to-[#EFFBFA] shadow-[0_12px_26px_rgba(69,145,180,0.14)] ring-1 ring-[#CDE8F2]"
          : "border-slate-200 bg-white/90 hover:border-[#A9D2E4] hover:bg-[#F8FCFE] hover:shadow-[0_10px_20px_rgba(30,93,125,0.07)]",
      )}
    >
      <div
        className={cn(
          "absolute inset-0 opacity-0 transition-opacity duration-200",
          active
            ? "bg-[radial-gradient(circle_at_top_left,_rgba(79,159,216,0.11),_transparent_58%)] opacity-100"
            : "group-hover:opacity-100 bg-[radial-gradient(circle_at_top_left,_rgba(79,159,216,0.06),_transparent_58%)]",
        )}
      />
      <div className="relative flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-lg transition-all duration-200",
            active
              ? "bg-gradient-to-br from-[#5B9FE8] to-[#55B5C8] text-white shadow-[0_8px_18px_rgba(79,159,216,0.24)]"
              : "bg-slate-100 text-slate-500 group-hover:bg-sky-50 group-hover:text-[#3A8FB6]",
          )}
        >
          {icon}
        </span>
        <span className="min-w-0">
          <span
            className={cn(
              "block text-[1.02rem] font-semibold transition-colors duration-200",
              active ? "text-slate-950" : "text-slate-900",
            )}
          >
            {title}
          </span>
          {description ? (
            <span className="mt-0.5 block truncate text-xs text-slate-500">
              {description}
            </span>
          ) : null}
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
      className="h-11 w-full rounded-2xl text-base font-semibold text-white shadow-[0_14px_30px_rgba(79,159,216,0.24)] transition-all hover:-translate-y-0.5 hover:brightness-[0.98] hover:shadow-[0_17px_34px_rgba(71,151,194,0.28)] disabled:translate-y-0 disabled:opacity-60"
      style={{ background: "linear-gradient(90deg, #6DAAF0 0%, #61A9E3 48%, #5DBBC9 100%)" }}
    >
      {children}
    </button>
  );
}