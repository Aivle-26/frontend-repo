/**
 * 프로젝트 조정 여부 평가(요구사항 변경 영향도) API 클라이언트.
 *
 * 구조:
 *   프론트 ──(변경 정보 + projectId)──▶ 백엔드(Spring) ──▶ AI 서버(FastAPI)
 *
 * 백엔드(`POST /api/projects/{projectId}/impact-analysis`)가 변경 정보를 받아
 * AI 서버(`/api/v1/risk/impact-assessment`)로 넘기고, 영향도 점수·등급·권고를 돌려준다.
 * 응답 필드는 Spring Jackson 기본 동작에 맞춰 camelCase다.
 *
 * 로컬/배포 환경 처리는 communicationRiskApi.ts와 동일한 규약을 따른다.
 */

// 배포(vercel.json)는 /api/* 를 EC2로 넘기므로 env 없이 상대경로가 프록시를 탄다.
// 로컬은 프록시가 없으니 VITE_COMMUNICATION_RISK_API(=http://localhost:8080)를 지정한다.
const API_BASE: string =
  (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_COMMUNICATION_RISK_API || "";

// 프론트 프로젝트 목록이 아직 데모라, 백엔드 숫자 projectId(로컬 시드=1)로 고정한다.
const OVERRIDE_PROJECT_ID: string | undefined =
  (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_COMMUNICATION_RISK_PROJECT_ID;

function resolveProjectId(projectId: string): string {
  return OVERRIDE_PROJECT_ID ?? projectId;
}

/** AI 서버 영향도 등급. */
export type ImpactLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** 프론트가 화면 폼에서 입력해 보내는 변경 정보. projectId는 경로로 나가므로 여기 없다. */
export interface ImpactAnalysisInput {
  /** 특정 요구사항 변경을 평가할 때만. 아니면 생략(null). */
  requirementId?: number | null;
  changeTitle: string;
  changeDescription: string;
  affectedTaskCount: number;
  affectedMemberCount: number;
  remainingDays: number;
  additionalWorkDays: number;
  scopeChanged: boolean;
  databaseChanged: boolean;
  apiChanged: boolean;
  uiChanged: boolean;
  /**
   * true("AI 분석"): 백엔드가 확정 WBS를 모아 AI로 수치를 자동 산출.
   * false("평가하기"): 위 수동 수치로 규칙 계산. 생략 시 백엔드가 AI 경로를 기본으로 한다.
   */
  useLlm?: boolean;
}

/** AI 서버 영향 유형. */
export type ImpactType = "DIRECT" | "INDIRECT" | "NONE";

/** AI 서버 LLM 처리 상태. */
export type LlmStatus =
  | "SUCCEEDED"
  | "SKIPPED_NO_API_KEY"
  | "FALLBACK"
  | "DISABLED";

/** AI가 식별한 영향 태스크. */
export interface AffectedTask {
  taskId: number;
  taskName: string;
  impactType: ImpactType;
  additionalWorkDays: number;
  reason: string;
}

/** 백엔드 ImpactAnalysisResponse (camelCase). */
export interface ImpactAnalysisResult {
  projectId: number;
  requirementId: number | null;
  /** 종합 영향도 점수 0~100. */
  impactScore: number;
  impactLevel: ImpactLevel;
  scheduleImpactScore: number;
  scopeImpactScore: number;
  resourceImpactScore: number;
  technicalImpactScore: number;
  riskFactors: string[];
  recommendedActions: string[];

  // --- AI 산출 결과 (llmStatus=SUCCEEDED일 때 AI 자동 산출값) ---
  llmStatus: LlmStatus;
  aiSummary: string | null;
  affectedTaskCount: number;
  affectedMemberCount: number;
  remainingDays: number;
  additionalWorkDays: number;
  scopeChanged: boolean;
  databaseChanged: boolean;
  apiChanged: boolean;
  uiChanged: boolean;
  affectedTasks: AffectedTask[];
}

export class ImpactAnalysisApiError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status = 500, code: string | null = null) {
    super(message);
    this.name = "ImpactAnalysisApiError";
    this.status = status;
    this.code = code;
  }
}

type ApiErrorPayload = {
  status?: number;
  code?: string | null;
  message?: string;
};

async function parseError(res: Response): Promise<ImpactAnalysisApiError> {
  let payload: ApiErrorPayload = {};
  try {
    payload = (await res.json()) as ApiErrorPayload;
  } catch {
    /* 본문이 비었거나 JSON이 아닌 경우 무시 */
  }
  return new ImpactAnalysisApiError(
    payload.message || `요청에 실패했습니다. (${res.status})`,
    payload.status ?? res.status,
    payload.code ?? null,
  );
}

/** 인증 토큰이 있으면 실어 보낸다. /api/projects/** 는 인증이 필요하다. */
function authHeaders(accessToken?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

export const impactAnalysisApi = {
  apiBase: API_BASE,

  /** 변경 정보를 보내 영향도 평가 결과를 받는다. */
  async analyze(
    projectId: string,
    input: ImpactAnalysisInput,
    accessToken?: string | null,
  ): Promise<ImpactAnalysisResult> {
    const res = await fetch(
      `${API_BASE}/api/projects/${encodeURIComponent(resolveProjectId(projectId))}/impact-analysis`,
      {
        method: "POST",
        headers: authHeaders(accessToken),
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as ImpactAnalysisResult;
  },
};

/* ------------------------------------------------------------------ */
/* 표시용 변환 헬퍼                                                     */
/* ------------------------------------------------------------------ */

/** AI 서버 등급 → 화면 문구. */
export function impactLevelLabel(level: ImpactLevel): string {
  const map: Record<ImpactLevel, string> = {
    CRITICAL: "매우 높음",
    HIGH: "높음",
    MEDIUM: "보통",
    LOW: "낮음",
  };
  return map[level];
}

/** 등급별 배지 톤 (tailwind 클래스). */
export function impactLevelTone(level: ImpactLevel): string {
  const map: Record<ImpactLevel, string> = {
    CRITICAL: "bg-red-100 text-red-800 border-red-300",
    HIGH: "bg-red-50 text-red-700 border-red-200",
    MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
    LOW: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
  return map[level];
}
