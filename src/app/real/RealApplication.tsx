import { useEffect, useState } from "react";
import { FolderKanban, LayoutDashboard } from "lucide-react";
import {
  projectRepository,
  toFrontendRole,
  type LoginVerifyResponse,
  type Role,
} from "@/app/api/projectRepository";
import { LoginScreen } from "@/app/components/auth/LoginScreen";
import { SignupScreen } from "@/app/components/auth/SignupScreen";
import { OrganizationChartArtifactCard } from "@/app/components/common/OrganizationChartArtifactCard";
import { UiMockupArtifactCard } from "@/app/components/common/UiMockupArtifactCard";
import { ProjectScopeBar } from "@/app/components/layout/ProjectScopeBar";
import { Sidebar, type SidebarItem } from "@/app/components/layout/Sidebar";
import { TopBar } from "@/app/components/layout/TopBar";
import {
  getProjectLoadError,
  getProjectLoadStatus,
  ProjectListNotice,
  type ProjectLoadStatus,
} from "@/app/components/pm/ProjectListNotice";
import { ProjectBoard } from "@/app/components/pm/ProjectBoard";
import { PmUpload } from "@/app/components/pm/PmUpload";
import { Button } from "@/app/components/ui/button";
import { Toaster } from "@/app/components/ui/sonner";
import { mapApiProject } from "@/app/projects/projectMapping";
import type { ProjectSummary } from "@/app/projects/projectTypes";

const REAL_PM_MENU: SidebarItem[] = [
  {
    key: "projects",
    label: "프로젝트",
    icon: LayoutDashboard,
    group: "개요",
  },
  {
    key: "project-data",
    label: "문서 및 요구사항",
    icon: FolderKanban,
    group: "개요",
  },
];

const REAL_STAFF_MENU: SidebarItem[] = [
  {
    key: "project-data",
    label: "프로젝트 산출물",
    icon: FolderKanban,
    group: "개요",
  },
];

type RealPmMenu = "projects" | "project-data";

export function RealApplication() {
  const [authSession, setAuthSession] = useState(() =>
    projectRepository.getStoredSession(),
  );
  const [authView, setAuthView] = useState<"login" | "signup">("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [activeMenu, setActiveMenu] = useState<RealPmMenu>(
    () => readRealLocation().menu,
  );
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(
    () => readRealLocation().projectId,
  );
  const [projectLoadStatus, setProjectLoadStatus] =
    useState<ProjectLoadStatus>("idle");
  const [projectLoadError, setProjectLoadError] = useState("");

  const role: Role | null = authSession
    ? toFrontendRole(authSession.role)
    : null;

  useEffect(() => {
    const handleAuthExpired = () => setAuthSession(null);
    window.addEventListener("aipm:auth-expired", handleAuthExpired);
    return () =>
      window.removeEventListener("aipm:auth-expired", handleAuthExpired);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const location = readRealLocation();
      setActiveMenu(location.menu);
      setSelectedProjectId(location.projectId);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!role) {
      setProjects([]);
      setSelectedProjectId("");
      setProjectLoadStatus("idle");
      setProjectLoadError("");
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
      .catch((error) => {
        if (ignore) return;
        setProjects([]);
        setSelectedProjectId("");
        setProjectLoadStatus(getProjectLoadStatus(error));
        setProjectLoadError(getProjectLoadError(error));
      });

    return () => {
      ignore = true;
    };
  }, [role]);

  const openLogin = (options?: { email?: string; message?: string }) => {
    setAuthView("login");
    setLoginEmail(options?.email ?? "");
    setLoginMessage(options?.message ?? "");
  };

  const handleLogin = (session: LoginVerifyResponse) => {
    const location = readRealLocation();
    setAuthSession(session);
    setActiveMenu(
      toFrontendRole(session.role) === "pm" ? location.menu : "project-data",
    );
    setSelectedProjectId(location.projectId);
  };

  const handleLogout = () => {
    projectRepository.logout();
    setAuthSession(null);
    setProjects([]);
    setSelectedProjectId("");
    setActiveMenu("projects");
    replaceRealLocation({ menu: "projects", projectId: "" });
  };

  const openProjects = () => {
    setActiveMenu("projects");
    pushRealLocation({ menu: "projects", projectId: selectedProjectId });
  };

  const openProjectData = (projectId: string) => {
    setSelectedProjectId(projectId);
    setActiveMenu("project-data");
    pushRealLocation({ menu: "project-data", projectId });
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
      setProjectLoadStatus(mapped.length > 0 ? "ready" : "empty");
      setProjectLoadError("");
    } catch (error) {
      setProjectLoadStatus(getProjectLoadStatus(error));
      setProjectLoadError(getProjectLoadError(error));
      throw error;
    }
  };

  if (!role) {
    return (
      <div className="contents" data-app-mode="real">
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
      </div>
    );
  }

  const isPm = role === "pm";
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? projects[0];

  let title = "프로젝트 산출물";
  let body: React.ReactNode = selectedProject ? (
    <div className="space-y-4">
      <ProjectScopeBar
        projects={projects}
        value={selectedProjectId}
        onChange={openProjectData}
      />
      <OrganizationChartArtifactCard
        projectId={selectedProject.id}
        canGenerate={false}
      />
      <UiMockupArtifactCard projectId={selectedProject.id} canGenerate={false} />
    </div>
  ) : (
    <ProjectListNotice status={projectLoadStatus} error={projectLoadError} />
  );

  if (isPm && activeMenu === "project-data") {
    title = "대시보드";
    body = selectedProject ? (
      <div className="space-y-4">
        <ProjectScopeBar
          projects={projects}
          value={selectedProjectId}
          onChange={openProjectData}
        />
        <PmUpload
          key={selectedProject.id}
          mode="real"
          project={selectedProject}
        />
      </div>
    ) : (
      <ProjectListNotice
        status={projectLoadStatus}
        error={projectLoadError}
      />
    );
  } else if (isPm) {
    title = "프로젝트";
    body = (
      <div className="space-y-4">
        <ProjectListNotice
          status={projectLoadStatus}
          error={projectLoadError}
        />
        {projectLoadStatus === "ready" || projectLoadStatus === "empty" ? (
          <ProjectBoard
            mode="real"
            projects={projects}
            setProjects={setProjects}
            pmEmployeeNumber={authSession.employeeNumber}
            onProjectCreated={(project) => {
              setSelectedProjectId(project.id);
              setProjectLoadStatus("ready");
            }}
            onProjectDeleted={reloadProjectsAfterDeletion}
            onOpenOperational={(project) => {
              openProjectData(project.id);
            }}
            onOpenWizard={(project) => {
              openProjectData(project.id);
            }}
            onExtract={(project) => {
              openProjectData(project.id);
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="flex h-screen w-full overflow-hidden bg-muted/40"
      data-app-mode="real"
    >
      <Sidebar
        items={isPm ? REAL_PM_MENU : REAL_STAFF_MENU}
        active={isPm ? activeMenu : "project-data"}
        showIntegrations={false}
        hideOnMobile
        onSelect={(key) => {
          if (key === "projects" && isPm) {
            openProjects();
          } else if (key === "project-data" && selectedProject) {
            openProjectData(selectedProject.id);
          }
        }}
      />
      <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-[960px] flex-col">
        <TopBar
          title={title}
          userName={authSession.name || (isPm ? "PM" : "Staff")}
          employeeNumber={authSession.employeeNumber}
          roleLabel={isPm ? "PM" : "직원"}
          onLogout={handleLogout}
          projects={projects}
          selectedProjectId={selectedProjectId}
          isPm={isPm}
          showNotifications={false}
          compactOnMobile
        />
        <RealMobileNavigation
          isPm={isPm}
          activeMenu={activeMenu}
          hasSelectedProject={Boolean(selectedProject)}
          onProjects={openProjects}
          onProjectData={() => {
            if (selectedProject) openProjectData(selectedProject.id);
          }}
        />
        <main className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          {body}
        </main>
        </div>
      </div>
      <Toaster />
    </div>
  );
}

function RealMobileNavigation({
  isPm,
  activeMenu,
  hasSelectedProject,
  onProjects,
  onProjectData,
}: {
  isPm: boolean;
  activeMenu: RealPmMenu;
  hasSelectedProject: boolean;
  onProjects: () => void;
  onProjectData: () => void;
}) {
  if (!isPm) {
    return (
      <nav
        aria-label="실데이터 화면"
        className="border-b border-border bg-card p-2 md:hidden"
      >
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="w-full"
          disabled={!hasSelectedProject}
          onClick={onProjectData}
        >
          <FolderKanban className="size-4" />
          프로젝트 산출물
        </Button>
      </nav>
    );
  }

  return (
    <nav
      aria-label="실데이터 화면"
      className="grid grid-cols-2 gap-1 border-b border-border bg-card p-2 md:hidden"
    >
      <Button
        type="button"
        size="sm"
        variant={activeMenu === "projects" ? "secondary" : "ghost"}
        onClick={onProjects}
      >
        <LayoutDashboard className="size-4" />
        프로젝트
      </Button>
      <Button
        type="button"
        size="sm"
        variant={activeMenu === "project-data" ? "secondary" : "ghost"}
        disabled={!hasSelectedProject}
        onClick={onProjectData}
      >
        <FolderKanban className="size-4" />
        문서 및 요구사항
      </Button>
    </nav>
  );
}

function readRealLocation(): {
  menu: RealPmMenu;
  projectId: string;
} {
  const match = window.location.pathname.match(
    /^\/real\/projects\/([^/]+)\/data\/?$/,
  );

  if (!match) {
    return { menu: "projects", projectId: "" };
  }

  try {
    return {
      menu: "project-data",
      projectId: decodeURIComponent(match[1]),
    };
  } catch {
    return { menu: "projects", projectId: "" };
  }
}

function pushRealLocation(location: {
  menu: RealPmMenu;
  projectId: string;
}) {
  const pathname = realPathname(location);
  if (window.location.pathname !== pathname) {
    window.history.pushState({}, "", pathname);
  }
}

function replaceRealLocation(location: {
  menu: RealPmMenu;
  projectId: string;
}) {
  window.history.replaceState({}, "", realPathname(location));
}

function realPathname(location: {
  menu: RealPmMenu;
  projectId: string;
}) {
  if (location.menu === "project-data" && location.projectId) {
    return `/real/projects/${encodeURIComponent(location.projectId)}/data`;
  }
  return "/real";
}
