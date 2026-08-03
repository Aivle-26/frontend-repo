/**
 * 프로젝트 AI 어시스턴트(통합 질의응답) API 클라이언트.
 *
 * 구조:
 *   프론트 ──(projectId, question)──▶ 백엔드(Spring) ──▶ AI 서버
 *   POST /api/projects/{projectId}/assistant/query
 *
 * 백엔드 응답 DTO(ProjectAssistantQueryResponse)는 @JsonProperty로 snake_case
 * (project_id, generated_at, llm_status, source.document_name ...)를 내보내므로
 * 원본을 받아 화면용 camelCase로 매핑한다.
 *
 * base URL / projectId 매핑은 커뮤니케이션 리스크 클라이언트와 동일한 규칙을 재사용한다.
 *   - 배포(vercel.json)는 /api/* 를 EC2로 프록시하므로 상대경로.
 *   - 로컬은 VITE_COMMUNICATION_RISK_API(=http://localhost:8080)로 절대경로.
 *   - 데모 slug id ↔ 백엔드 숫자 id 과도기 매핑은 VITE_COMMUNICATION_RISK_PROJECT_ID로 고정.
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

/** AI 서버는 OPENAI_API_KEY가 없어도 규칙 기반으로 동작한다(오류 아님). */
export type AssistantLlmStatus =
  | "SUCCEEDED"
  | "SKIPPED_NO_API_KEY"
  | "FALLBACK"
  | "DISABLED"
  | (string & {});

/** 답변 근거. 산출물/문서/요구사항/WBS 중 실제로 참조한 것만 채워져 온다. */
export interface AssistantSource {
  deliverableId: string | null;
  documentId: string | null;
  documentName: string | null;
  page: number | null;
  excerpt: string | null;
  requirementId: number | null;
  wbsId: number | null;
  reviewStatus: string | null;
}

export interface AssistantAnswer {
  projectId: number | null;
  answer: string;
  sources: AssistantSource[];
  /** ISO 8601 */
  generatedAt: string | null;
  llmStatus: AssistantLlmStatus;
}

export class AssistantApiError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status = 500, code: string | null = null) {
    super(message);
    this.name = "AssistantApiError";
    this.status = status;
    this.code = code;
  }
}

type ApiErrorPayload = { status?: number; code?: string | null; message?: string };

async function parseError(res: Response): Promise<AssistantApiError> {
  let payload: ApiErrorPayload = {};
  try {
    payload = (await res.json()) as ApiErrorPayload;
  } catch {
    /* 본문이 비었거나 JSON이 아닌 경우 무시 */
  }
  return new AssistantApiError(
    payload.message || `질문 처리에 실패했습니다. (${res.status})`,
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

/* 백엔드 원본(snake_case) */
interface RawSource {
  deliverable_id?: string | null;
  document_id?: string | null;
  document_name?: string | null;
  page?: number | null;
  excerpt?: string | null;
  requirement_id?: number | null;
  wbs_id?: number | null;
  review_status?: string | null;
}
interface RawAnswer {
  project_id?: number | null;
  answer?: string;
  sources?: RawSource[] | null;
  generated_at?: string | null;
  llm_status?: string;
}

function mapAnswer(raw: RawAnswer): AssistantAnswer {
  return {
    projectId: raw.project_id ?? null,
    answer: raw.answer ?? "",
    sources: (raw.sources ?? []).map((s) => ({
      deliverableId: s.deliverable_id ?? null,
      documentId: s.document_id ?? null,
      documentName: s.document_name ?? null,
      page: s.page ?? null,
      excerpt: s.excerpt ?? null,
      requirementId: s.requirement_id ?? null,
      wbsId: s.wbs_id ?? null,
      reviewStatus: s.review_status ?? null,
    })),
    generatedAt: raw.generated_at ?? null,
    llmStatus: (raw.llm_status ?? "SUCCEEDED") as AssistantLlmStatus,
  };
}

export const assistantApi = {
  apiBase: API_BASE,

  /** 프로젝트 전반(요구사항·문서·WBS 등)에 대해 자연어로 질문한다. */
  async query(
    projectId: string,
    question: string,
    accessToken?: string | null,
    enableLlm = true,
  ): Promise<AssistantAnswer> {
    const res = await fetch(
      `${API_BASE}/api/projects/${encodeURIComponent(resolveProjectId(projectId))}/assistant/query`,
      {
        method: "POST",
        headers: authHeaders(accessToken),
        body: JSON.stringify({ question, enableLlm }),
      },
    );
    if (!res.ok) throw await parseError(res);
    return mapAnswer((await res.json()) as RawAnswer);
  },
};

/** llmStatus를 사용자에게 보여줄 문구로. null이면 표시하지 않는다. */
export function assistantLlmStatusLabel(status: AssistantLlmStatus): string | null {
  const map: Record<string, string | null> = {
    SUCCEEDED: null, // 정상 동작은 굳이 알릴 필요 없음
    SKIPPED_NO_API_KEY: "규칙 기반 답변 (LLM 키 미설정)",
    FALLBACK: "규칙 기반 답변 (LLM 호출 실패)",
    DISABLED: "규칙 기반 답변 (LLM 비활성)",
  };
  return map[status] ?? null;
}
