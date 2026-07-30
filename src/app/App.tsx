import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  ClipboardCheck,
  ListTodo,
  BookOpen,
  Send,
  MessageSquareReply,
  MessagesSquare,
  FolderKanban,
  Megaphone,
  FileSearch,
  FileText,
  Network,
  Wand2,
} from "lucide-react";
import { Toaster } from "@/app/components/ui/sonner";
import { Sidebar, type SidebarItem } from "@/app/components/layout/Sidebar";
import { TopBar } from "@/app/components/layout/TopBar";
import { ProjectScopeBar } from "@/app/components/layout/ProjectScopeBar";
import { LoginScreen } from "@/app/components/auth/LoginScreen";
import { SignupScreen } from "@/app/components/auth/SignupScreen";
import { PmAnalysis } from "@/app/components/pm/PmAnalysis";
import { PmRequirements } from "@/app/components/pm/PmRequirements";
import { DocumentLibrary } from "@/app/components/pm/DocumentLibrary";
import { RiskManagement } from "@/app/components/pm/RiskManagement";
import { AiDocSearch } from "@/app/components/pm/AiDocSearch";
import { PmUpload } from "@/app/components/pm/PmUpload";
import { PmReview } from "@/app/components/pm/PmReview";
import { PmAssign } from "@/app/components/pm/PmAssign";
import { ProjectBoard } from "@/app/components/pm/ProjectBoard";
import { ProjectDetail } from "@/app/components/pm/ProjectDetail";
import { ProjectWizard } from "@/app/components/pm/ProjectWizard";
import { StaffDashboard } from "@/app/components/staff/StaffDashboard";
import { StaffNotice } from "@/app/components/staff/StaffNotice";
import { StaffTaskDetail } from "@/app/components/staff/StaffTaskDetail";
import { StaffDocuments } from "@/app/components/staff/StaffDocuments";
import { StaffRisk, StaffRiskActions } from "@/app/components/staff/StaffRisk";
import { StaffContext } from "@/app/components/staff/StaffContext";
import { StaffSubmit } from "@/app/components/staff/StaffSubmit";
import { StaffFeedback } from "@/app/components/staff/StaffFeedback";
import { StaffComments } from "@/app/components/staff/StaffComments";
import { SlackIntegration } from "@/app/components/integrations/SlackIntegration";
import {
  projectRepository,
  toFrontendRole,
  type LoginVerifyResponse,
  type Role,
} from "@/app/api/projectRepository";
import { slackApi } from "@/app/api/slackApi";
import type { ProjectSummary as FrontendProjectSummary } from "@/app/projects/projectTypes";
import { PmGeneration } from "@/app/components/pm/PmGeneration";
import {
  getProjectLoadError,
  getProjectLoadStatus,
  ProjectListNotice,
  type ProjectLoadStatus,
} from "@/app/components/pm/ProjectListNotice";
import { mapApiProject } from "@/app/projects/projectMapping";
import { RealApplication } from "@/app/real/RealApplication";

// 업무 중심(Task Flow) IA. AI 기능은 독립 메뉴가 아니라 각 화면 내 액션으로 흡수한다.
const PM_MENU: SidebarItem[] = [
  // [개요]
  { key: "dashboard", label: "프로젝트", icon: LayoutDashboard, group: "개요" },
  { key: "notice", label: "공지사항", icon: Megaphone, group: "개요" },
  // [계획]
  { key: "requirements", label: "요구사항", icon: FileText, group: "계획" },
  { key: "generation", label: "WBS · 일정", icon: Network, group: "계획" },
  { key: "assign", label: "업무 (배정)", icon: Users, group: "계획" },
  // [실행]
  { key: "review", label: "검토", icon: ClipboardCheck, group: "실행" },
  { key: "risk", label: "리스크", icon: AlertTriangle, group: "실행" },
  { key: "documents", label: "문서함", icon: FolderKanban, group: "실행" },
  // [도구]
  { key: "operational", label: "운영 산출물", icon: Wand2, group: "도구" },
  { key: "search", label: "통합 질의응답", icon: MessagesSquare, group: "도구" },
];

// 사이드바 하단(구분선 아래)에 두는 보조 도구. 요구사항 화면 우측 패널로도 연동된다.
const PM_FOOTER_MENU: SidebarItem[] = [
  { key: "similar", label: "유사 프로젝트 검색", icon: FileSearch },
];

const STAFF_MENU: SidebarItem[] = [
  { key: "tasks", label: "내 업무", icon: ListTodo, group: "업무" },
  { key: "notice", label: "공지사항", icon: Megaphone, group: "업무" },
  { key: "submit", label: "산출물 제출", icon: Send, group: "업무" },
  { key: "risk", label: "리스크", icon: AlertTriangle, group: "업무" },
  { key: "context", label: "RFP 맥락", icon: BookOpen, group: "자료" },
  { key: "documents", label: "문서 통합 관리", icon: FolderKanban, group: "자료" },
  { key: "feedback", label: "피드백", icon: MessageSquareReply, group: "소통" },
  { key: "comments", label: "댓글", icon: MessagesSquare, group: "소통" },
];

// 프로젝트 단위로 다뤄야 하는 PM 메뉴 (상단에 프로젝트 선택 바 표시)

const SCOPED_PM = new Set([
  "upload",
  "requirements",
  "generation",
  "operational",
  "assign",
  "documents",
  "search",
  "risk",
  "review",
  "similar",
]);

export type ApplicationMode = "demo" | "real";

export default function App({
  mode = "demo",
}: {
  mode?: ApplicationMode;
}) {
  return mode === "real" ? <RealApplication /> : <DemoApplication />;
}

function DemoApplication() {
  const [authSession, setAuthSession] = useState(() =>
    projectRepository.getStoredSession(),
  );
  const [authView, setAuthView] = useState<"login" | "signup">("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [pmMenu, setPmMenu] = useState("dashboard");
  const [staffMenu, setStaffMenu] = useState("tasks");
  const [selectedTaskId, setSelectedTaskId] =
    useState<string | null>(null);
  // const [projects, setProjects] = useState<FrontendProjectSummary[]>([]);

  const [projects, setProjects] = useState<FrontendProjectSummary[]>([]);

  const [projectLoadStatus, setProjectLoadStatus] = useState<ProjectLoadStatus>("idle");
  const [projectLoadError, setProjectLoadError] = useState("");
  const [pmDetail, setPmDetail] = useState<FrontendProjectSummary | null>(null);
  const [pmWizard, setPmWizard] = useState<FrontendProjectSummary | null>(null);
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
    setSelectedTaskId(null);
  };

  const handleLogout = () => {
    projectRepository.logout();
    setAuthSession(null);
  };

  const reloadProjectsAfterDeletion = async (deletedProjectId: string) => {
    try {
      const mapped = (await projectRepository.listProjects()).map(mapApiProject);
      setProjects(mapped);
      setSelectedProjectId((current) =>
        current !== deletedProjectId &&
        mapped.some((project) => project.id === current)
          ? current
          : mapped[0]?.id ?? "",
      );
      setPmDetail((current) =>
        current?.id === deletedProjectId ? null : current,
      );
      setPmWizard((current) =>
        current?.id === deletedProjectId ? null : current,
      );
      setProjectLoadStatus(mapped.length > 0 ? "ready" : "empty");
      setProjectLoadError("");
    } catch (caught) {
      setProjectLoadStatus("error");
      setProjectLoadError(getProjectLoadError(caught));
      throw caught;
    }
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
    } else {
      setStaffMenu(key);
      setSelectedTaskId(null);
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
    } else if (pmMenu === "notice") {
      subtitle = "공지사항";
      body = <StaffNotice excludeCategories={["PM 피드백"]} canCreate />;
    } else if (pmMenu === "requirements") {
      subtitle = "요구사항";
      body = (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <PmRequirements
            key={selectedProject?.id}
            project={selectedProject!}
            onBackToGeneration={() => handleSelect("generation")}
          />
          <div className="xl:sticky xl:top-0 xl:self-start">
            <PmAnalysis variant="panel" project={selectedProject!} />
          </div>
        </div>
      );
    } else if (pmMenu === "similar") {
      subtitle = "유사 프로젝트 검색";
      body = <PmAnalysis key={selectedProject?.id} project={selectedProject!} />;
    } else if (pmMenu === "upload") {
      subtitle = "문서 업로드";
      body = (
        <PmUpload
          key={selectedProject?.id}
          project={selectedProject!}
          onAnalysisComplete={() => {
            setPmMenu("requirements");
          }}
          onDocumentsUploaded={(documents) => {
            setProjects((currentProjects) =>
              currentProjects.map((currentProject) =>
                currentProject.id === selectedProject!.id
                  ? {
                      ...currentProject,
                      docs: [
                        ...currentProject.docs,
                        ...documents.map((document) => ({
                          name: document.originalFileName,
                          type: "RFP" as const,
                        })),
                      ],
                      updatedAt: "방금",
                    }
                  : currentProject,
              ),
            );
          }}
        />
      );
    } else if (pmMenu === "generation") {
      subtitle = "WBS · 일정";
      body = (
        <PmGeneration
          key={selectedProject?.id}
          project={selectedProject!}
          view="wbs"
          onOpenDocuments={() => {
            setPmMenu("documents");
          }}
        />
      );
    } else if (pmMenu === "operational") {
      subtitle = "운영 산출물";
      body = (
        <PmGeneration
          key={selectedProject?.id}
          project={selectedProject!}
          view="operational"
          onOpenDocuments={() => {
            setPmMenu("documents");
          }}
        />
      );
    } else if (pmMenu === "assign") {
      subtitle = "업무";
      body = (
        <PmAssign
          key={selectedProject?.id}
          project={selectedProject!}
        />
      );
    } else if (pmMenu === "documents") {
      subtitle = "문서함";
      body = (
        <DocumentLibrary
          key={selectedProject?.id}
          project={selectedProject!}
          onOpenAiGeneration={() => {
            setPmMenu("operational");
          }}
        />
      );
    } else if (pmMenu === "search") {
      subtitle = "AI 통합 질의응답";
      body = (
        <AiDocSearch
          key={selectedProject?.id}
          project={selectedProject!}
          onOpenRequirements={() => handleSelect("requirements")}
          onOpenRisk={() => handleSelect("risk")}
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
          onNavigate={(menu) => {
            setSelectedProjectId(pmDetail.id);
            handleSelect(menu);
          }}
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
            pmEmployeeNumber={authSession.employeeNumber}
            onProjectCreated={(project) => {
              setSelectedProjectId(project.id);
              setProjectLoadStatus("ready");
            }}
            onProjectDeleted={reloadProjectsAfterDeletion}
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
              setSelectedProjectId(p.id);
              setPmMenu("upload");
            }}
          />
        </div>
      );
    }
  } else {
    if (staffMenu === "slack") {
      subtitle = "Slack 연동";
      body = <SlackIntegration />;
    } else if (staffMenu === "notice") {
      subtitle = "공지사항";
      body = <StaffNotice />;
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
    } else if (selectedTaskId) {
      subtitle = "업무 상세";
      body = (
        <StaffTaskDetail
          taskId={selectedTaskId}
          currentUserName={authSession?.name ?? ""}
          onBack={() => setSelectedTaskId(null)}
        />
      );
    } else {
      subtitle = "직원 대시보드";
      body = (
        <StaffDashboard
          projectId={selectedProjectId || "1"}
          currentUserName={authSession?.name ?? ""}
          onOpenTask={(taskId: string) =>
            setSelectedTaskId(taskId)
          }
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
      <Sidebar
        items={menu}
        bottomItems={isPm ? PM_FOOTER_MENU : undefined}
        active={activeMenu}
        onSelect={handleSelect}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          title={subtitle}
          userName={authSession?.name || (isPm ? "PM" : "Staff")}
          employeeNumber={authSession?.employeeNumber ?? "-"}
          roleLabel={isPm ? "PM" : "직원"}
          onLogout={handleLogout}
          actions={actions}
          projects={projects}
          selectedProjectId={selectedProjectId}
          isPm={isPm}
        />
        <main className="flex-1 overflow-y-auto p-6">{body}</main>
      </div>
      <Toaster />
    </div>
  );
}
