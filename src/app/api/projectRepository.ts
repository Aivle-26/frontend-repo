export type Role = "pm" | "staff";

// 배포 환경(vercel.json)은 /api/* 를 EC2로 넘기는 rewrite가 있어 상대경로 "/api"가 맞다.
// 로컬 개발은 그 프록시가 없으므로 VITE_AUTH_API(=http://localhost:8080)를 지정해 절대경로로 쓴다.
// 즉 env가 있으면 그걸 붙이고, 없으면(배포) 상대경로 "/api"를 쓴다.
const AUTH_API_BASE =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_AUTH_API;
const API_BASE: string = AUTH_API_BASE ? `${AUTH_API_BASE}/api` : "/api";
const AUTH_SESSION_KEY = "aipm.authSession";

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export interface LoginRequest {
  email: string;
  password: string;
  role: string;
}

export interface LoginResponse {
  success: boolean;
  verificationRequired: boolean;
  message: string;
  expiresIn: number;
}

export interface LoginVerifyRequest {
  email: string;
  verificationCode: string;
}

export interface SignupRequest {
  employeeNumber: string;
  name: string;
  email: string;
  password: string;
  role: "PM" | "STAFF";
}

export interface SignupResponse {
  employeeNumber: string;
  name: string;
  email: string;
  role: "PM" | "STAFF";
  status: string;
}

export interface SignupStartResponse {
  success: boolean;
  verificationRequired: boolean;
  message: string;
  expiresIn: number;
}

export interface SignupVerifyRequest {
  email: string;
  verificationCode: string;
}

export interface LoginVerifyResponse {
  success: boolean;
  message: string;
  employeeNumber: string;
  name: string;
  role: string;
  accessToken: string;
  refreshToken: string | null;
  accessTokenExpiresAt: number;
  absoluteExpiresAt: number;
  serverTime: number;
}

export interface AuthSession {
  employeeNumber: string;
  name: string;
  role: string;
  accessToken: string;
  refreshToken: string | null;
  accessTokenExpiresAt: number;
  absoluteExpiresAt: number;
  serverTime: number;
}

export interface AuthSessionResponse extends AuthSession {
  authenticated: boolean;
}

export interface ProjectSummary {
  projectId: number;
  name: string;
  description: string | null;
  pmEmployeeNumber: string;
  status: string;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectDraftRequest {
  name: string;
  description: string | null;
  pmEmployeeNumber: string;
  plannedStartDate: string;
  plannedEndDate: string;
}

export interface CreateProjectDraftResponse {
  projectId: number;
  name: string;
  pmEmployeeNumber: string;
  status: string;
  plannedStartDate: string;
  plannedEndDate: string;
}

export interface ProjectDocumentUploadItem {
  documentId: number;
  originalFileName: string;
  status: string;
  fileSize: number;
}

export interface ProjectDocumentUploadResponse {
  projectId: number;
  documents: ProjectDocumentUploadItem[];
}

export interface AnalyzeProjectRequirementsRequest {
  documentIds: number[];
}


export type RequirementStatus = "UNCONFIRMED" | "CONFIRMED" | "REJECTED";
export type RequirementPriority = "HIGH" | "MEDIUM" | "LOW" | "UNSPECIFIED";
export type RequirementType =
  | "FUNCTIONAL"
  | "NON_FUNCTIONAL"
  | "SECURITY"
  | "DATA"
  | "INTERFACE"
  | "OPERATION"
  | "PROJECT_MANAGEMENT"
  | "UNSPECIFIED";

export interface NormalizedBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RequirementEvidence {
  evidenceId: number | null;
  documentId: number;
  sourceDocument: string;
  pageNumber: number | null;
  chunkId: string;
  quoteText: string;
  startOffset: number | null;
  endOffset: number | null;
  boundingBoxes: NormalizedBoundingBox[];
}

export interface RequirementResponse {
  requirementId: number;
  analysisResultId: number | null;
  sourceDocumentId: number | null;
  externalReferenceId: number | null;
  type: RequirementType | string;
  title: string;
  description: string;
  acceptanceCriteria: string | null;
  dueDate: string | null;
  deliverableName: string | null;
  securityCondition: string | null;
  sourceDocumentName: string | null;
  sourceExcerpt: string | null;
  priority: RequirementPriority | string;
  status: RequirementStatus;
  confirmed: boolean;
  createdAt: string;
  updatedAt: string;
  evidences: RequirementEvidence[];
}

export interface RequirementsResult {
  projectId: number;
  aiSuggestions: RequirementResponse[];
  finalRequirements: RequirementResponse[];
}

export type RequirementChangeType =
  | "ADDED"
  | "MODIFIED"
  | "REMOVED"
  | "UNCHANGED";
export type RequirementChangeReviewStatus =
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED";

export interface RequirementChangeProposal {
  requirementId: number | null;
  sourceDocumentId: number;
  functionName: string;
  requirementText: string;
  category: RequirementType;
  priority: RequirementPriority;
  acceptanceCriteria: string | null;
  dueDate: string | null;
  deliverableName: string | null;
  securityCondition: string | null;
  sourceDocument: string;
  sourceExcerpt: string | null;
  evidences: RequirementEvidence[];
}

export interface RequirementChangeCandidate {
  candidateId: number;
  existingRequirementId: number | null;
  changeType: RequirementChangeType;
  reviewStatus: RequirementChangeReviewStatus;
  changeReason: string;
  existingRequirement: RequirementChangeProposal | null;
  proposedRequirement: RequirementChangeProposal | null;
  evidences: RequirementEvidence[];
  applied: boolean;
  createdAt: string;
  reviewedAt: string | null;
}

export interface RequirementReadjustmentResult {
  projectId: number;
  changeCandidates: RequirementChangeCandidate[];
}

export interface ReviewRequirementChangeRequest {
  reviewStatus: RequirementChangeReviewStatus;
  proposedRequirement?: RequirementChangeProposal | null;
}

export interface SaveFinalRequirement {
  requirementId: number | null;
  analysisResultId: number | null;
  sourceDocumentId: number;
  externalReferenceId: number;
  type: RequirementType | string;
  title: string;
  description: string;
  acceptanceCriteria: string | null;
  dueDate: string | null;
  deliverableName: string | null;
  securityCondition: string | null;
  sourceDocumentName: string | null;
  sourceExcerpt: string | null;
  priority: RequirementPriority | string;
}

export interface SaveFinalRequirementsRequest {
  requirements: SaveFinalRequirement[];
}

export interface RequirementListFilters {
  type?: string;
  priority?: string;
  status?: RequirementStatus;
  confirmed?: boolean;
}

/** 이전 화면과의 타입 호환을 위해 유지합니다. 신규 연동은 saveFinalRequirements를 사용합니다. */
export interface CreateRequirementRequest {
  analysisResultId?: number | null;
  sourceDocumentId?: number | null;
  externalReferenceId?: number | null;
  type: RequirementType | string;
  title: string;
  description: string;
  acceptanceCriteria?: string | null;
  dueDate?: string | null;
  deliverableName?: string | null;
  securityCondition?: string | null;
  sourceDocumentName?: string | null;
  sourceExcerpt?: string | null;
  priority: RequirementPriority | string;
}

export type UpdateRequirementRequest = Partial<CreateRequirementRequest>;

export interface WbsTask {
  taskId: number | null;
  externalTaskId: string;
  parentExternalTaskId: string | null;
  taskCode: string;
  taskName: string;
  description: string;
  phase: string;
  requiredSkills: string[];
  difficulty: string;
  estimatedHours: number;
  orderIndex: number;
  requirementIds: number[];
  confirmed: boolean;
}

export interface WbsResult {
  wbsResultId: number;
  projectId: number;
  agentExecutionId: string | null;
  agentVersion: string | null;
  finalConfirmed: boolean;
  createdAt: string;
  aiSuggestionTasks: WbsTask[];
  finalTasks: WbsTask[];
}

export interface SaveFinalWbsTask {
  externalTaskId: string;
  parentExternalTaskId: string | null;
  taskCode: string;
  taskName: string;
  description: string;
  phase: string;
  requiredSkills: string[];
  difficulty: string;
  estimatedHours: number;
  orderIndex: number;
  requirementIds: number[];
}

export interface SaveFinalWbsRequest {
  tasks: SaveFinalWbsTask[];
}

interface ApiRequestInit extends RequestInit {
  auth?: boolean;
  expectedStatuses?: number[];
  retryOnUnauthorized?: boolean;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function emitAuthExpired() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("aipm:auth-expired"));
  }
}

function normalizeSession(response: LoginVerifyResponse | AuthSessionResponse): AuthSession {
  return {
    employeeNumber: response.employeeNumber,
    name: response.name,
    role: response.role,
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    accessTokenExpiresAt: response.accessTokenExpiresAt,
    absoluteExpiresAt: response.absoluteExpiresAt,
    serverTime: response.serverTime,
  };
}

function saveSession(response: LoginVerifyResponse | AuthSessionResponse) {
  if (!isAuthenticatedSessionResponse(response)) {
    clearSession();
    throw new ApiError(401, "인증이 완료되지 않았습니다.");
  }

  const session = normalizeSession(response);
  if (canUseStorage()) {
    window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  }
  return session;
}

function readSession() {
  if (!canUseStorage()) {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const session = JSON.parse(raw) as unknown;
    if (!isStoredSession(session) || session.absoluteExpiresAt <= Date.now()) {
      window.localStorage.removeItem(AUTH_SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    window.localStorage.removeItem(AUTH_SESSION_KEY);
    return null;
  }
}

function clearSession() {
  if (canUseStorage()) {
    window.localStorage.removeItem(AUTH_SESSION_KEY);
  }
}

function isStoredSession(session: unknown): session is AuthSession {
  if (!session || typeof session !== "object") {
    return false;
  }

  const candidate = session as Partial<AuthSession>;
  return (
    typeof candidate.employeeNumber === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.role === "string" &&
    typeof candidate.accessToken === "string" &&
    candidate.accessToken.trim().length > 0 &&
    (candidate.refreshToken === null || typeof candidate.refreshToken === "string") &&
    typeof candidate.accessTokenExpiresAt === "number" &&
    Number.isFinite(candidate.accessTokenExpiresAt) &&
    typeof candidate.absoluteExpiresAt === "number" &&
    Number.isFinite(candidate.absoluteExpiresAt) &&
    typeof candidate.serverTime === "number" &&
    Number.isFinite(candidate.serverTime)
  );
}

function isAuthenticatedSessionResponse(
  response: LoginVerifyResponse | AuthSessionResponse,
): response is LoginVerifyResponse | AuthSessionResponse {
  const markedAsAuthenticated =
    ("success" in response && response.success === true) ||
    ("authenticated" in response && response.authenticated === true);

  return markedAsAuthenticated && isStoredSession(response);
}

function ensureLoginStepReady(response: LoginResponse) {
  if (response.success && response.verificationRequired) {
    return response;
  }

  throw new ApiError(401, response.message || "로그인 요청에 실패했습니다.", response);
}

function ensureSignupStepReady(response: SignupStartResponse) {
  if (response.success && response.verificationRequired) {
    return response;
  }

  throw new ApiError(401, response.message || "회원가입 인증 요청에 실패했습니다.", response);
}

function ensureSignupCompleted(response: SignupResponse) {
  const hasRequiredFields =
    typeof response.employeeNumber === "string" &&
    response.employeeNumber.trim().length > 0 &&
    typeof response.name === "string" &&
    response.name.trim().length > 0 &&
    typeof response.email === "string" &&
    response.email.trim().length > 0 &&
    (response.role === "PM" || response.role === "STAFF") &&
    typeof response.status === "string" &&
    response.status.trim().length > 0;

  if (hasRequiredFields) {
    return response;
  }

  throw new ApiError(500, "회원가입 응답 형식이 올바르지 않습니다.", response);
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return fallback;
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function refreshSession() {
  const session = readSession();
  if (!session?.refreshToken) {
    return null;
  }

  try {
    const refreshed = await apiFetch<AuthSessionResponse>("/users/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: session.refreshToken }),
      retryOnUnauthorized: false,
    });
    return saveSession(refreshed);
  } catch {
    clearSession();
    return null;
  }
}

async function apiFetch<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const {
    auth = false,
    expectedStatuses,
    retryOnUnauthorized = true,
    headers,
    ...requestInit
  } = init;
  const requestHeaders = new Headers(headers);

  if (
    requestInit.body &&
    typeof FormData !== "undefined" &&
    !(requestInit.body instanceof FormData) &&
    !requestHeaders.has("Content-Type")
  ) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (auth) {
    const session = readSession();
    if (session?.accessToken) {
      requestHeaders.set("Authorization", `Bearer ${session.accessToken}`);
    }
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...requestInit,
    headers: requestHeaders,
  });
  const payload = await parseResponse(response);

  if (!response.ok) {
    if (auth && response.status === 401 && retryOnUnauthorized) {
      const refreshed = await refreshSession();
      if (refreshed) {
        return apiFetch<T>(path, {
          ...init,
          retryOnUnauthorized: false,
        });
      }
    }

    if (auth && response.status === 401) {
      clearSession();
      emitAuthExpired();
    }

    throw new ApiError(response.status, getErrorMessage(payload, response.statusText), payload);
  }

  if (expectedStatuses && !expectedStatuses.includes(response.status)) {
    throw new ApiError(
      response.status,
      getErrorMessage(payload, "예상하지 못한 응답입니다."),
      payload,
    );
  }

  return payload as T;
}

async function apiFetchBlob(
  path: string,
  init: ApiRequestInit = {},
): Promise<Blob> {
  const {
    auth = false,
    retryOnUnauthorized = true,
    headers,
    ...requestInit
  } = init;
  const requestHeaders = new Headers(headers);
  if (auth) {
    const session = readSession();
    if (session?.accessToken) {
      requestHeaders.set("Authorization", `Bearer ${session.accessToken}`);
    }
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...requestInit,
    headers: requestHeaders,
  });
  if (!response.ok) {
    if (auth && response.status === 401 && retryOnUnauthorized) {
      const refreshed = await refreshSession();
      if (refreshed) {
        return apiFetchBlob(path, {
          ...init,
          retryOnUnauthorized: false,
        });
      }
    }
    const payload = await parseResponse(response);
    if (auth && response.status === 401) {
      clearSession();
      emitAuthExpired();
    }
    throw new ApiError(
      response.status,
      getErrorMessage(payload, response.statusText),
      payload,
    );
  }
  return response.blob();
}

export function toFrontendRole(role?: string): Role {
  return role?.trim().toLowerCase() === "pm" ? "pm" : "staff";
}

export const projectRepository = {
  signup(input: SignupRequest) {
    return apiFetch<SignupStartResponse>("/users/signup", {
      method: "POST",
      body: JSON.stringify(input),
    }).then(ensureSignupStepReady);
  },

  verifySignup(input: SignupVerifyRequest) {
    return apiFetch<SignupResponse>("/users/signup/verify", {
      method: "POST",
      body: JSON.stringify(input),
      expectedStatuses: [201],
    }).then(ensureSignupCompleted);
  },

  login(input: LoginRequest) {
    return apiFetch<LoginVerifyResponse>("/users/login", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((response) => {
      const session = saveSession(response);
      return {
        ...response,
        ...session,
      };
    });
  },

  verifyLogin(input: LoginVerifyRequest) {
    return apiFetch<LoginVerifyResponse>("/users/login/verify", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((response) => {
      const session = saveSession(response);
      return {
        ...response,
        ...session,
      };
    });
  },

  resendLoginVerification(email: string) {
    return apiFetch<LoginResponse>("/users/login/resend", {
      method: "POST",
      body: JSON.stringify({ email }),
    }).then(ensureLoginStepReady);
  },

  getStoredSession() {
    return readSession();
  },

  logout() {
    const refreshToken = readSession()?.refreshToken;
    clearSession();

    if (refreshToken) {
      void apiFetch("/users/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      }).catch(() => undefined);
    }
  },

  listProjects() {
    return apiFetch<ProjectSummary[]>("/projects", { auth: true });
  },

  deleteProject(projectId: string | number) {
    return apiFetch<void>(
      `/projects/${encodeURIComponent(String(projectId))}`,
      {
        method: "DELETE",
        auth: true,
        expectedStatuses: [204],
      },
    );
  },

  createProjectDraft(input: CreateProjectDraftRequest) {
    return apiFetch<CreateProjectDraftResponse>("/projects/drafts", {
      method: "POST",
      body: JSON.stringify(input),
      auth: true,
      expectedStatuses: [201],
    });
  },

  getRequirements(projectId: string | number) {
    return apiFetch<RequirementsResult>(
      `/projects/${encodeURIComponent(String(projectId))}/requirements`,
      { auth: true },
    );
  },

  /** 이전 호출부 호환용입니다. 신규 화면은 getRequirements를 사용합니다. */
  listRequirements(
    projectId: string | number,
    _filters: RequirementListFilters = {},
  ) {
    return apiFetch<RequirementsResult>(
      `/projects/${encodeURIComponent(String(projectId))}/requirements`,
      { auth: true },
    ).then((response) =>
      Array.isArray(response.finalRequirements)
        ? response.finalRequirements
        : [],
    );
  },

  saveFinalRequirements(
    projectId: string | number,
    input: SaveFinalRequirementsRequest,
  ) {
    return apiFetch<RequirementsResult>(
      `/projects/${encodeURIComponent(String(projectId))}/requirements/final`,
      {
        method: "PUT",
        body: JSON.stringify(input),
        auth: true,
      },
    );
  },

  generateWbs(projectId: string | number) {
    return apiFetch<WbsResult | void>(
      `/projects/${encodeURIComponent(String(projectId))}/wbs/generate`,
      {
        method: "POST",
        auth: true,
      },
    );
  },

  getWbs(projectId: string | number) {
    return apiFetch<WbsResult>(
      `/projects/${encodeURIComponent(String(projectId))}/wbs`,
      { auth: true },
    );
  },

  saveFinalWbs(projectId: string | number, input: SaveFinalWbsRequest) {
    return apiFetch<WbsResult>(
      `/projects/${encodeURIComponent(String(projectId))}/wbs/final`,
      {
        method: "PUT",
        body: JSON.stringify(input),
        auth: true,
      },
    );
  },

  uploadProjectDocuments(projectId: string | number, files: File[]) {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    return apiFetch<ProjectDocumentUploadResponse>(
      `/projects/${encodeURIComponent(String(projectId))}/documents/upload`,
      {
        method: "POST",
        body: formData,
        auth: true,
        expectedStatuses: [201],
      },
    );
  },

  listProjectDocuments(projectId: string | number) {
    return apiFetch<ProjectDocumentUploadResponse>(
      `/projects/${encodeURIComponent(String(projectId))}/documents`,
      { auth: true },
    );
  },

  getProjectDocumentContent(
    projectId: string | number,
    documentId: string | number,
    signal?: AbortSignal,
  ) {
    return apiFetchBlob(
      `/projects/${encodeURIComponent(String(projectId))}/documents/${encodeURIComponent(String(documentId))}/content`,
      { auth: true, signal },
    );
  },

  analyzeProjectRequirements(
    projectId: string | number,
    input: AnalyzeProjectRequirementsRequest,
  ) {
    return apiFetch<RequirementsResult>(
      `/projects/${encodeURIComponent(String(projectId))}/requirements/analyze`,
      {
        method: "POST",
        body: JSON.stringify(input),
        auth: true,
        expectedStatuses: [200],
      },
    );
  },

  readjustProjectRequirements(
    projectId: string | number,
    input: AnalyzeProjectRequirementsRequest,
  ) {
    return apiFetch<RequirementReadjustmentResult>(
      `/projects/${encodeURIComponent(String(projectId))}/requirements/readjust`,
      {
        method: "POST",
        body: JSON.stringify(input),
        auth: true,
        expectedStatuses: [200],
      },
    );
  },

  listRequirementReadjustments(projectId: string | number) {
    return apiFetch<RequirementReadjustmentResult>(
      `/projects/${encodeURIComponent(String(projectId))}/requirements/readjustments`,
      { auth: true },
    );
  },

  reviewRequirementChange(
    projectId: string | number,
    candidateId: string | number,
    input: ReviewRequirementChangeRequest,
  ) {
    return apiFetch<RequirementChangeCandidate>(
      `/projects/${encodeURIComponent(String(projectId))}/requirements/readjustments/${encodeURIComponent(String(candidateId))}`,
      {
        method: "PUT",
        body: JSON.stringify(input),
        auth: true,
      },
    );
  },

  applyRequirementChanges(
    projectId: string | number,
    candidateIds: number[],
  ) {
    return apiFetch<RequirementsResult>(
      `/projects/${encodeURIComponent(String(projectId))}/requirements/readjustments/apply`,
      {
        method: "POST",
        body: JSON.stringify({ candidateIds }),
        auth: true,
      },
    );
  },

  async reanalyzeProjectRequirements(projectId: string | number) {
    const documents = await this.listProjectDocuments(projectId);
    return this.analyzeProjectRequirements(projectId, {
      documentIds: documents.documents.map((document) => document.documentId),
    });
  },

};
