export type LogoutReason = "manual" | "expired" | "inactive";

export interface StoredAuthSession {
  employeeNumber: string;
  name: string;
  role: "pm" | "staff";
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  absoluteExpiresAt: number;
  lastActivityAt: number;
  serverTime: number;
  inactivityTimeoutMinutes: number;
}

export interface AuthSyncEvent {
  type: "login" | "logout" | "activity" | "session";
  reason?: LogoutReason;
  session?: StoredAuthSession | null;
  at: number;
}

const AUTH_STORAGE_KEY = "app-auth-session";
const AUTH_EVENT_KEY = "app-auth-event";
const AUTH_CHANNEL_NAME = "app-auth-channel";

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return null;
  }
  return new BroadcastChannel(AUTH_CHANNEL_NAME);
}

export function loadAuthSession(): StoredAuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as StoredAuthSession;
  } catch {
    return null;
  }
}

export function saveAuthSession(session: StoredAuthSession): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function broadcastAuthEvent(event: AuthSyncEvent): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_EVENT_KEY, JSON.stringify(event));
  getChannel()?.postMessage(event);
}

export function subscribeAuthEvents(listener: (event: AuthSyncEvent) => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== AUTH_EVENT_KEY || !event.newValue) {
      return;
    }

    try {
      listener(JSON.parse(event.newValue) as AuthSyncEvent);
    } catch {
      /* ignore */
    }
  };

  const channel = getChannel();
  const onChannelMessage = (event: MessageEvent<AuthSyncEvent>) => listener(event.data);

  window.addEventListener("storage", onStorage);
  channel?.addEventListener("message", onChannelMessage);

  return () => {
    window.removeEventListener("storage", onStorage);
    channel?.removeEventListener("message", onChannelMessage);
    channel?.close();
  };
}

export function isAbsoluteExpired(session: StoredAuthSession, now: number = Date.now()): boolean {
  return now >= session.absoluteExpiresAt;
}

export function isInactiveExpired(session: StoredAuthSession, now: number = Date.now()): boolean {
  return now >= session.lastActivityAt + session.inactivityTimeoutMinutes * 60_000;
}

export function withActivity(session: StoredAuthSession, lastActivityAt: number): StoredAuthSession {
  return {
    ...session,
    lastActivityAt,
  };
}
