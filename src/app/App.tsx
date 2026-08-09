import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
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
  Workflow,
  CalendarClock,
  ClipboardList,
  Wallet,
  LayoutTemplate,
} from "lucide-react";
import { Toaster } from "@/app/components/ui/sonner";
import { Sidebar, type SidebarItem } from "@/app/components/layout/Sidebar";
import { TopBar } from "@/app/components/layout/TopBar";
import { ProjectScopeBar } from "@/app/components/layout/ProjectScopeBar";
import { getProjectPlanningProgress } from "@/app/projects/projectProgress";
import { useForcedLightTheme } from "@/app/hooks/useTheme";
import { LoginScreen } from "@/app/components/auth/LoginScreen";
import { SignupScreen } from "@/app/components/auth/SignupScreen";
import { PmAnalysis } from "@/app/components/pm/PmAnalysis";
import { PmRequirements } from "@/app/components/pm/PmRequirements";
import { RiskManagement } from "@/app/components/pm/RiskManagement";
import { AiDocSearch } from "@/app/components/pm/AiDocSearch";
import { PmUpload } from "@/app/components/pm/PmUpload";
import { PmAssign } from "@/app/components/pm/PmAssign";
import { PmBudget } from "@/app/components/pm/PmBudget";
import { PmOrganizationChart } from "@/app/components/pm/PmOrganizationChart";
import { PmUiPrototype } from "@/app/components/pm/PmUiPrototype";
import { ProjectOverview } from "@/app/components/pm/ProjectOverview";
import { WeeklyScrum } from "@/app/components/pm/WeeklyScrum";
import { ProjectDetail } from "@/app/components/pm/ProjectDetail";
import { ProjectWizard } from "@/app/components/pm/ProjectWizard";
import { StaffDashboard } from "@/app/components/staff/StaffDashboard";
import { StaffNotice } from "@/app/components/staff/StaffNotice";
import { StaffNoticeBoard } from "@/app/components/staff/StaffNoticeBoard";
import { StaffTaskDetail } from "@/app/components/staff/StaffTaskDetail";
import { StaffDocuments } from "@/app/components/staff/StaffDocuments";
import { StaffContext } from "@/app/components/staff/StaffContext";
import { StaffSubmit } from "@/app/components/staff/StaffSubmit";
import { StaffWeeklyScrum } from "@/app/components/staff/StaffWeeklyScrum";
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
import { PmWbs } from "@/app/components/pm/PmWbs";
import { PmSchedule } from "@/app/components/pm/PmSchedule";
import {
  getProjectLoadError,
  getProjectLoadStatus,
  ProjectListNotice,
  type ProjectLoadStatus,
} from "@/app/components/pm/ProjectListNotice";
import { mapApiProject } from "@/app/projects/projectMapping";
import { RealApplication } from "@/app/real/RealApplication";

// ?…ë¬´ ì¤‘ì‹¬(Task Flow) IA. ê³µì??¬í•­?€ ?„ë¡œ?íŠ¸ ?”ë©´?ì„œ ë¶„ë¦¬???¬ì´?œë°” ?˜ë‹¨ ?…ë¦½ ë©”ë‰´ë¡??”ë‹¤.
const PM_MENU: SidebarItem[] = [
  // [ê°œìš”]
  { key: "dashboard", label: "?„ë¡œ?íŠ¸", icon: LayoutDashboard, group: "ê°œìš”" },
  { key: "orgChart", label: "ì¡°ì§??, icon: Workflow, group: "ê°œìš”" },
  // [ê³„íš]
  { key: "requirements", label: "?”êµ¬?¬í•­", icon: FileText, group: "ê³„íš" },
  { key: "wbs", label: "WBS", icon: Network, group: "ê³„íš" },
  { key: "schedule", label: "?¼ì •", icon: CalendarClock, group: "ê³„íš" },
  { key: "assign", label: "?…ë¬´ ë°°ì •", icon: Users, group: "ê³„íš" },
  { key: "budget", label: "?ˆì‚°", icon: Wallet, group: "ê³„íš" },
  { key: "uiPrototype", label: "UI ?„ë¡œ? í???, icon: LayoutTemplate, group: "ê³„íš" },
  // [?¤í–‰]
  { key: "risk", label: "ë¦¬ìŠ¤??, icon: AlertTriangle, group: "?¤í–‰" },
  { key: "weekly", label: "?„í´ë¦??¤í¬??, icon: ClipboardList, group: "?¤í–‰" },
  // [?„êµ¬]
  { key: "search", label: "?µí•© ì§ˆì˜?‘ë‹µ", icon: MessagesSquare, group: "?„êµ¬" },
  // ?¬ì´?œë°”?ëŠ” ?¨ê²¼ì§€ë§?ê¸°ëŠ¥/?¼ìš°?…ì? ê·¸ë?ë¡??´ì•„?ˆìŒ (pmMenu === "similar")
  // { key: "similar", label: "? ì‚¬ ?„ë¡œ?íŠ¸ ê²€??, icon: FileSearch, group: "?„êµ¬" },
];

const PM_BOTTOM_MENU: SidebarItem[] = [
  { key: "notice", label: "ê³µì??¬í•­", icon: Megaphone },
];

const STAFF_MENU: SidebarItem[] = [
  { key: "tasks", label: "???…ë¬´", icon: ListTodo, group: "?…ë¬´" },
  { key: "notice", label: "ê³µì??¬í•­", icon: Megaphone, group: "?…ë¬´" },
  { key: "submit", label: "?°ì¶œë¬??œì¶œ", icon: Send, group: "?…ë¬´" },
  { key: "weeklyScrum", label: "?„í´ë¦??¤í¬??, icon: ClipboardList, group: "?…ë¬´" },
  { key: "risk", label: "ë¦¬ìŠ¤??, icon: AlertTriangle, group: "?…ë¬´" },
];

// ?„ë¡œ?íŠ¸ ?¨ìœ„ë¡??¤ë¤„???˜ëŠ” PM ë©”ë‰´ (?ë‹¨???„ë¡œ?íŠ¸ ? íƒ ë°??œì‹œ)

const SCOPED_PM = new Set([
  "upload",
  "orgChart",
  "requirements",
  "wbs",
  "schedule",
  "assign",
  "budget",
  "uiPrototype",
  "risk",
  "weekly",
  "search",
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
  // ?”êµ¬?¬í•­ ?˜ì´ì§€ ?ë‹¨ ë¬¸ì„œ ?…ë¡œ??ë¶„ì„ ???„ë˜ ?”êµ¬?¬í•­ ëª©ë¡???¬ì¡°?Œí•˜ê¸??„í•œ ??
  const [requirementsRefreshKey, setRequirementsRefreshKey] = useState(0);

  // [?„ë¡œ?íŠ¸] ??ì¹´ë“œ??"ì§„í–‰ ì¤? ?ì •ê³??¤ë¥¸ ?”ë©´ ?ë‹¨ ë°°ì?ê°€ ?œë¡œ ?¤ë¥´ê²?ë³´ì´ì§€ ?Šë„ë¡?
  // ? íƒ???„ë¡œ?íŠ¸???€?´ì„œ??ê°™ì? ê¸°ì?(getProjectPlanningProgress)?¼ë¡œ ê¸°íš ?„ë£Œ ?¬ë?ë¥?ìºì‹±?œë‹¤.
  // ([?”êµ¬?¬í•­] ??SCOPED ?”ë©´??selectedProjectId?? [?„ë¡œ?íŠ¸] ??—??"?€?œë³´???´ê¸°"ë¡??¤ì–´ê°?
  //  pmDetail ????ê°™ì? ìºì‹œë¥?ê°™ì´ ?´ë‹¤ ?????”ë©´???íƒœ ë°°ì?ê°€ ?œë¡œ ?¤ë¥´ê²?ë³´ì´ì§€ ?Šë„ë¡?)
  const [planningCompleteMap, setPlanningCompleteMap] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const idsToCheck = [selectedProjectId, pmDetail?.id].filter(
      (id): id is string => !!id && planningCompleteMap[id] === undefined,
    );
    if (idsToCheck.length === 0) return;
    let ignore = false;
    Promise.all(
      idsToCheck.map((id) =>
        getProjectPlanningProgress(id)
          .then((progress) => [id, progress.planningComplete] as const)
          .catch(() => null),
      ),
    ).then((results) => {
      if (ignore) return;
      setPlanningCompleteMap((prev) => {
        const next = { ...prev };
        for (const entry of results) {
          if (entry) next[entry[0]] = entry[1];
        }
        return next;
      });
    });
    return () => {
      ignore = true;
    };
  }, [selectedProjectId, pmDetail?.id, planningCompleteMap]);


  const role: Role | null = authSession ? toFrontendRole(authSession.role) : null;


  const startProject = (id: string) =>
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: "ì§„í–‰ì¤?, progress: Math.max(p.progress, 5) }
          : p,
      ),
    );

  // Slack OAuth ì½œë°±(?session=)?¼ë¡œ ?Œì•„?¤ë©´ ?¸ì…˜ ?€?????°ë™ ?”ë©´?¼ë¡œ ?´ë™
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
    if (!role) {
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

  // ë¡œê·¸???Œì›ê°€???”ë©´(role ?†ìŒ)?ì„œ???¤í¬ëª¨ë“œë¥??„ê³  ?¼ì´?¸ë¡œ ê³ ì •?œë‹¤.
  // ?…ì? ì¡°ê±´ë¶€ë¡??¸ì¶œ?????†ìœ¼ë¯€ë¡?early return ?„ì— ?”ë‹¤.
  useForcedLightTheme(!role);

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

  // ì§ì› ê³„ì •?€ /projects ëª©ë¡ ì¡°íšŒê°€ ë§‰í??ˆê±°??ë¹„ì–´?ˆì„ ???ˆì–´??
  // ê·¸ëŸ° ê²½ìš°?ë„ ?”ë©´??ë¹„ì? ?Šë„ë¡??”ë? ?„ë¡œ?íŠ¸ë¡??€ì²´í•œ??
  const FALLBACK_PROJECT: FrontendProjectSummary = {
    id: "1",
    name: "ì§„í–‰ ì¤??„ë¡œ?íŠ¸",
    client: "-",
    status: "ì§„í–‰ì¤?,
    progress: 0,
    dueDate: "-",
    riskCount: 0,
    reqCount: 0,
    wizardStep: 6,
    estimate: "-",
    updatedAt: "-",
    docs: [],
  };

  const selectedProject =
    projects.find((p) => p.id === selectedProjectId) ??
    projects[0] ??
    (!isPm ? FALLBACK_PROJECT : undefined);

  if (isPm) {
    if (SCOPED_PM.has(pmMenu) && !selectedProject) {
      subtitle = "?„ë¡œ?íŠ¸ ? íƒ";
      body = (
        <ProjectListNotice
          status={projectLoadStatus}
          error={projectLoadError}
        />
      );
    } else if (pmMenu === "slack") {
      subtitle = "Slack ?°ë™";
      body = <SlackIntegration />;
    } else if (pmMenu === "orgChart") {
      subtitle = "ì¡°ì§??;
      body = selectedProject ? (
        <PmOrganizationChart key={selectedProject.id} project={selectedProject} />
      ) : (
        <ProjectListNotice status={projectLoadStatus} error={projectLoadError} />
      );
    } else if (pmMenu === "requirements") {
      subtitle = "?”êµ¬?¬í•­";
      body = (
        <div className="space-y-4">
          {/* ?ë‹¨: ë°±ì—”???°ë™ ë¬¸ì„œ ?…ë¡œ???Œì¼ ? íƒÂ·?…ë¡œ?œÂ·ìš”êµ¬ì‚¬??ë¶„ì„) */}
          <PmUpload
            key={selectedProject?.id}
            project={selectedProject!}
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
                        updatedAt: "ë°©ê¸ˆ",
                      }
                    : currentProject,
                ),
              );
            }}
            onAnalysisComplete={() =>
              // ?…ë¡œ??ë¬¸ì„œ ë¶„ì„ ?„ë£Œ ???„ë˜ ?”êµ¬?¬í•­ ëª©ë¡ ?¬ì¡°??
              setRequirementsRefreshKey((key) => key + 1)
            }
          />

          {/* ?˜ë‹¨: ?…ë¡œ??ë¶„ì„??ê²°ê³¼ ê¸°ë°˜ ?”êµ¬?¬í•­ ëª©ë¡ */}
          <PmRequirements
            key={`${selectedProject?.id}:${requirementsRefreshKey}`}
            project={selectedProject!}
            onBackToGeneration={() => handleSelect("wbs")}
          />
        </div>
      );
    } else if (pmMenu === "similar") {
      subtitle = "? ì‚¬ ?„ë¡œ?íŠ¸ ê²€??;
      body = <PmAnalysis key={selectedProject?.id} project={selectedProject!} />;
    } else if (pmMenu === "upload") {
      subtitle = "ë¬¸ì„œ ?…ë¡œ??;
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
                      updatedAt: "ë°©ê¸ˆ",
                    }
                  : currentProject,
              ),
            );
          }}
        />
      );
    } else if (pmMenu === "wbs") {
      subtitle = "WBS";
      body = (
        <PmWbs
          key={selectedProject?.id}
          project={selectedProject!}
          onNavigateNext={() => setPmMenu("schedule")}
        />
      );
    } else if (pmMenu === "schedule") {
      subtitle = "?¼ì •";
      body = (
        <PmSchedule
          key={selectedProject?.id}
          project={selectedProject!}
          onNavigateNext={() => setPmMenu("assign")}
        />
      );
    } else if (pmMenu === "assign") {
      subtitle = "?…ë¬´ ë°°ì •";
      body = (
        <PmAssign
          key={selectedProject?.id}
          project={selectedProject!}
          onNavigateNext={() => setPmMenu("budget")}
        />
      );
    } else if (pmMenu === "budget") {
      subtitle = "?ˆì‚°";
      body = <PmBudget key={selectedProject?.id} project={selectedProject!} />;
    } else if (pmMenu === "uiPrototype") {
      subtitle = "UI ?„ë¡œ? í???;
      body = <PmUiPrototype key={selectedProject?.id} project={selectedProject!} />;
    } else if (pmMenu === "weekly") {
      subtitle = "?„í´ë¦??¤í¬??;
      body = <WeeklyScrum key={selectedProject?.id} project={selectedProject!} />;
    } else if (pmMenu === "search") {
      subtitle = "?µí•© ì§ˆì˜?‘ë‹µ";
      body = (
        <AiDocSearch
          key={selectedProject?.id}
          project={selectedProject!}
          onOpenRequirements={() => handleSelect("requirements")}
          onOpenRisk={() => handleSelect("risk")}
        />
      );
    } else if (pmMenu === "risk") {
      subtitle = "ë¦¬ìŠ¤??;
      body = (
        <RiskManagement
          key={selectedProject?.id}
          project={selectedProject!}
          showCommunicationRisk
          hideManagedRisks
          showTeamProgress
        />
      );
    } else if (pmMenu === "notice") {
      subtitle = "ê³µì??¬í•­";
      body = (
        <StaffNotice
          canCreate
          authorName={authSession.name || "PM"}
          excludeCategories={["PM ?¼ë“œë°?]}
          showKpis={false}
          projectId={selectedProject?.id ?? null}
        />
      );
    } else if (pmWizard) {
      subtitle = `${pmWizard.name} Â· ì¤€ë¹?;
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
      subtitle = "´ë½Ãº¸µå";
      body = (
        <ProjectDetail
          project={pmDetail}
          planningComplete={planningCompleteMap[pmDetail.id]}
          onBack={() => setPmDetail(null)}
          onNavigate={(menu) => {
            setSelectedProjectId(pmDetail.id);
            handleSelect(menu);
          }}
          onUpdateDocs={(docs) => {
            const updated: FrontendProjectSummary = {
              ...pmDetail,
              docs,
              updatedAt: "ë°©ê¸ˆ",
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
      subtitle = "?„ë¡œ?íŠ¸";
      body = (
        <ProjectOverview
          projects={projects}
          setProjects={setProjects}
          pmEmployeeNumber={authSession.employeeNumber}
          projectLoadStatus={projectLoadStatus}
          projectLoadError={projectLoadError}
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
          onExtract={(p, stage = "requirements") => {
            setPmDetail(null);
            setPmWizard(null);
            setSelectedProjectId(p.id);
            setPmMenu(stage);
          }}
        />
      );
    }
  } else {
    if (staffMenu === "slack") {
      subtitle = "Slack ?°ë™";
      body = <SlackIntegration />;
    } else if (staffMenu === "notice") {
      subtitle = "ê³µì??¬í•­";
      body = (
        <StaffNoticeBoard
          currentUserName={authSession?.name ?? "??}
          onSubmitRequested={() => setStaffMenu("weeklyScrum")}
          projectId={selectedProject?.id ?? null}
        />
      );
    } else if (staffMenu === "documents") {
      subtitle = "ë¬¸ì„œ ?µí•© ê´€ë¦?;
      body = <StaffDocuments />;
    } else if (staffMenu === "risk") {
      subtitle = "ë¦¬ìŠ¤??;
      body = selectedProject ? (
        <RiskManagement key={selectedProject.id} project={selectedProject} hideImpactAnalysis />
      ) : (
        <ProjectListNotice status={projectLoadStatus} error={projectLoadError} />
      );
    } else if (staffMenu === "context") {
      subtitle = "RFP ë§¥ë½";
      body = <StaffContext />;
    } else if (staffMenu === "submit") {
      subtitle = "?°ì¶œë¬??œì¶œ";
      body = (
        <StaffSubmit
          project={selectedProject ?? null}
          currentUserName={authSession?.name ?? ""}
        />
      );
    } else if (staffMenu === "weeklyScrum") {
      subtitle = "?„í´ë¦??¤í¬??;
      body = selectedProject ? (
        <StaffWeeklyScrum
          projectId={selectedProject.id}
          projectName={selectedProject.name}
          employeeNumber={authSession?.employeeNumber ?? ""}
          currentUserName={authSession?.name ?? ""}
        />
      ) : (
        <ProjectListNotice status={projectLoadStatus} error={projectLoadError} />
      );
    } else if (staffMenu === "feedback") {
      subtitle = "?¼ë“œë°?;
      body = <StaffFeedback />;
    } else if (staffMenu === "comments") {
      subtitle = "?“ê?";
      body = <StaffComments />;
    } else if (selectedTaskId) {
      subtitle = "?…ë¬´ ?ì„¸";
      body = (
        <StaffTaskDetail
          taskId={selectedTaskId}
          projectId={selectedProjectId || "1"}
          currentUserName={authSession?.name ?? ""}
          onBack={() => setSelectedTaskId(null)}
        />
      );
    } else {
      subtitle = "ì§ì› ?€?œë³´??;
      body = (
        <StaffDashboard
          projectId={selectedProjectId || "1"}
          projectName={selectedProject?.name ?? ""}
          currentUserName={authSession?.name ?? ""}
          onOpenTask={(taskId: string) =>
            setSelectedTaskId(taskId)
          }
        />
      );
    }
  }

  const isScopedScreen =
    (isPm && SCOPED_PM.has(pmMenu)) || (!isPm && staffMenu === "weeklyScrum");
  const topBarMiddleContent = isScopedScreen ? (
    <ProjectScopeBar
      projects={projects}
      value={selectedProjectId}
      onChange={setSelectedProjectId}
      rightSlotId={isPm && pmMenu === "weekly" ? "weekly-scrum-week-nav-slot" : undefined}
      planningComplete={planningCompleteMap[selectedProjectId]}
      compact
    />
  ) : undefined;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-muted/40">
      <Sidebar
        items={menu}
        bottomItems={isPm ? PM_BOTTOM_MENU : undefined}
        active={activeMenu}
        onSelect={handleSelect}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          title={subtitle}
          userName={authSession?.name || (isPm ? "PM" : "Staff")}
          employeeNumber={authSession?.employeeNumber ?? "-"}
          roleLabel={isPm ? "PM" : "ì§ì›"}
          onLogout={handleLogout}
          actions={actions}
          middleContent={topBarMiddleContent}
          projects={projects}
          selectedProjectId={selectedProjectId}
          isPm={isPm}
          showNotifications={isPm}
        />
        <main className="flex-1 overflow-y-auto p-6">{body}</main>
      </div>
      <Toaster />
    </div>
  );
}
