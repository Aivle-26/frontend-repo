/**
 * Slack 커뮤니케이션 리스크 API 클라이언트.
 *
 * 구조:
 *   프론트 ──(projectId)──▶ 백엔드(Spring) ──(messages[])──▶ AI 서버(FastAPI)
 *
 * AI 서버(`POST /api/v1/risk/communication/analyze`)는 Slack에 직접 접속하지 않는
 * 무상태 분석기다. Slack 토큰 보관, projectId↔채널 매핑, 메시지 증분 수집은
 * 전부 백엔드 책임이므로 프론트는 projectId만 보낸다.
 *
 * 백엔드 규격(제안 — 확정 전):
 *   GET  /api/projects/{projectId}/communication-risks          최신 분석 결과 조회
 *   POST /api/projects/{projectId}/communication-risks/refresh  재분석 요청(202)
 *
 * 응답 필드는 AI 서버의 CommunicationRiskResponse를 그대로 옮기되,
 * Spring Jackson 기본 동작에 맞춰 camelCase로 가정했다.
 * (스키마 협의 문서: docs/API-커뮤니케이션리스크-스펙초안.md)
 */

const API_BASE: string =
  (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_COMMUNICATION_RISK_API || "http://localhost:8080";

/** AI 서버 판정 등급. 화면 표기는 severityLabel()로 변환한다. */
export type CommunicationRiskLevel = "HIGH" | "MEDIUM" | "LOW";

/**
 * LLM 사용 여부. AI 서버는 OPENAI_API_KEY가 없어도 규칙 기반으로 동작하며,
 * 이때 SKIPPED_NO_API_KEY를 반환한다(정상 응답이지 오류가 아님).
 */
export type LlmStatus =
  | "SUCCEEDED"
  | "SKIPPED_NO_API_KEY"
  | "FALLBACK"
  | "DISABLED";

/** 아직 한 번도 분석하지 않은 프로젝트가 있으므로 상태 구분이 필요하다. */
export type AnalysisStatus = "COMPLETED" | "PENDING" | "NEVER_ANALYZED";

export interface EvidenceMessage {
  channelId: string;
  channelName: string;
  /** ISO 8601 */
  messageTs: string;
  threadTs: string | null;
  messageText: string;
}

export interface CommunicationMetrics {
  recent7dMessageCount: number;
  previous7dMessageCount: number;
  /** 이전 7일 메시지가 0건이면 계산 불가라 null이 온다. */
  activityChangePercent: number | null;
  longUnansweredCount: number;
}

export interface AnalysisWindow {
  /** ISO 8601 */
  start: string;
  /** ISO 8601 */
  end: string;
}

export interface CommunicationRiskResult {
  projectId: string;
  projectName: string | null;
  status: AnalysisStatus;
  riskLevel: CommunicationRiskLevel;
  /** AI 서버가 최대 3건까지 반환한다. */
  reasons: string[];
  /** AI 서버가 최대 3건까지 반환한다. */
  evidenceMessages: EvidenceMessage[];
  recommendedAction: string;
  metrics: CommunicationMetrics;
  analysisWindow: AnalysisWindow;
  llmStatus: LlmStatus;
  /** 백엔드가 분석 결과를 저장한 시각. 마지막 갱신 표시에 사용. */
  analyzedAt: string | null;
}

export class CommunicationRiskApiError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status = 500, code: string | null = null) {
    super(message);
    this.name = "CommunicationRiskApiError";
    this.status = status;
    this.code = code;
  }
}

type ApiErrorPayload = {
  status?: number;
  code?: string | null;
  message?: string;
};

async function parseError(res: Response): Promise<CommunicationRiskApiError> {
  let payload: ApiErrorPayload = {};
  try {
    payload = (await res.json()) as ApiErrorPayload;
  } catch {
    /* 본문이 비었거나 JSON이 아닌 경우 무시 */
  }
  return new CommunicationRiskApiError(
    payload.message || `요청에 실패했습니다. (${res.status})`,
    payload.status ?? res.status,
    payload.code ?? null,
  );
}

/** 인증 토큰이 있으면 실어 보낸다. Slack session은 백엔드가 들고 있으므로 보내지 않는다. */
function authHeaders(accessToken?: string | null): HeadersInit {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

export const communicationRiskApi = {
  apiBase: API_BASE,

  /** 최신 분석 결과 조회. 분석 이력이 없으면 status: "NEVER_ANALYZED"로 온다. */
  async get(
    projectId: string,
    accessToken?: string | null,
  ): Promise<CommunicationRiskResult> {
    const res = await fetch(
      `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/communication-risks`,
      { headers: authHeaders(accessToken) },
    );
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as CommunicationRiskResult;
  },

  /**
   * 재분석 요청. 백엔드가 마지막 수집 시점 이후의 새 Slack 메시지만 증분 수집한 뒤
   * AI 서버로 넘긴다. 새 메시지가 없으면 백엔드가 재분석을 건너뛰고 기존 결과를 준다.
   */
  async refresh(
    projectId: string,
    accessToken?: string | null,
  ): Promise<CommunicationRiskResult> {
    const res = await fetch(
      `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/communication-risks/refresh`,
      { method: "POST", headers: authHeaders(accessToken) },
    );
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as CommunicationRiskResult;
  },
};

/* ------------------------------------------------------------------ */
/* 표시용 변환 헬퍼                                                     */
/* ------------------------------------------------------------------ */

/** AI 서버 등급 → 화면 문구. 기존 리스크 카드의 심각/주의/정보 체계와 맞춘다. */
export function severityLabel(level: CommunicationRiskLevel): string {
  const map: Record<CommunicationRiskLevel, string> = {
    HIGH: "심각",
    MEDIUM: "주의",
    LOW: "정보",
  };
  return map[level];
}

export function severityTone(level: CommunicationRiskLevel): string {
  const map: Record<CommunicationRiskLevel, string> = {
    HIGH: "bg-red-50 text-red-700 border-red-200",
    MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
    LOW: "bg-blue-50 text-blue-700 border-blue-200",
  };
  return map[level];
}

/** llmStatus를 사용자에게 보여줄 문구로. null이면 표시하지 않는다. */
export function llmStatusLabel(status: LlmStatus): string | null {
  const map: Record<LlmStatus, string | null> = {
    SUCCEEDED: null, // 정상 동작은 굳이 알릴 필요 없음
    SKIPPED_NO_API_KEY: "규칙 기반 분석 (LLM 키 미설정)",
    FALLBACK: "규칙 기반 분석 (LLM 호출 실패)",
    DISABLED: "규칙 기반 분석 (LLM 비활성)",
  };
  return map[status];
}

/**
 * 백엔드 연결 전 화면 확인용 더미.
 * 실제 연동이 끝나면 이 상수와 사용처를 삭제할 것.
 */
export const DEMO_COMMUNICATION_RISK: CommunicationRiskResult = {
  projectId: "prj-launch",
  projectName: "신제품 출시 프로젝트",
  status: "COMPLETED",
  riskLevel: "MEDIUM",
  reasons: [
    "최근 7일 대화량이 이전 7일 대비 62.5% 감소했습니다.",
    "질문 또는 멘션 메시지 2건이 24시간 이상 미응답입니다.",
  ],
  evidenceMessages: [
    {
      channelId: "C-PROJECT",
      channelName: "project-backend",
      messageTs: "2026-07-19T06:12:00+09:00",
      threadTs: null,
      messageText: "결제 API 배포가 blocker 상태입니다. 담당자 확인 부탁드립니다.",
    },
    {
      channelId: "C-PROJECT",
      channelName: "project-frontend",
      messageTs: "2026-07-18T17:40:00+09:00",
      threadTs: null,
      messageText: "회원가입 화면 QA 일정 언제로 잡을까요?",
    },
  ],
  recommendedAction: "미응답 스레드와 최근 업무 진행 상태를 확인하세요.",
  metrics: {
    recent7dMessageCount: 9,
    previous7dMessageCount: 24,
    activityChangePercent: -62.5,
    longUnansweredCount: 2,
  },
  analysisWindow: {
    start: "2026-07-13T00:00:00+09:00",
    end: "2026-07-20T00:00:00+09:00",
  },
  llmStatus: "SKIPPED_NO_API_KEY",
  analyzedAt: "2026-07-20T10:45:00+09:00",
};
