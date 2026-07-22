/**
 * 로그인 세션에서 accessToken을 읽는 공용 헬퍼.
 *
 * 실제 로그인(projectRepository.ts)은 세션을 localStorage 키 "aipm.authSession"에
 * 저장한다. 커뮤니케이션 리스크/채널 API도 이 토큰을 그대로 써야 인증이 통과한다.
 * (authSession.ts의 "app-auth-session"과는 다른 저장소이므로 섞지 말 것)
 */

const AUTH_SESSION_KEY = "aipm.authSession";

interface StoredSessionShape {
  accessToken?: unknown;
  absoluteExpiresAt?: unknown;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) {
      return null;
    }
    const session = JSON.parse(raw) as StoredSessionShape;
    // 만료된 세션은 토큰이 있어도 401이 나므로 걸러낸다.
    if (
      typeof session.absoluteExpiresAt === "number" &&
      session.absoluteExpiresAt <= Date.now()
    ) {
      return null;
    }
    return typeof session.accessToken === "string" && session.accessToken.trim()
      ? session.accessToken
      : null;
  } catch {
    return null;
  }
}
