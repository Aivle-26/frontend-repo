/**
 * 팀원별 업무 진행 지연 분석 API 클라이언트.
 *
 * 구조:
 *   프론트 ──(projectId)──▶ 백엔드(Spring) ──▶ AI 서버(FastAPI)
 *
 * 백엔드(`POST /api/projects/{projectId}/member-delay`)가 프로젝트 팀원들의
 * 업무 현황을 모아 AI 서버(`/api/v1/risk/member-delay`)로 넘기고, 팀원별
 * 지연 점수·등급·근거를 돌려준다. 사람 데이터는 백엔드 DB에서 나오므로
 * 프론트는 projectId만 보내면 된다(body 없음).
 */

const API_BASE: string =
  (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_COMMUNICATION_RISK_API || "";

const OVERRIDE_PROJECT_ID: string | undefined =
  (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_COMMUNICATION_RISK_PROJECT_ID;

function resolveProjectId(projectId: string): string {
  return OVERRIDE_PROJECT_ID ?? projectId;
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface MemberDelayItem {
  memberId: number;
  memberName: string;
  completionRate: number;
  overdueRate: number;
  delayScore: number;
  riskLevel: RiskLevel;
  reasons: string[];
  recommendedAction: string;
}

/** 백엔드 MemberDelayResponse (camelCase). */
export interface MemberDelayResult {
  projectId: number;
  analyzedMemberCount: number;
  highRiskMemberCount: number;
  memberResults: MemberDelayItem[];
}

export class MemberDelayApiError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status = 500, code: string | null = null) {
    super(message);
    this.name = "MemberDelayApiError";
    this.status = status;
    this.code = code;
  }
}

type ApiErrorPayload = { status?: number; code?: string | null; message?: string };

async function parseError(res: Response): Promise<MemberDelayApiError> {
  let payload: ApiErrorPayload = {};
  try {
    payload = (await res.json()) as ApiErrorPayload;
  } catch {
    /* 본문이 비었거나 JSON이 아닌 경우 무시 */
  }
  return new MemberDelayApiError(
    payload.message || `요청에 실패했습니다. (${res.status})`,
    payload.status ?? res.status,
    payload.code ?? null,
  );
}

function authHeaders(accessToken?: string | null): HeadersInit {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

export const memberDelayApi = {
  apiBase: API_BASE,

  /** 프로젝트 팀원들의 지연 분석 결과를 받는다. (body 없음) */
  async analyze(
    projectId: string,
    accessToken?: string | null,
  ): Promise<MemberDelayResult> {
    const res = await fetch(
      `${API_BASE}/api/projects/${encodeURIComponent(resolveProjectId(projectId))}/member-delay`,
      { method: "POST", headers: authHeaders(accessToken) },
    );
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as MemberDelayResult;
  },
};

/* ------------------------------------------------------------------ */
/* 표시용 헬퍼                                                          */
/* ------------------------------------------------------------------ */

export function riskLevelLabel(level: RiskLevel): string {
  const map: Record<RiskLevel, string> = {
    CRITICAL: "매우 높음",
    HIGH: "높음",
    MEDIUM: "보통",
    LOW: "낮음",
  };
  return map[level];
}

export function riskLevelTone(level: RiskLevel): string {
  const map: Record<RiskLevel, string> = {
    CRITICAL: "bg-red-100 text-red-800 border-red-300",
    HIGH: "bg-red-50 text-red-700 border-red-200",
    MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
    LOW: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  return map[level];
}
