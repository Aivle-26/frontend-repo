import {
  AI_SUMMARY,
  AI_TASK_HELPER,
  AI_TASK_SUMMARY,
  ASSIGNEES,
  KPI_PM,
  KPI_STAFF,
  PROJECT_NAME,
  REQUIREMENTS,
  RISKS,
  STAFF_FEEDBACK,
  TASKS,
  TASK_CHECKLIST,
  TEAM,
  WORKFLOW_STEPS,
  PM_AI_FILES,
  PM_LIBRARY_FILES,
  PM_PLANNING_AGENTS,
  PM_REPORT_AGENTS,
  PM_GENERATED_ARTIFACTS,
  PM_ANALYSIS_STATS,
  PM_CHAT_HISTORY,
  STAFF_SHARED_DOCS,
  STAFF_MY_DOCS,
  STAFF_ASSET_ICONS,
  STAFF_REVIEW_ACTIVITY,
  RISK_DETECTIONS,
  TEAM_COMMS,
  OPEN_RISKS,
  RISK_SOLUTIONS,
  PM_RISK_KPIS,
  PM_RISK_ROWS,
  PM_RISK_COMMENT,
  PM_RISK_COMMENT_TAGS,
  PM_LABOR_CHECKS,
  PM_PRIVACY_ITEMS,
  PM_HANDOVER_CHECKS,
  PM_RISK_ACTIONS,
  PM_QUICK_TOOLS,
  UPLOADED_RFPS,
  REVIEW_SUBMISSIONS,
  STAFF_SUBMITTABLE,
  PROJECTS,
  type Role,
  type Task,
  type TaskColumn,
} from "@/app/data/demoData";

export type { Role, Task, TaskColumn };

const API_BASE = "/api";
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
  lastActivityAt: number;
  serverTime: number;
  inactivityTimeoutMinutes: number;
}

export interface AuthSession {
  employeeNumber: string;
  name: string;
  role: string;
  accessToken: string;
  refreshToken: string | null;
  accessTokenExpiresAt: number;
  absoluteExpiresAt: number;
  lastActivityAt: number;
  serverTime: number;
  inactivityTimeoutMinutes: number;
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

export interface AssignRequirementInput {
  requirementId: number;
  assignee: string;
  dueDate?: string;
  memo?: string;
}

export interface SubmitReviewInput {
  taskId?: string;
  attachmentUrl?: string;
}

export interface AddCommentInput {
  taskId?: string;
  text: string;
}

interface ApiRequestInit extends RequestInit {
  auth?: boolean;
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
    lastActivityAt: response.lastActivityAt,
    serverTime: response.serverTime,
    inactivityTimeoutMinutes: response.inactivityTimeoutMinutes,
  };
}

function saveSession(response: LoginVerifyResponse | AuthSessionResponse) {
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
    const session = JSON.parse(raw) as AuthSession;
    if (!session.accessToken || session.absoluteExpiresAt <= Date.now()) {
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
  const { auth = false, retryOnUnauthorized = true, headers, ...requestInit } = init;
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

  return payload as T;
}

export function toFrontendRole(role?: string): Role {
  return role?.trim().toLowerCase() === "pm" ? "pm" : "staff";
}

export const projectRepository = {
  login(input: LoginRequest) {
    return apiFetch<LoginResponse>("/users/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  verifyLogin(input: LoginVerifyRequest) {
    return apiFetch<LoginVerifyResponse>("/users/login/verify", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((response) => {
      saveSession(response);
      return response;
    });
  },

  resendLoginVerification(email: string) {
    return apiFetch<LoginResponse>("/users/login/resend", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
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

  getProjectName() {
    return PROJECT_NAME;
  },

  getWorkflowSteps() {
    return WORKFLOW_STEPS;
  },

  getProjects() {
    return { projects: PROJECTS };
  },

  getPmDashboard() {
    return {
      kpis: KPI_PM,
      aiSummary: AI_SUMMARY,
      requirements: REQUIREMENTS,
      team: TEAM,
      risks: RISKS,
    };
  },

  getPmAnalysis() {
    return {
      requirements: REQUIREMENTS,
      risks: RISKS,
      assignees: ASSIGNEES,
    };
  },

  getPmRequirements() {
    return {
      requirements: REQUIREMENTS,
    };
  },

  getPmAssign() {
    return {
      requirements: REQUIREMENTS,
      team: TEAM,
      assignees: ASSIGNEES,
    };
  },

  getStaffDashboard() {
    return {
      kpis: KPI_STAFF,
      tasks: TASKS,
      aiHelper: AI_TASK_HELPER,
      feedback: STAFF_FEEDBACK,
      requirements: REQUIREMENTS,
    };
  },

  getTaskDetail() {
    return {
      checklist: TASK_CHECKLIST,
      aiSummary: AI_TASK_SUMMARY,
      feedback: STAFF_FEEDBACK,
    };
  },

  getPmDocuments() {
    return {
      aiFiles: PM_AI_FILES,
      libraryFiles: PM_LIBRARY_FILES,
      planningAgents: PM_PLANNING_AGENTS,
      reportAgents: PM_REPORT_AGENTS,
      artifacts: PM_GENERATED_ARTIFACTS,
      stats: PM_ANALYSIS_STATS,
      chatHistory: PM_CHAT_HISTORY,
    };
  },

  getStaffDocuments() {
    return {
      sharedDocs: STAFF_SHARED_DOCS,
      myDocs: STAFF_MY_DOCS,
      assetIcons: STAFF_ASSET_ICONS,
      reviewActivity: STAFF_REVIEW_ACTIVITY,
    };
  },

  getRiskBoard() {
    return {
      detections: RISK_DETECTIONS,
      teamComms: TEAM_COMMS,
      openRisks: OPEN_RISKS,
      solutions: RISK_SOLUTIONS,
    };
  },

  getPmRisk() {
    return {
      kpis: PM_RISK_KPIS,
      rows: PM_RISK_ROWS,
      comment: PM_RISK_COMMENT,
      commentTags: PM_RISK_COMMENT_TAGS,
      laborChecks: PM_LABOR_CHECKS,
      privacyItems: PM_PRIVACY_ITEMS,
      handoverChecks: PM_HANDOVER_CHECKS,
      actions: PM_RISK_ACTIONS,
      quickTools: PM_QUICK_TOOLS,
    };
  },

  getPmUpload() {
    return { uploaded: UPLOADED_RFPS };
  },

  getPmReview() {
    return { submissions: REVIEW_SUBMISSIONS, feedback: STAFF_FEEDBACK };
  },

  getStaffContext() {
    return { requirements: REQUIREMENTS };
  },

  getStaffSubmit() {
    return { tasks: STAFF_SUBMITTABLE, checklist: TASK_CHECKLIST };
  },

  getStaffFeedback() {
    return { feedback: STAFF_FEEDBACK };
  },

  async uploadRfp() {
    return { ok: true };
  },

  async reanalyzeRfp() {
    return { ok: true };
  },

  async assignRequirement(_input: AssignRequirementInput) {
    return { ok: true };
  },

  async requestReview(_input?: SubmitReviewInput) {
    return { ok: true };
  },

  async attachFile(_input?: SubmitReviewInput) {
    return { ok: true };
  },

  async addComment(_input: AddCommentInput) {
    return { ok: true };
  },
};

