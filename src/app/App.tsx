import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  UploadCloud,
  Bot,
  Sparkles,
  FileText,
  Users,
  AlertTriangle,
  ClipboardCheck,
  ListTodo,
  BookOpen,
  Send,
  MessageSquareReply,
  MessagesSquare,
  FolderKanban,
  Search,
} from "lucide-react";
import { Toaster } from "@/app/components/ui/sonner";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Sidebar, type SidebarItem } from "@/app/components/layout/Sidebar";
import { TopBar } from "@/app/components/layout/TopBar";
import { ProjectScopeBar } from "@/app/components/layout/ProjectScopeBar";
import { LoginScreen } from "@/app/components/auth/LoginScreen";
import { SignupScreen } from "@/app/components/auth/SignupScreen";
import { PmAnalysis } from "@/app/components/pm/PmAnalysis";
import { DocumentLibrary } from "@/app/components/pm/DocumentLibrary";
import { RiskManagement } from "@/app/components/pm/RiskManagement";
import { AiDocSearch } from "@/app/components/pm/AiDocSearch";
import { PmUpload } from "@/app/components/pm/PmUpload";
import { PmReview } from "@/app/components/pm/PmReview";
import { PmRequirements } from "@/app/components/pm/PmRequirements";
import { PmAssign } from "@/app/components/pm/PmAssign";
import { ProjectBoard } from "@/app/components/pm/ProjectBoard";
import { ProjectDetail } from "@/app/components/pm/ProjectDetail";
import { ProjectWizard } from "@/app/components/pm/ProjectWizard";
import { ProjectExtraction } from "@/app/components/pm/ProjectExtraction";
import { StaffDashboard } from "@/app/components/staff/StaffDashboard";
import { StaffTaskDetail } from "@/app/components/staff/StaffTaskDetail";
import { StaffDocuments } from "@/app/components/staff/StaffDocuments";
import { StaffRisk, StaffRiskActions } from "@/app/components/staff/StaffRisk";
import { StaffContext } from "@/app/components/staff/StaffContext";
import { StaffSubmit } from "@/app/components/staff/StaffSubmit";
import { StaffFeedback } from "@/app/components/staff/StaffFeedback";
import { StaffComments } from "@/app/components/staff/StaffComments";
import { SlackIntegration } from "@/app/components/integrations/SlackIntegration";
import {
  ApiError,
  projectRepository,
  toFrontendRole,
  type LoginVerifyResponse,
  type ProjectSummary as ApiProjectSummary,
  type Role,
} from "@/app/api/projectRepository";
import { slackApi } from "@/app/api/slackApi";
import {
  PROJECTS,
  type ProjectRequirement,
  type ProjectStatus,
  type ProjectSummary as FrontendProjectSummary,
} from "@/app/data/demoData";
import { PmGeneration } from "@/app/components/pm/PmGeneration";

const PM_MENU: SidebarItem[] = [
  { key: "dashboard", label: "프로젝트", icon: LayoutDashboard },
  { key: "upload", label: "공고문 업로드", icon: UploadCloud },
  { key: "generation", label: "AI 생성", icon: Bot },
  { key: "analysis", label: "AI 분석", icon: Sparkles },
  { key: "requirements", label: "요구사항", icon: FileText },
  { key: "assign", label: "업무 배정", icon: Users },
  { key: "documents", label: "문서함", icon: FolderKanban },
  { key: "search", label: "AI 문서 검색", icon: Search },
  { key: "risk", label: "리스크 관리", icon: AlertTriangle },
  { key: "review", label: "검토", icon: ClipboardCheck },
];

const STAFF_MENU: SidebarItem[] = [
  { key: "tasks", label: "내 업무", icon: ListTodo },
  { key: "context", label: "RFP 맥락", icon: BookOpen },
  { key: "documents", label: "문서 통합 관리", icon: FolderKanban },
  { key: "risk", label: "리스크", icon: AlertTriangle },
  { key: "submit", label: "산출물 제출", icon: Send },
  { key: "feedback", label: "피드백", icon: MessageSquareReply },
  { key: "comments", label: "댓글", icon: MessagesSquare },
];

// 프로젝트 단위로 다뤄야 하는 PM 메뉴 (상단에 프로젝트 선택 바 표시)

const SCOPED_PM = new Set([
  "upload",
  "generation",
  "analysis",
  "requirements",
  "assign",
  "documents",
  "search",
  "risk",
  "review",
]);

type ProjectLoadStatus =
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "unauthorized"
  | "forbidden"
  | "error";

export default function App() {
  const [authSession, setAuthSession] = useState(() =>
    projectRepository.getStoredSession(),
  );
  const [authView, setAuthView] = useState<"login" | "signup">("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [pmMenu, setPmMenu] = useState("dashboard");
  const [staffMenu, setStaffMenu] = useState("tasks");
  const [taskOpen, setTaskOpen] = useState(false);
  // const [projects, setProjects] = useState<FrontendProjectSummary[]>([]);

  const [projects, setProjects] = useState<FrontendProjectSummary[]>([]);

  const [projectLoadStatus, setProjectLoadStatus] = useState<ProjectLoadStatus>("idle");
  const [projectLoadError, setProjectLoadError] = useState("");
  const [pmDetail, setPmDetail] = useState<FrontendProjectSummary | null>(null);
  const [pmWizard, setPmWizard] = useState<FrontendProjectSummary | null>(null);
  const [pmExtract, setPmExtract] = useState<FrontendProjectSummary | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    "",
  );


  const role: Role | null = authSession ? toFrontendRole(authSession.role) : null;


  const startProject = (id: string) =>
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: "진행중", progress: Math.max(p.progress, 5) }
          : p,
      ),
    );

  // Slack OAuth 콜백(?session=)으로 돌아오면 세션 저장 후 연동 화면으로 이동
  useEffect(() => {
    if (slackApi.captureSessionFromUrl()) {
      setPmMenu("slack");
      setStaffMenu("slack");
    }
  }, []);

  useEffect(() => {
    const handleAuthExpired = () => setAuthSession(null);
    window.addEventListener("aipm:auth-expired", handleAuthExpired);
    return () => window.removeEventListener("aipm:auth-expired", handleAuthExpired);
  }, []);

  useEffect(() => {
    if (role !== "pm") {
      setProjectLoadStatus("idle");
      return;
    }

    let ignore = false;
    setProjectLoadStatus("loading");
    setProjectLoadError("");

    projectRepository
      .listProjects()
      .then((items) => {
        if (ignore) return;
        const mapped = items.map(mapApiProject);
        setProjects(mapped);
        setSelectedProjectId((current) =>
          mapped.some((project) => project.id === current)
            ? current
            : mapped[0]?.id ?? "",
        );
        setProjectLoadStatus(mapped.length > 0 ? "ready" : "empty");
      })
      .catch((caught) => {
        if (ignore) return;
        setProjects([]);
        setSelectedProjectId("");
        setProjectLoadStatus(getProjectLoadStatus(caught));
        setProjectLoadError(getProjectLoadError(caught));
      });

    return () => {
      ignore = true;
    };
  }, [role]);

  const handleLogin = (session: LoginVerifyResponse) => {
    setAuthSession(session);
    setPmMenu("dashboard");
    setStaffMenu("tasks");
    setTaskOpen(false);
  };

  const handleLogout = () => {
    projectRepository.logout();
    setAuthSession(null);
  };

  const openLogin = (options?: { email?: string; message?: string }) => {
    setAuthView("login");
    setLoginEmail(options?.email ?? "");
    setLoginMessage(options?.message ?? "");
  };

  if (!role) {
    return (
      <>
        {authView === "signup" ? (
          <SignupScreen onBackToLogin={openLogin} />
        ) : (
          <LoginScreen
            key={`${loginEmail}:${loginMessage}`}
            initialEmail={loginEmail}
            initialMessage={loginMessage}
            onLogin={handleLogin}
            onSignupClick={() => {
              setLoginMessage("");
              setAuthView("signup");
            }}
          />
        )}
        <Toaster />
      </>
    );
  }

  const isPm = role === "pm";
  const menu = isPm ? PM_MENU : STAFF_MENU;
  const activeMenu = isPm ? pmMenu : staffMenu;

  const handleSelect = (key: string) => {
    if (isPm) {
      setPmMenu(key);
      setPmDetail(null);
      setPmWizard(null);
      setPmExtract(null);
    } else {
      setStaffMenu(key);
      setTaskOpen(false);
    }
  };

  let subtitle = "";
  let body: React.ReactNode = null;
  let actions: React.ReactNode = null;

  const selectedProject =
    projects.find((p) => p.id === selectedProjectId) ?? projects[0];

  if (isPm) {
    if (SCOPED_PM.has(pmMenu) && !selectedProject) {
      subtitle = "프로젝트 선택";
      body = (
        <ProjectListNotice
          status={projectLoadStatus}
          error={projectLoadError}
        />
      );
    } else if (pmMenu === "slack") {
      subtitle = "Slack 연동";
      body = <SlackIntegration />;
    } else if (pmMenu === "upload") {
      subtitle = "공고문 업로드";
      body = (
        <PmUpload
          key={selectedProject?.id}
          project={selectedProject!}
        />
      );
    } else if (pmMenu === "generation") {
      subtitle = "AI 생성";
      body = (
        <PmGeneration
          key={selectedProject?.id}
          project={selectedProject!}
          onOpenDocuments={() => handleSelect("documents")}
        />
      );
    } else if (pmMenu === "documents") {
      subtitle = "문서함";
      body = (
        <DocumentLibrary
          key={selectedProject?.id}
          project={selectedProject!}
          onOpenAiGeneration={() => handleSelect("generation")}
        />
      );
    } else if (pmMenu === "search") {
      subtitle = "AI 문서 검색";
      body = (
        <AiDocSearch
          key={selectedProject?.id}
          project={selectedProject!}
        />
      );
    } else if (pmMenu === "risk") {
      subtitle = "리스크 관리";
      body = (
        <RiskManagement
          key={selectedProject?.id}
          project={selectedProject!}
        />
      );
    } else if (pmMenu === "review") {
      subtitle = "산출물 검토";
      body = (
        <PmReview
          key={selectedProject?.id}
          project={selectedProject!}
        />
      );
    } else if (pmMenu === "requirements") {
      subtitle = "요구사항";
      body = (
        <PmRequirements
          key={selectedProject?.id}
          project={selectedProject!}
        />
      );
    } else if (pmMenu === "assign") {
      subtitle = "업무 배정";
      body = (
        <PmAssign
          key={selectedProject?.id}
          project={selectedProject!}
        />
      );
    } else if (pmMenu === "analysis") {
      subtitle = "AI 분석";
      body = (
        <PmAnalysis
          key={selectedProject?.id}
          project={selectedProject!}
        />
      );
    } else if (pmExtract) {
      subtitle = `${pmExtract.name} · AI 추출`;

      body = (
        <ProjectExtraction
          project={pmExtract}
          onBack={() => setPmExtract(null)}
          onConfirm={(requirements: ProjectRequirement[]) => {
            const updated: FrontendProjectSummary = {
              ...pmExtract,
              status: "준비",
              requirements,
              reqCount: requirements.length,
              wizardStep: 1,
              updatedAt: "방금",
            };

            setProjects((prev) =>
              prev.map((p) =>
                p.id === updated.id ? updated : p,
              ),
            );

            setPmExtract(null);
            setPmWizard(updated);
          }}
        />
      );
    } else if (pmWizard) {
      subtitle = `${pmWizard.name} · 준비`;

      body = (
        <ProjectWizard
          project={pmWizard}
          onBack={() => setPmWizard(null)}
          onStart={(id) => {
            startProject(id);
            setPmWizard(null);
          }}
        />
      );
    } else if (pmDetail) {
      subtitle = `${pmDetail.name} · 운영`;

      body = (
        <ProjectDetail
          project={pmDetail}
          onBack={() => setPmDetail(null)}
          onUpdateDocs={(docs) => {
            const updated: FrontendProjectSummary = {
              ...pmDetail,
              docs,
              updatedAt: "방금",
            };

            setProjects((prev) =>
              prev.map((p) =>
                p.id === updated.id ? updated : p,
              ),
            );

            setPmDetail(updated);
          }}
        />
      );
    } else {
      subtitle = "프로젝트";

      body = (
        <div className="space-y-4">
          <ProjectListNotice
            status={projectLoadStatus}
            error={projectLoadError}
          />

          <ProjectBoard
            projects={projects}
            setProjects={setProjects}
            onOpenOperational={(p) => {
              setPmWizard(null);
              setPmDetail(p);
            }}
            onOpenWizard={(p) => {
              setPmDetail(null);
              setPmWizard(p);
            }}
            onExtract={(p) => {
              setPmDetail(null);
              setPmWizard(null);
              setPmExtract(p);
            }}
          />
        </div>
      );
    }
  } else {
    if (staffMenu === "slack") {
      subtitle = "Slack 연동";
      body = <SlackIntegration />;
    } else if (staffMenu === "documents") {
      subtitle = "문서 통합 관리";
      body = <StaffDocuments />;
    } else if (staffMenu === "risk") {
      subtitle = "리스크";
      body = <StaffRisk projectId={selectedProjectId} />;
      actions = <StaffRiskActions />;
    } else if (staffMenu === "context") {
      subtitle = "RFP 맥락";
      body = <StaffContext />;
    } else if (staffMenu === "submit") {
      subtitle = "산출물 제출";
      body = <StaffSubmit />;
    } else if (staffMenu === "feedback") {
      subtitle = "피드백";
      body = <StaffFeedback />;
    } else if (staffMenu === "comments") {
      subtitle = "댓글";
      body = <StaffComments />;
    } else if (taskOpen) {
      subtitle = "업무 상세";
      body = (
        <StaffTaskDetail
          onBack={() => setTaskOpen(false)}
        />
      );
    } else {
      subtitle = "직원 대시보드";
      body = (
        <StaffDashboard
          onOpenTask={() => setTaskOpen(true)}
        />
      );
    }
  }


  if (isPm && SCOPED_PM.has(pmMenu)) {
    body = (
      <div className="space-y-4">
        <ProjectScopeBar
          projects={projects}
          value={selectedProjectId}
          onChange={setSelectedProjectId}
        />
        {body}
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-muted/40">
      <Sidebar items={menu} active={activeMenu} onSelect={handleSelect} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          title={subtitle}
          userName={authSession?.name || (isPm ? "PM" : "Staff")}
          roleLabel={isPm ? "PM" : "직원"}
          onLogout={handleLogout}
          actions={actions}
        />
        <main className="flex-1 overflow-y-auto p-6">{body}</main>
      </div>
      <Toaster />
    </div>
  );
}

function mapApiProject(project: ApiProjectSummary): FrontendProjectSummary {
  return {
    id: String(project.projectId),
    name: project.name,
    client: project.pmEmployeeNumber ? `PM ${project.pmEmployeeNumber}` : "PM 미지정",
    status: mapProjectStatus(project.status),
    progress: project.status?.toUpperCase() === "COMPLETED" ? 100 : 0,
    dueDate: project.plannedEndDate ?? "-",
    riskCount: 0,
    reqCount: 0,
    wizardStep: 0,
    estimate: "-",
    updatedAt: formatUpdatedAt(project.plannedStartDate, project.plannedEndDate),
    docs: [],
  };
}

function mapProjectStatus(status: string): ProjectStatus {
  const normalized = status.trim().toUpperCase();
  if (normalized === "ACTIVE" || normalized === "IN_PROGRESS" || normalized === "진행중") {
    return "진행중";
  }
  if (normalized === "COMPLETED" || normalized === "완료") return "완료";
  if (normalized === "PENDING_APPROVAL" || normalized === "승인대기") return "승인대기";
  if (normalized === "ANALYZING" || normalized === "분석중") return "분석중";
  return "준비";
}

function formatUpdatedAt(startDate: string | null, endDate: string | null) {
  if (startDate && endDate) return `${startDate} ~ ${endDate}`;
  if (startDate) return `${startDate} 시작`;
  if (endDate) return `${endDate} 종료 예정`;
  return "-";
}

function getProjectLoadStatus(caught: unknown): ProjectLoadStatus {
  if (caught instanceof ApiError) {
    if (caught.status === 401) return "unauthorized";
    if (caught.status === 403) return "forbidden";
  }
  return "error";
}

function getProjectLoadError(caught: unknown) {
  if (caught instanceof ApiError && caught.status !== 401 && caught.status !== 403) {
    return caught.message;
  }
  return "프로젝트 목록을 불러오지 못했습니다.";
}

function ProjectListNotice({
  status,
  error,
}: {
  status: ProjectLoadStatus;
  error: string;
}) {
  if (status === "loading") {
    return (
      <Alert>
        <AlertDescription>프로젝트 목록을 불러오는 중입니다.</AlertDescription>
      </Alert>
    );
  }

  if (status === "empty") {
    return (
      <Alert>
        <AlertDescription>등록된 프로젝트가 없습니다.</AlertDescription>
      </Alert>
    );
  }

  if (status === "unauthorized") {
    return (
      <Alert variant="destructive">
        <AlertDescription>세션이 만료되어 다시 로그인이 필요합니다.</AlertDescription>
      </Alert>
    );
  }

  if (status === "forbidden") {
    return (
      <Alert variant="destructive">
        <AlertDescription>프로젝트 목록을 조회할 권한이 없습니다.</AlertDescription>
      </Alert>
    );
  }

  if (status === "error") {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || "프로젝트 목록을 불러오지 못했습니다."}</AlertDescription>
      </Alert>
    );
  }

  return null;
}
