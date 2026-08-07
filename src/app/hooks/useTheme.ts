import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "bidworks-theme";

export function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

/**
 * 지정한 화면에서만 라이트 테마를 강제한다.
 * 로그인/회원가입 화면은 다크모드 색상이 잡혀 있지 않아 글씨가 배경에 묻히므로,
 * 사용자의 테마 설정(localStorage)은 그대로 둔 채 표시만 라이트로 고정한다.
 * 화면을 벗어나면 저장돼 있던 사용자 테마로 되돌린다.
 */
export function useForcedLightTheme(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    applyTheme("light");
    return () => applyTheme(getInitialTheme());
  }, [enabled]);
}

/**
 * 테마(라이트/다크) 상태를 관리하는 훅.
 * - localStorage에 사용자의 선택을 저장해 새로고침/재접속 시에도 유지
 * - 선택값이 없으면 OS 설정(prefers-color-scheme)을 따름
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* 저장 불가 환경 무시 */
    }
  }, [theme]);

  // 다른 탭에서 테마를 바꾸면 동기화
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === "light" || e.newValue === "dark")) {
        setThemeState(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = (t: Theme) => setThemeState(t);
  const toggle = () => setThemeState((t) => (t === "dark" ? "light" : "dark"));

  return { theme, setTheme, toggle };
}
