/**
 * 산출물 보안 검사 API 클라이언트.
 *
 * 구조:
 *   프론트 ──(텍스트)──▶ 백엔드(Spring) ──▶ AI 서버(FastAPI)
 *
 * 백엔드(`POST /api/projects/{projectId}/deliverables/{deliverableId}/security-check`)가
 * 산출물 본문을 AI 서버(`/api/v1/risk/artifact-security`)로 넘겨
 * 개인정보·인증정보 탐지, 마스킹, 등록 가능 여부를 돌려준다.
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

export type SecurityRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface SecurityDetection {
  detectionType: string;
  count: number;
  description: string;
}

/** 프론트가 보내는 검사 입력. */
export interface SecurityCheckInput {
  artifactName: string;
  artifactType: string;
  textContent: string;
}

/** 백엔드 SecurityCheckResponse (camelCase). */
export interface SecurityCheckResult {
  projectId: number;
  artifactName: string;
  securityRiskScore: number;
  securityRiskLevel: SecurityRiskLevel;
  registrationAllowed: boolean;
  detections: SecurityDetection[];
  maskedContent: string;
  recommendations: string[];
}

export class SecurityCheckApiError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status = 500, code: string | null = null) {
    super(message);
    this.name = "SecurityCheckApiError";
    this.status = status;
    this.code = code;
  }
}

type ApiErrorPayload = { status?: number; code?: string | null; message?: string };

async function parseError(res: Response): Promise<SecurityCheckApiError> {
  let payload: ApiErrorPayload = {};
  try {
    payload = (await res.json()) as ApiErrorPayload;
  } catch {
    /* 본문이 비었거나 JSON이 아닌 경우 무시 */
  }
  return new SecurityCheckApiError(
    payload.message || `요청에 실패했습니다. (${res.status})`,
    payload.status ?? res.status,
    payload.code ?? null,
  );
}

function authHeaders(accessToken?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

export const securityCheckApi = {
  apiBase: API_BASE,

  /**
   * 산출물 보안 검사. deliverableId는 REST 리소스 식별자이며,
   * 아직 저장된 산출물과 연결 전이라 임의 값(기본 1)을 써도 된다.
   */
  async check(
    projectId: string,
    deliverableId: number,
    input: SecurityCheckInput,
    accessToken?: string | null,
  ): Promise<SecurityCheckResult> {
    const res = await fetch(
      `${API_BASE}/api/projects/${encodeURIComponent(resolveProjectId(projectId))}/deliverables/${deliverableId}/security-check`,
      { method: "POST", headers: authHeaders(accessToken), body: JSON.stringify(input) },
    );
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as SecurityCheckResult;
  },
};

/* ------------------------------------------------------------------ */
/* 표시용 헬퍼                                                          */
/* ------------------------------------------------------------------ */

/** 탐지 유형 코드 → 한글 라벨. */
export function detectionLabel(type: string): string {
  const map: Record<string, string> = {
    PHONE_NUMBER: "전화번호",
    EMAIL: "이메일",
    RESIDENT_NUMBER: "주민등록번호",
    API_KEY: "API 키",
    PRIVATE_IP: "사설 IP",
    PRIVATE_KEY: "Private Key",
  };
  return map[type] ?? type;
}

/** 탐지 유형별 강조 톤 (민감도 높은 항목은 danger). */
export function detectionTone(type: string): string {
  const high = new Set(["RESIDENT_NUMBER", "API_KEY", "PRIVATE_KEY"]);
  return high.has(type)
    ? "bg-red-50 text-red-700 border-red-200"
    : "bg-amber-50 text-amber-700 border-amber-200";
}

export function riskLevelLabel(level: SecurityRiskLevel): string {
  const map: Record<SecurityRiskLevel, string> = {
    CRITICAL: "매우 높음",
    HIGH: "높음",
    MEDIUM: "보통",
    LOW: "낮음",
  };
  return map[level];
}

export function riskLevelTone(level: SecurityRiskLevel): string {
  const map: Record<SecurityRiskLevel, string> = {
    CRITICAL: "bg-red-100 text-red-800 border-red-300",
    HIGH: "bg-red-50 text-red-700 border-red-200",
    MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
    LOW: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  return map[level];
}
