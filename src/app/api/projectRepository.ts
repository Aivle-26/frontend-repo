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
  clientOrganization: string | null;
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
  clientOrganization: string | null;
  pmEmployeeNumber: string;
  plannedStartDate: string;
  plannedEndDate: string;
}

export interface CreateProjectDraftResponse {
  projectId: number;
  name: string;
  clientOrganization: string | null;
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
}

export interface RequirementsResult {
  projectId: number;
  aiSuggestions: RequirementResponse[];
  finalRequirements: RequirementResponse[];
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
  itemType?: string | null;
  level?: number | null;
  completionCriteria?: string[];
  relatedArtifacts?: Array<{
    artifactType: string;
    artifactName: string;
    requiredVersion: string | null;
  }>;
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

export type ServiceScale = "SMALL" | "MEDIUM" | "LARGE";

export interface CostEstimateWbsEffort {
  wbsId: number;
  estimatedMm: number;
}

export interface CostEstimateRequestBody {
  wbsEfforts: CostEstimateWbsEffort[];
  averageMonthlyUnitPrice: number;
  operationMonths: number;
  serviceScale: ServiceScale;
  usesAiApi?: boolean;
  paidLicenseUserCount?: number;
  includeVat?: boolean;
}

export interface CostSummary {
  laborCost: number;
  serverCost: number;
  licenseCost: number;
  aiApiCost: number;
  baseCost: number;
}

export interface CostEstimate {
  contingencyRate: number;
  contingencyAmount: number;
  supplyAmount: number;
  vat: number;
  totalAmount: number;
}

export interface CostEstimateResponse {
  projectId: number;
  currency: string;
  totalEstimatedMm: number;
  costSummary: CostSummary;
  estimate: CostEstimate;
  unpricedItems: string[];
  warning: string | null;
  llmStatus: string | null;
}

export interface FinalCostEstimateResponse extends CostEstimateResponse {
  costEstimateId: number;
  confirmed: boolean;
  wbsEfforts: CostEstimateWbsEffort[];
  averageMonthlyUnitPrice: number;
  operationMonths: number;
  serviceScale: ServiceScale;
  usesAiApi: boolean;
  paidLicenseUserCount: number;
  includeVat: boolean;
  updatedAt: string;
}

export interface AssignmentRecommendationCandidate {
  employeeNumber: string;
  availableHoursPerWeek: number;
}

export interface AssignmentRecommendationRequestBody {
  candidates?: AssignmentRecommendationCandidate[];
}

export interface AssignmentRequiredSkill {
  skillCode: string;
  minLevel: string | null;
}

export interface AssignmentRecommendedMember {
  employeeNumber: string;
  name: string;
  email: string;
  recommendationScore: number;
  assignedHours: number;
  remainingAvailableHours: number;
}

export interface AssignmentRecommendation {
  wbsId: number;
  wbsName: string;
  requiredRoleCode: string;
  requiredSkills: AssignmentRequiredSkill[];
  estimatedPersonDays: number;
  estimatedHours: number;
  estimatedMm: number;
  requiredHeadcount: number;
  recommendedMembers: AssignmentRecommendedMember[];
  recommendationReason: string | null;
}

export interface ProjectProgressResponse {
  projectId: number;
  employeeNumber: string | null;
  progressRate: number;
  totalTaskCount: number;
  assignedTaskCount: number;
  completedTaskCount: number;
  delayedTaskCount: number;
  totalEstimatedHours: number;
  completedEstimatedHours: number;
}

export interface AssignmentRecommendationResponse {
  projectId: number;
  candidateMode: "ALL" | "SELECTED";
  candidates: {
    employeeNumber: string;
    name: string;
    email: string;
    availableHoursPerWeek: number;
  }[];
  assignments: AssignmentRecommendation[];
  totalEstimatedPersonDays: number;
  totalEstimatedHours: number;
  totalEstimatedMm: number;
  unassignedWbsIds: number[];
  warnings: string[];
  llmStatus: string | null;
}

export type TaskProgressStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "COMPLETED" | "DELAYED";

export interface TaskAssignmentResponse {
  assignmentId: number;
  projectId: number;
  wbsId: number;
  taskCode: string;
  taskName: string;
  description: string;
  employeeNumber: string;
  status: TaskProgressStatus;
  progressRate: number;
  startDate: string | null;
  dueDate: string | null;
  estimatedHours: number;
  milestone: boolean;
  bufferDays: number;
  overdue: boolean;
  assignedAt: string;
  updatedAt: string;
}

export interface UpdateTaskProgressRequestBody {
  status: TaskProgressStatus;
  progressRate: number;
}

export interface TeamMemberSkill {
  skillCode: string;
  proficiencyLevel: number;
  experienceMonths: number;
}

/** 회사 전체 등록된 직원 (프로젝트에 아직 안 붙어있을 수도 있음). */
export interface TeamMemberResponse {
  employeeNumber: string;
  name: string;
  email: string;
  capabilityRegistered: boolean;
  roles: string[];
  skills: TeamMemberSkill[];
}

/** 특정 프로젝트에 실제로 등록된 팀원. */
export interface ProjectMemberResponse {
  projectMemberId: number;
  projectId: number;
  employeeNumber: string;
  name: string;
  email: string;
  availableHoursPerWeek: number;
  selectedBy: string;
  joinedAt: string;
  roles: string[];
  skills: TeamMemberSkill[];
}

export interface SaveProjectMembersRequestBody {
  members: {
    employeeNumber: string;
    availableHoursPerWeek: number | null;
  }[];
}

export interface SaveFinalAssignmentsRequestBody {
  assignments: {
    wbsId: number;
    employeeNumber: string;
    assignedHours: number;
    dueDate?: string | null;
  }[];
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
  relatedArtifacts?: Array<{
    artifactType: string;
    artifactName: string;
    requiredVersion: string | null;
  }>;
  completionCriteria?: string[];
}

export interface SaveFinalWbsRequest {
  tasks: SaveFinalWbsTask[];
}

export type AgentExecutionStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | string;

export interface AgentRequestResult {
  agentExecutionId: string;
  status: AgentExecutionStatus;
  agentVersion: string;
}


export interface ProjectScheduleDateRange {
  startDate: string;
  endDate: string;
  estimatedDays: number;
}

export interface ProjectScheduleDetail {
  scheduleId: number;
  wbsId: number;
  wbsCode: string;
  wbsName: string;
  wbsDescription: string;
  parentWbsId: number | null;
  itemType: string;
  orderIndex: number;
  expected: ProjectScheduleDateRange;
  recommended: ProjectScheduleDateRange;
  conservative: ProjectScheduleDateRange;
  predecessorWbsIds: number[];
  milestone: boolean;
  bufferDays: number;
  confirmed: boolean;
}

export interface ProjectScheduleResult {
  scheduleResultId: number;
  projectId: number;
  agentExecutionId: string;
  agentVersion: string;
  llmStatus: string;
  projectStartDate: string;
  targetEndDate: string;
  schedules: ProjectScheduleDetail[];
  warnings: string[];
}

export interface MemberProgress {
  employeeNumber: string;
  name: string;
  progressRate: number;
  totalTaskCount: number;
  completedTaskCount: number;
  delayedTaskCount: number;
  totalEstimatedHours: number;
}

export interface TeamProgressResponse {
  members: MemberProgress[];
}

export interface AssignTaskBody {
  employeeNumber: string;
  dueDate?: string | null;
}

/* ---------------- 위클리 스크럼 워크플로우 ---------------- */

export interface WeeklyScrumSubmissionItem {
  id: number;
  projectId: number;
  employeeNumber: string;
  weekStartDate: string;
  completedWork: string;
  plannedWork: string;
  blockers: string | null;
  details: unknown | null;
  createdAt: string;
  updatedAt: string;
}

/** 직원 위클리 스크럼 제출 본문 (PUT /{weekStartDate}). */
export interface SaveWeeklyScrumBody {
  completedWork: string;
  plannedWork: string;
  blockers?: string | null;
  details?: unknown;
}

export interface MissingWeeklyScrumMembers {
  projectId: number;
  weekStartDate: string;
  totalMemberCount: number;
  submittedMemberCount: number;
  missingEmployeeNumbers: string[];
}

export interface AnalyzeWeeklyScrumBody {
  sprintGoal?: string | null;
  enableLlm?: boolean;
}

export type WeeklyScrumWorkflowStatus =
  | "DRAFT_INPUT"
  | "SUMMARIZED"
  | "REVIEWED"
  | "ACTIONS_RECOMMENDED"
  | "PM_REVIEWING"
  | "FINALIZED"
  | "FAILED";

export interface WeeklyScrumLlmStatuses {
  summarize: string | null;
  review: string | null;
  recommend: string | null;
  finalizeStatus: string | null;
}

export interface WeeklyScrumReportResponse {
  id: number | null;
  projectId: number;
  weekStartDate: string;
  weekEndDate: string | null;
  sprintGoal: string | null;
  enableLlm: boolean;
  status: WeeklyScrumWorkflowStatus;
  summary: unknown | null;
  review: unknown | null;
  recommendation: unknown | null;
  pmReview: unknown | null;
  finalResult: unknown | null;
  finalReport: string | null;
  llmStatuses: WeeklyScrumLlmStatuses | null;
  failure: { code: string; message: string } | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/* ---- PM 검토(Phase 2): AI 결과 카드 렌더용 타입 (JsonNode 실제 구조) ---- */

/** AI 응답 필드는 snake_case (ai-server 스키마 기준). */
export interface WeeklyScrumEvidence {
  member_name?: string | null;
  role?: string | null;
  text: string;
}

/** analysis.review.review_findings[] 항목 (AiReviewFinding). */
export interface WeeklyScrumFinding {
  finding_id: string;
  type: string;
  title: string;
  description: string;
  impact?: string | null;
  recommended_action?: string | null;
  confidence?: string | null;
  evidence?: WeeklyScrumEvidence[];
  suggested_owner_id?: string | null;
  suggested_owner?: string | null;
  suggested_due_date?: string | null;
  review_status?: string | null;
}

/** analysis.recommendation.recommended_next_actions[] 항목 (NextWeekActionPlan). */
export interface WeeklyScrumAction {
  action_id: string;
  title: string;
  owner_id?: string | null;
  owner?: string | null;
  assignment_status?: string | null;
  due_date?: string | null;
  priority?: string | null;
  done_condition?: string | null;
  reason?: string | null;
  source_finding_id?: string | null;
  source_finding_ids?: string[];
  review_status?: string | null;
}

/** analysis.summary.team_summary (WeeklyTeamSummary). */
export interface WeeklyScrumMemberSummary {
  member_name?: string;
  role?: string | null;
  summary?: string;
  key_completed_tasks?: string[];
  key_in_progress_tasks?: string[];
  key_issues?: string[];
  key_risks?: string[];
  next_week_focus?: string[];
}

export interface WeeklyScrumTeamSummary {
  overall_status?: string;
  executive_summary?: string;
  team_progress?: string[];
  member_summaries?: WeeklyScrumMemberSummary[];
  key_issues?: string[];
  key_risks?: string[];
  next_week_plan_summary?: string[];
}

/** analysis.summary 전체 (WeeklyScrumSummarizeResponse). */
export interface WeeklyScrumSummaryResult {
  team_summary?: WeeklyScrumTeamSummary;
  completed_task_count?: number;
  in_progress_task_count?: number;
  delayed_task_count?: number;
  issue_count?: number;
  risk_count?: number;
}

/** analysis.review 전체 (WeeklyScrumReviewResponse). */
export interface WeeklyScrumReviewResult {
  review_findings?: WeeklyScrumFinding[];
  overall_status?: string;
}

/** analysis.recommendation 전체. */
export interface WeeklyScrumRecommendationResult {
  recommended_next_actions?: WeeklyScrumAction[];
  next_week_start?: string;
  next_week_end?: string;
}

export type WeeklyScrumReviewDecision = "APPROVED" | "MODIFIED" | "REJECTED";

/** PUT .../analysis/review 의 findings[] 항목 (백엔드 FindingDecision, camelCase). */
export interface WeeklyScrumFindingDecision {
  findingId: string;
  reviewStatus: WeeklyScrumReviewDecision;
  reviewComment?: string;
  modifiedTitle?: string;
  modifiedDescription?: string;
  modifiedAction?: string;
}

/** PUT .../analysis/review 의 actions[] 항목 (백엔드 ActionDecision, camelCase). */
export interface WeeklyScrumActionDecision {
  actionId: string;
  reviewStatus: WeeklyScrumReviewDecision;
  reviewComment?: string;
  modifiedTitle?: string;
  modifiedOwnerId?: string;
  modifiedOwner?: string;
  modifiedDueDate?: string;
  modifiedPriority?: string;
  modifiedDoneCondition?: string;
  modifiedReason?: string;
}

export interface SaveWeeklyScrumReviewBody {
  findings: WeeklyScrumFindingDecision[];
  actions: WeeklyScrumActionDecision[];
}

/* ---------------- 프로젝트 메시지(공지/피드백) ---------------- */

export type ProjectMessageType = "NOTICE" | "FEEDBACK" | "SCRUM_REQUEST";

/** GET/POST /projects/{id}/notices 응답 (ProjectMessageResponse). */
export interface ProjectMessageResponse {
  id: number;
  projectId: number;
  type: ProjectMessageType;
  senderEmployeeNumber: string;
  recipientEmployeeNumber: string | null;
  title: string;
  content: string;
  targetWeekStart: string | null;
  createdAt: string;
}

/** POST /projects/{id}/notices 본문 (CreateNoticeRequest). */
export interface CreateNoticeBody {
  title: string;
  content: string;
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

  confirmAllRequirements(projectId: string | number) {
    return apiFetch<RequirementResponse[]>(
      `/projects/${encodeURIComponent(String(projectId))}/requirements/confirm`,
      {
        method: "PATCH",
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

  estimateProjectCost(projectId: string | number, input: CostEstimateRequestBody) {
    return apiFetch<CostEstimateResponse>(
      `/projects/${encodeURIComponent(String(projectId))}/costs/estimate`,
      {
        method: "POST",
        body: JSON.stringify(input),
        auth: true,
      },
    );
  },

  saveFinalCostEstimate(projectId: string | number, input: CostEstimateRequestBody) {
    return apiFetch<FinalCostEstimateResponse>(
      `/projects/${encodeURIComponent(String(projectId))}/costs/final`,
      {
        method: "PUT",
        body: JSON.stringify(input),
        auth: true,
      },
    );
  },

  recommendAssignments(
    projectId: string | number,
    input: AssignmentRecommendationRequestBody = {},
  ) {
    return apiFetch<AssignmentRecommendationResponse>(
      `/projects/${encodeURIComponent(String(projectId))}/assignments/recommend`,
      {
        method: "POST",
        body: JSON.stringify(input),
        auth: true,
      },
    );
  },

  getMyTasks(projectId: string | number) {
    return apiFetch<TaskAssignmentResponse[]>(
      `/projects/${encodeURIComponent(String(projectId))}/tasks/me`,
      { auth: true },
    );
  },

  getDueSoonTasks(projectId: string | number, days = 3) {
    return apiFetch<TaskAssignmentResponse[]>(
      `/projects/${encodeURIComponent(String(projectId))}/tasks/due-soon?days=${days}`,
      { auth: true },
    );
  },

  getMyProgress(projectId: string | number) {
    return apiFetch<ProjectProgressResponse>(
      `/projects/${encodeURIComponent(String(projectId))}/progress/me`,
      { auth: true },
    );
  },

  updateTaskProgress(
    projectId: string | number,
    wbsId: string | number,
    input: UpdateTaskProgressRequestBody,
  ) {
    return apiFetch<TaskAssignmentResponse>(
      `/projects/${encodeURIComponent(String(projectId))}/tasks/${encodeURIComponent(String(wbsId))}/progress`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
        auth: true,
      },
    );
  },

  /** 회사 전체 등록된 직원 목록 (PM 전용). */
  getAllTeamMembers() {
    return apiFetch<TeamMemberResponse[]>(`/users/team-members`, { auth: true });
  },

  /** 특정 프로젝트에 지금 등록된 팀원 목록. */
  getProjectMembers(projectId: string | number) {
    return apiFetch<ProjectMemberResponse[]>(
      `/projects/${encodeURIComponent(String(projectId))}/team-members`,
      { auth: true },
    );
  },

  /** 프로젝트 팀원 명단을 통째로 교체 저장 (PM 전용). */
  saveProjectMembers(projectId: string | number, input: SaveProjectMembersRequestBody) {
    return apiFetch<ProjectMemberResponse[]>(
      `/projects/${encodeURIComponent(String(projectId))}/team-members/final`,
      {
        method: "PUT",
        body: JSON.stringify(input),
        auth: true,
      },
    );
  },

  /** 담당자 배정을 최종 일괄 저장 (담당자 추천 화면의 "배정 저장"). */
  saveFinalAssignments(projectId: string | number, input: SaveFinalAssignmentsRequestBody) {
    return apiFetch<TaskAssignmentResponse[]>(
      `/projects/${encodeURIComponent(String(projectId))}/assignments/final`,
      {
        method: "PUT",
        body: JSON.stringify(input),
        auth: true,
      },
    );
  },

  /** 프로젝트 전체 담당자 배정 조회. */
  getProjectAssignments(projectId: string | number) {
    return apiFetch<TaskAssignmentResponse[]>(
      `/projects/${encodeURIComponent(String(projectId))}/assignments`,
      { auth: true },
    );
  },

  getProjectProgress(projectId: string | number) {
    return apiFetch<ProjectProgressResponse>(
      `/projects/${encodeURIComponent(String(projectId))}/progress`,
      { auth: true },
    );
  },

  generateSchedule(projectId: string | number) {
    return apiFetch<AgentRequestResult>(
      `/projects/${encodeURIComponent(String(projectId))}/schedules/generate`,
      {
        method: "POST",
        auth: true,
        expectedStatuses: [202],
      },
    );
  },

  getSchedules(projectId: string | number) {
    return apiFetch<ProjectScheduleResult>(
      `/projects/${encodeURIComponent(String(projectId))}/schedules`,
      { auth: true },
    );
  },

  // PM: 팀원별 진행 상황(진행률·완료/지연 태스크 수)
  getTeamProgress(projectId: string | number) {
    return apiFetch<TeamProgressResponse>(
      `/projects/${encodeURIComponent(String(projectId))}/progress/members`,
      { auth: true },
    );
  },

  // PM: WBS 태스크에 담당자 배정
  assignTask(
    projectId: string | number,
    wbsId: string | number,
    body: AssignTaskBody,
  ) {
    return apiFetch<TaskAssignmentResponse>(
      `/projects/${encodeURIComponent(String(projectId))}/tasks/${encodeURIComponent(String(wbsId))}/assignment`,
      { method: "PUT", body: JSON.stringify(body), auth: true },
    );
  },

  /* ---------------- 위클리 스크럼 ---------------- */

  // 직원: 해당 주차 위클리 스크럼 제출/수정 (본인 사번은 서버가 토큰에서 결정)
  saveWeeklyScrum(
    projectId: string | number,
    weekStartDate: string,
    body: SaveWeeklyScrumBody,
  ) {
    return apiFetch<WeeklyScrumSubmissionItem>(
      `/projects/${encodeURIComponent(String(projectId))}/weekly-scrums/${encodeURIComponent(weekStartDate)}`,
      { method: "PUT", body: JSON.stringify(body), auth: true },
    );
  },

  // 해당 주차에 제출된 스크럼 목록
  getWeeklyScrums(projectId: string | number, weekStartDate: string) {
    return apiFetch<WeeklyScrumSubmissionItem[]>(
      `/projects/${encodeURIComponent(String(projectId))}/weekly-scrums?weekStartDate=${encodeURIComponent(weekStartDate)}`,
      { auth: true },
    );
  },

  // 해당 주차 미제출 팀원 현황 (PM)
  getMissingWeeklyScrumMembers(projectId: string | number, weekStartDate: string) {
    return apiFetch<MissingWeeklyScrumMembers>(
      `/projects/${encodeURIComponent(String(projectId))}/weekly-scrums/missing-members?weekStartDate=${encodeURIComponent(weekStartDate)}`,
      { auth: true },
    );
  },

  // PM: AI 주간 분석 실행 (summarize→review→recommend 오케스트레이션)
  analyzeWeeklyScrum(
    projectId: string | number,
    weekStartDate: string,
    body: AnalyzeWeeklyScrumBody = {},
  ) {
    return apiFetch<WeeklyScrumReportResponse>(
      `/projects/${encodeURIComponent(String(projectId))}/weekly-scrums/${encodeURIComponent(weekStartDate)}/analysis`,
      { method: "POST", body: JSON.stringify(body), auth: true },
    );
  },

  // PM: 현재 분석 상태·결과 조회 (폴링용)
  getWeeklyScrumAnalysis(projectId: string | number, weekStartDate: string) {
    return apiFetch<WeeklyScrumReportResponse>(
      `/projects/${encodeURIComponent(String(projectId))}/weekly-scrums/${encodeURIComponent(weekStartDate)}/analysis`,
      { auth: true },
    );
  },

  // PM: 검토 결과(Finding·Action 승인/수정/거절) 저장 → 상태 PM_REVIEWING
  saveWeeklyScrumReview(
    projectId: string | number,
    weekStartDate: string,
    body: SaveWeeklyScrumReviewBody,
  ) {
    return apiFetch<WeeklyScrumReportResponse>(
      `/projects/${encodeURIComponent(String(projectId))}/weekly-scrums/${encodeURIComponent(weekStartDate)}/analysis/review`,
      { method: "PUT", body: JSON.stringify(body), auth: true },
    );
  },

  // PM: 최종 확정(finalize) → 상태 FINALIZED, finalReport 생성
  finalizeWeeklyScrum(projectId: string | number, weekStartDate: string) {
    return apiFetch<WeeklyScrumReportResponse>(
      `/projects/${encodeURIComponent(String(projectId))}/weekly-scrums/${encodeURIComponent(weekStartDate)}/analysis/finalize`,
      { method: "POST", auth: true },
    );
  },

  // 최종 확정 보고서 조회
  getWeeklyScrumReport(projectId: string | number, weekStartDate: string) {
    return apiFetch<WeeklyScrumReportResponse>(
      `/projects/${encodeURIComponent(String(projectId))}/weekly-scrums/${encodeURIComponent(weekStartDate)}/report`,
      { auth: true },
    );
  },

  /* ---------------- 공지사항 ---------------- */

  // PM/STAFF: 프로젝트 공지 목록 조회
  getProjectNotices(projectId: string | number) {
    return apiFetch<ProjectMessageResponse[]>(
      `/projects/${encodeURIComponent(String(projectId))}/notices`,
      { auth: true },
    );
  },

  // PM: 공지 등록
  createProjectNotice(projectId: string | number, body: CreateNoticeBody) {
    return apiFetch<ProjectMessageResponse>(
      `/projects/${encodeURIComponent(String(projectId))}/notices`,
      { method: "POST", body: JSON.stringify(body), auth: true, expectedStatuses: [201] },
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

  async reanalyzeProjectRequirements(projectId: string | number) {
    const documents = await this.listProjectDocuments(projectId);
    return this.analyzeProjectRequirements(projectId, {
      documentIds: documents.documents.map((document) => document.documentId),
    });
  },

};;