import type { StoredAuthSession } from "@/app/auth/authSession";

const API_BASE: string =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_AUTH_API ||
  "http://localhost:8080";

type ApiErrorPayload = {
  status?: number;
  code?: string | null;
  message?: string;
};

type AuthSessionPayload = {
  authenticated: boolean;
  employeeNumber: string;
  name: string;
  role: string;
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: number;
  absoluteExpiresAt: number;
  lastActivityAt: number;
  serverTime: number;
  inactivityTimeoutMinutes: number;
};

export class AuthApiError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status = 500, code: string | null = null) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
    this.code = code;
  }
}

export interface LoginRequestPayload {
  email: string;
  password: string;
  role: string;
}

export interface LoginResponsePayload {
  success: boolean;
  verificationRequired: boolean;
  message: string;
  expiresIn: number;
}

export interface LoginVerifyRequestPayload {
  email: string;
  verificationCode: string;
}

export interface LoginVerifyResponsePayload {
  success: boolean;
  message: string;
  employeeNumber: string;
  name: string;
  role: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  absoluteExpiresAt: number;
  lastActivityAt: number;
  serverTime: number;
  inactivityTimeoutMinutes: number;
}

export interface LoginResendRequestPayload {
  email: string;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = "서버 연결 실패";
    let status = response.status;
    let code: string | null = null;

    try {
      const data = (await response.json()) as ApiErrorPayload;
      message = data.message || message;
      status = data.status ?? status;
      code = data.code ?? null;
    } catch {
      /* ignore */
    }

    throw new AuthApiError(message, status, code);
  }

  return (await response.json()) as T;
}

function post<T>(path: string, payload: unknown, token?: string): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
}

function get<T>(path: string, token: string): Promise<T> {
  return request<T>(path, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function mapSessionPayload(payload: AuthSessionPayload): StoredAuthSession {
  return {
    employeeNumber: payload.employeeNumber,
    name: payload.name,
    role: payload.role.trim().toUpperCase() === "PM" ? "pm" : "staff",
    accessToken: payload.accessToken ?? "",
    refreshToken: payload.refreshToken ?? "",
    accessTokenExpiresAt: payload.accessTokenExpiresAt,
    absoluteExpiresAt: payload.absoluteExpiresAt,
    lastActivityAt: payload.lastActivityAt,
    serverTime: payload.serverTime,
    inactivityTimeoutMinutes: payload.inactivityTimeoutMinutes,
  };
}

export const authApi = {
  login: (payload: LoginRequestPayload) =>
    post<LoginResponsePayload>("/api/users/login", payload),
  verifyLogin: (payload: LoginVerifyRequestPayload) =>
    post<LoginVerifyResponsePayload>("/api/users/login/verify", payload),
  resendLoginCode: (payload: LoginResendRequestPayload) =>
    post<LoginResponsePayload>("/api/users/login/resend", payload),
  getSession: (accessToken: string) => get<AuthSessionPayload>("/api/users/session", accessToken),
  refresh: (refreshToken: string) =>
    post<AuthSessionPayload>("/api/users/refresh", { refreshToken }),
  reportActivity: (accessToken: string) =>
    post<{ message: string }>("/api/users/activity", {}, accessToken),
  logout: (accessToken: string | null, refreshToken: string | null) =>
    post<{ message: string }>(
      "/api/users/logout",
      { refreshToken },
      accessToken ?? undefined,
    ),
};
