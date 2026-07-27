/**
 * 담당자 재배정 추천 API 클라이언트.
 *
 * 구조:
 *   프론트 ──(projectId, assignmentId)──▶ 백엔드(Spring) ──▶ AI 서버(FastAPI)
 *
 * 백엔드(`POST /api/projects/{projectId}/assignments/{assignmentId}`)가
 * 현재 담당자·후보 데이터를 붙여 AI 서버(`/api/v1/risk/assignee-reassignment`)로 넘긴다.
 * 지금은 사람 데이터가 백엔드 DB의 더미 팀원에서 오므로, 프론트는 body 없이
 * projectId + assignmentId(업무 id)만 보내면 된다.
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

export interface CandidateResult {
  memberId: number;
  memberName: string;
  matchScore: number;
  skillMatchRate: number;
  workloadRate: number;
  overdueTaskCount: number;
  reason: string;
}

/** 백엔드 ReassignmentResponse (camelCase). */
export interface ReassignmentResult {
  projectId: number;
  taskId: number;
  reassignmentRequired: boolean;
  currentAssigneeRiskScore: number;
  currentAssigneeRiskLevel: RiskLevel;
  /** 추천 후보가 없으면 null. */
  recommendedAssignee: CandidateResult | null;
  alternativeCandidates: CandidateResult[];
  reasons: string[];
}

export class ReassignmentApiError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status = 500, code: string | null = null) {
    super(message);
    this.name = "ReassignmentApiError";
    this.status = status;
    this.code = code;
  }
}

type ApiErrorPayload = { status?: number; code?: string | null; message?: string };

async function parseError(res: Response): Promise<ReassignmentApiError> {
  let payload: ApiErrorPayload = {};
  try {
    payload = (await res.json()) as ApiErrorPayload;
  } catch {
    /* 본문이 비었거나 JSON이 아닌 경우 무시 */
  }
  return new ReassignmentApiError(
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

export const reassignmentApi = {
  apiBase: API_BASE,

  /**
   * 재배정 추천. body 없이 호출하면 백엔드가 DB의 더미 팀원 로스터로 추천한다.
   * (실제 assignment 도메인이 생기면 백엔드가 그 데이터로 교체)
   */
  async recommend(
    projectId: string,
    assignmentId: number,
    accessToken?: string | null,
  ): Promise<ReassignmentResult> {
    const res = await fetch(
      `${API_BASE}/api/projects/${encodeURIComponent(resolveProjectId(projectId))}/assignments/${assignmentId}`,
      { method: "POST", headers: authHeaders(accessToken) },
    );
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as ReassignmentResult;
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
