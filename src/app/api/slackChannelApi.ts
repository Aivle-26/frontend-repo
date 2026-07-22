/**
 * 프로젝트 ↔ Slack 채널 매핑 API 클라이언트.
 *
 * 커뮤니케이션 리스크 분석은 프로젝트별로 "어떤 채널을 볼지" 먼저 정해야 한다.
 * 이 클라이언트가 그 채널 연결/해제를 담당한다.
 *
 * 백엔드 규격:
 *   GET    /api/projects/{projectId}/slack-channels             연결된 채널 목록
 *   GET    /api/projects/{projectId}/slack-channels/candidates  선택 후보(워크스페이스 전체)
 *   POST   /api/projects/{projectId}/slack-channels             연결
 *   DELETE /api/projects/{projectId}/slack-channels/{channelId} 해제
 */

const API_BASE: string =
  (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_COMMUNICATION_RISK_API || "http://localhost:8080";

/**
 * 과도기 임시 매핑. 프론트 프로젝트 목록이 아직 데모라 id가 slug다.
 * communicationRiskApi.ts와 동일한 환경변수를 공유한다.
 */
const OVERRIDE_PROJECT_ID: string | undefined =
  (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_COMMUNICATION_RISK_PROJECT_ID;

function resolveProjectId(projectId: string): string {
  return OVERRIDE_PROJECT_ID ?? projectId;
}

/** 이미 연결된 채널. 백엔드 SlackChannelResponse와 일치. */
export interface LinkedSlackChannel {
  id: number;
  channelId: string;
  channelName: string;
  /** 아직 수집 이력이 없으면 null */
  lastSyncedTs: string | null;
  createdAt: string;
}

/** 선택 후보 채널. 백엔드 SlackChannelCandidateResponse와 일치. */
export interface SlackChannelCandidate {
  channelId: string;
  channelName: string;
  isPrivate: boolean;
  /** 봇이 참여하지 않은 채널은 메시지를 못 읽어 선택 불가 처리한다. */
  botJoined: boolean;
  alreadyLinked: boolean;
}

export class SlackChannelApiError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status = 500, code: string | null = null) {
    super(message);
    this.name = "SlackChannelApiError";
    this.status = status;
    this.code = code;
  }
}

type ApiErrorPayload = {
  status?: number;
  code?: string | null;
  message?: string;
};

async function parseError(res: Response): Promise<SlackChannelApiError> {
  let payload: ApiErrorPayload = {};
  try {
    payload = (await res.json()) as ApiErrorPayload;
  } catch {
    /* 본문 없음 */
  }
  return new SlackChannelApiError(
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

function base(projectId: string): string {
  return `${API_BASE}/api/projects/${encodeURIComponent(resolveProjectId(projectId))}/slack-channels`;
}

export const slackChannelApi = {
  /** 이 프로젝트에 연결된 채널 목록 */
  async list(
    projectId: string,
    accessToken?: string | null,
  ): Promise<LinkedSlackChannel[]> {
    const res = await fetch(base(projectId), { headers: authHeaders(accessToken) });
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as LinkedSlackChannel[];
  },

  /** 워크스페이스 채널 후보. 봇 참여 여부·이미 연결됨 여부가 함께 온다. */
  async candidates(
    projectId: string,
    accessToken?: string | null,
  ): Promise<SlackChannelCandidate[]> {
    const res = await fetch(`${base(projectId)}/candidates`, {
      headers: authHeaders(accessToken),
    });
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as SlackChannelCandidate[];
  },

  /** 채널 하나를 연결한다. 백엔드는 한 번에 하나만 받는다. */
  async register(
    projectId: string,
    channelId: string,
    accessToken?: string | null,
  ): Promise<LinkedSlackChannel> {
    const res = await fetch(base(projectId), {
      method: "POST",
      headers: { ...authHeaders(accessToken), "Content-Type": "application/json" },
      body: JSON.stringify({ channelId }),
    });
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as LinkedSlackChannel;
  },

  /** 채널 연결 해제. 수집된 메시지는 백엔드가 지우지 않는다. */
  async unregister(
    projectId: string,
    channelId: string,
    accessToken?: string | null,
  ): Promise<void> {
    const res = await fetch(`${base(projectId)}/${encodeURIComponent(channelId)}`, {
      method: "DELETE",
      headers: authHeaders(accessToken),
    });
    if (!res.ok) throw await parseError(res);
  },
};
