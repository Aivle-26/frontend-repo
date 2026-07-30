import { expect, test, type Page, type Route } from "@playwright/test";

const realProject = {
  projectId: 41,
  name: "Live Contract Project",
  description: "Persisted backend project",
  pmEmployeeNumber: "PM-REAL",
  status: "DRAFT",
  plannedStartDate: "2026-08-01",
  plannedEndDate: "2026-09-30",
  createdAt: "2026-07-29T00:00:00",
  updatedAt: "2026-07-29T00:00:00",
};

const realDocument = {
  documentId: 310,
  originalFileName: "live-contract.txt",
  status: "UPLOADED",
  fileSize: 2048,
};

const realRequirement = {
  requirementId: 711,
  analysisResultId: 611,
  sourceDocumentId: realDocument.documentId,
  externalReferenceId: 1,
  type: "FUNCTIONAL",
  title: "Persisted login requirement",
  description: "Loaded from the backend requirements response",
  acceptanceCriteria: null,
  dueDate: null,
  deliverableName: null,
  securityCondition: null,
  sourceDocumentName: realDocument.originalFileName,
  sourceExcerpt: null,
  priority: "HIGH",
  status: "UNCONFIRMED",
  confirmed: false,
  createdAt: "2026-07-29T00:00:00",
  updatedAt: "2026-07-29T00:00:00",
};

const demoProjectNames = [
  "신제품 출시 프로젝트",
  "브랜드 리뉴얼 프로젝트",
  "교통관제 시스템 구축",
];

test("keeps the existing root route and activates real mode for direct paths", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator('[data-app-mode="real"]')).toHaveCount(0);
  await expect(page.locator("#email")).toBeVisible();

  await page.goto(`/real/projects/${realProject.projectId}/data`);
  await expect(page.locator('[data-app-mode="real"]')).toBeVisible();
  await expect(page.locator("#email")).toBeVisible();

  await page.reload();
  await expect(page.locator('[data-app-mode="real"]')).toBeVisible();
  await expect(page.locator("#email")).toBeVisible();
});

test("shows an honest project empty state without demo projects", async ({
  page,
}) => {
  await mockLogin(page);
  await mockProjectList(page, []);
  await login(page);

  await expect(page.getByText("등록된 프로젝트가 없습니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "새 프로젝트" })).toBeVisible();
  await expectNoDemoProjects(page);
  await expect(page.getByText("진행률", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Slack 연동", { exact: true })).toHaveCount(0);
});

test("accepts the current backend login session contract", async ({ page }) => {
  await mockLogin(page);
  await mockProjectList(page, []);
  await login(page);

  const storedSession = await page.evaluate(() => {
    const raw = localStorage.getItem("aipm.authSession");
    return raw ? JSON.parse(raw) : null;
  });

  expect(storedSession).toEqual(
    expect.objectContaining({
      employeeNumber: "PM-REAL",
      accessToken: "real-route-access-token",
      refreshToken: "real-route-refresh-token",
    }),
  );
  expect(storedSession).not.toHaveProperty("lastActivityAt");
  expect(storedSession).not.toHaveProperty("inactivityTimeoutMinutes");
  await expect(page.locator("#email")).toHaveCount(0);
});

test("uses the overview label, hides real filters, and sorts by nearest end date", async ({
  page,
}) => {
  const endingSoonProject = {
    ...realProject,
    projectId: 42,
    name: "Ending Soon Project",
    status: "ACTIVE",
    plannedEndDate: "2026-08-15",
  };
  const endingLaterProject = {
    ...realProject,
    projectId: 43,
    name: "Ending Later Project",
    plannedEndDate: "2026-12-31",
  };

  await mockLogin(page);
  await mockProjectList(page, [
    endingLaterProject,
    realProject,
    endingSoonProject,
  ]);
  await login(page);

  await expect(page.getByText("개요", { exact: true })).toBeVisible();
  await expect(page.getByText("실데이터", { exact: true })).toHaveCount(0);

  for (const label of ["전체", "진행중", "준비", "승인대기", "완료"]) {
    await expect(
      page.getByRole("button", {
        name: new RegExp(`^${label}\\s+\\d+$`),
      }),
    ).toHaveCount(0);
  }

  const projectCards = page.getByTestId("real-project-card");
  await expect(projectCards).toHaveCount(3);
  expect(
    await projectCards.evaluateAll((cards) =>
      cards.map((card) => card.getAttribute("data-project-id")),
    ),
  ).toEqual(["42", "41", "43"]);

  await expect(
    projectCards
      .filter({ hasText: realProject.name })
      .getByText("준비", { exact: true }),
  ).toHaveCount(2);
  await expect(
    projectCards
      .filter({ hasText: endingSoonProject.name })
      .getByText("진행 중", { exact: true }),
  ).toHaveCount(2);
});

test("does not replace a project API failure with demo data", async ({
  page,
}) => {
  await mockLogin(page);
  await page.route("**/api/projects", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "project service unavailable" }),
    });
  });
  await login(page);

  await expect(page.getByText("project service unavailable")).toBeVisible();
  await expect(page.getByRole("button", { name: "새 프로젝트" })).toHaveCount(0);
  await expectNoDemoProjects(page);
});

test("keeps 403 separate from authentication failure", async ({ page }) => {
  await mockLogin(page);
  await page.route("**/api/projects", async (route) => {
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ message: "forbidden" }),
    });
  });
  await login(page);

  await expect(
    page.getByText("프로젝트 목록을 조회할 권한이 없습니다."),
  ).toBeVisible();
  await expect(page.locator("#email")).toHaveCount(0);
  await expectNoDemoProjects(page);
});

test("refreshes once with the current backend session contract", async ({
  page,
}) => {
  let projectRequests = 0;
  let refreshRequests = 0;
  let refreshRequestBody: unknown;

  await mockLogin(page);
  await page.route("**/api/users/refresh", async (route) => {
    refreshRequests += 1;
    refreshRequestBody = route.request().postDataJSON();
    const now = Date.now();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        authenticated: true,
        employeeNumber: "PM-REAL",
        name: "Real Route PM",
        role: "PM",
        accessToken: "refreshed-access-token",
        refreshToken: "refreshed-refresh-token",
        accessTokenExpiresAt: now + 3_600_000,
        absoluteExpiresAt: now + 86_400_000,
        serverTime: now,
      }),
    });
  });
  await page.route("**/api/projects", async (route) => {
    projectRequests += 1;
    if (projectRequests === 1) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "access expired" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([realProject]),
    });
  });
  await login(page);

  await expect(page.getByText(realProject.name, { exact: true })).toBeVisible();
  expect(projectRequests).toBe(2);
  expect(refreshRequests).toBe(1);
  expect(refreshRequestBody).toEqual({
    refreshToken: "real-route-refresh-token",
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("aipm.authSession");
        return raw ? JSON.parse(raw).accessToken : null;
      }),
    )
    .toBe("refreshed-access-token");
});

test("returns to login when a 401 cannot be refreshed", async ({ page }) => {
  await mockLogin(page);
  await page.route("**/api/users/refresh", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "refresh expired" }),
    });
  });
  await page.route("**/api/projects", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "access expired" }),
    });
  });
  await login(page);

  await expect(page.locator("#email")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("aipm.authSession")),
    )
    .toBeNull();
});

test("renders only server projects and preserves real mode during navigation and refresh", async ({
  page,
}) => {
  let documentRequests = 0;
  let requirementRequests = 0;
  await mockLogin(page);
  await mockProjectList(page, [realProject]);
  await page.route(
    `**/api/projects/${realProject.projectId}/documents`,
    async (route) => {
      documentRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projectId: realProject.projectId,
          documents: [],
        }),
      });
    },
  );
  await page.route(
    `**/api/projects/${realProject.projectId}/requirements`,
    async (route) => {
      requirementRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(requirementsResponse([])),
      });
    },
  );
  await login(page);

  await expect(page.getByText(realProject.name, { exact: true })).toBeVisible();
  await expect(page.getByText("PM PM-REAL", { exact: true })).toBeVisible();
  await expectNoDemoProjects(page);
  await expect(page.getByText("진행률", { exact: true })).toHaveCount(0);
  await expect(page.getByText("리스크", { exact: true })).toHaveCount(0);

  await page
    .getByRole("button", { name: "문서 및 요구사항", exact: true })
    .last()
    .click();

  await expect(page).toHaveURL(
    new RegExp(`/real/projects/${realProject.projectId}/data$`),
  );
  await expect(page.getByText("업로드된 문서가 없습니다.")).toBeVisible();
  await expect(
    page.getByText(
      "요구사항을 분석하려면 먼저 프로젝트 문서를 업로드해 주세요.",
    ),
  ).toBeVisible();
  await expect(page.getByText("도시인프라-rfp-2024.pdf")).toHaveCount(0);

  await page.reload();
  await expect(page).toHaveURL(
    new RegExp(`/real/projects/${realProject.projectId}/data$`),
  );
  await expect(page.getByText("업로드된 문서가 없습니다.")).toBeVisible();
  expect(documentRequests).toBeGreaterThanOrEqual(2);
  expect(requirementRequests).toBeGreaterThanOrEqual(2);
});

test("renders persisted documents and requirements without placeholders", async ({
  page,
}) => {
  await setupProjectData(page, [realDocument], [realRequirement]);
  await login(page);
  await openProjectData(page);

  await expect(
    page
      .getByRole("table")
      .first()
      .getByText(realDocument.originalFileName, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(realRequirement.title, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(realRequirement.description, { exact: true }),
  ).toHaveCount(0);
  const requirementsTable = page.getByRole("table").nth(1);
  await expect(
    requirementsTable.getByRole("columnheader", {
      name: "제목",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    requirementsTable.getByRole("columnheader", {
      name: "설명",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(requirementsTable).toHaveClass(/table-fixed/);
  await expect(
    page.getByText(
      "서버에 저장된 요구사항 제목·유형·검토 상태를 표시합니다.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    await requirementsTable
      .getByText(realRequirement.title, { exact: true })
      .evaluate((element) => getComputedStyle(element).whiteSpace),
  ).toBe("normal");
  await expect(page.getByText("검토 전", { exact: true })).toBeVisible();
  await expect(
    page.getByText("AI 요구사항 추출은 아직 연결되지 않았습니다."),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "다운로드" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "삭제" })).toHaveCount(0);
});

test("shows the real analysis state, blocks duplicates, and keeps documents on failure", async ({
  page,
}) => {
  let analyzeCalls = 0;
  let releaseAnalysis: (() => void) | undefined;
  const analysisGate = new Promise<void>((resolve) => {
    releaseAnalysis = resolve;
  });

  await setupProjectData(page, [realDocument], []);
  await page.route(
    `**/api/projects/${realProject.projectId}/requirements/analyze`,
    async (route) => {
      analyzeCalls += 1;
      await analysisGate;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "analysis unavailable" }),
      });
    },
  );
  await login(page);
  await openProjectData(page);

  const analyzeButton = page.getByRole("button", {
    name: "전체 문서 분석",
    exact: true,
  });
  await expect(
    page.getByText("아직 도출된 요구사항이 없습니다."),
  ).toBeVisible();
  await analyzeButton.click();

  await expect(
    page.getByText(
      "요구사항을 분석 중입니다. 완료될 때까지 다시 실행할 수 없습니다.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "요구사항 분석 중", exact: true }).first(),
  ).toBeDisabled();
  expect(analyzeCalls).toBe(1);

  releaseAnalysis?.();
  await expect(
    page
      .getByRole("alert")
      .getByText(
        "분석 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
      ),
  ).toBeVisible();
  await expect(
    page
      .getByRole("table")
      .first()
      .getByText(realDocument.originalFileName, { exact: true }),
  ).toBeVisible();
  expect(analyzeCalls).toBe(1);
});

test("creates a project only after a successful backend response", async ({
  page,
}) => {
  let createBody: unknown;
  await mockLogin(page);
  await mockProjectList(page, []);
  await page.route("**/api/projects/drafts", async (route) => {
    createBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        projectId: 99,
        name: "Created Backend Project",
        pmEmployeeNumber: "PM-REAL",
        status: "DRAFT",
        plannedStartDate: "2026-08-10",
        plannedEndDate: "2026-09-10",
      }),
    });
  });
  await login(page);

  await page.getByRole("button", { name: "새 프로젝트" }).click();
  await page.getByPlaceholder("예: 신규 커머스 플랫폼 구축").fill(
    "Created Backend Project",
  );
  await page.locator("#new-project-start-date").fill("2026-08-10");
  await page.locator("#new-project-end-date").fill("2026-09-10");
  await page.getByRole("button", { name: "프로젝트 생성" }).click();

  await expect(
    page.getByText("Created Backend Project", { exact: true }),
  ).toBeVisible();
  expect(createBody).toEqual({
    name: "Created Backend Project",
    description: null,
    pmEmployeeNumber: "PM-REAL",
    plannedStartDate: "2026-08-10",
    plannedEndDate: "2026-09-10",
  });
  await expect(page.getByText("진행률", { exact: true })).toHaveCount(0);
});

test("shows a 409 project conflict without adding a local-only project", async ({
  page,
}) => {
  await mockLogin(page);
  await mockProjectList(page, []);
  await page.route("**/api/projects/drafts", async (route) => {
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ message: "project name already exists" }),
    });
  });
  await login(page);

  await page.getByRole("button", { name: "새 프로젝트" }).click();
  await page.getByPlaceholder("예: 신규 커머스 플랫폼 구축").fill(
    "Rejected Local Project",
  );
  await page.locator("#new-project-start-date").fill("2026-08-10");
  await page.locator("#new-project-end-date").fill("2026-09-10");
  await page.getByRole("button", { name: "프로젝트 생성" }).click();

  await expect(
    page.getByRole("dialog").getByText("project name already exists"),
  ).toBeVisible();
  await expect(
    page.getByText("Rejected Local Project", { exact: true }),
  ).toHaveCount(0);
});

test("deletes on the server and then reloads the project list", async ({
  page,
}) => {
  const calls: string[] = [];
  let projects = [realProject];
  await mockLogin(page);
  await page.route("**/api/projects", async (route) => {
    calls.push("GET");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(projects),
    });
  });
  await page.route(
    `**/api/projects/${realProject.projectId}`,
    async (route) => {
      calls.push("DELETE");
      projects = [];
      await route.fulfill({ status: 204, body: "" });
    },
  );
  await login(page);

  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "삭제", exact: true })
    .click();

  await expect(page.getByText("등록된 프로젝트가 없습니다.")).toBeVisible();
  expect(calls).toEqual(["GET", "DELETE", "GET"]);
  await expect(page.getByText(realProject.name, { exact: true })).toHaveCount(0);
});

test("uploads a real document and refreshes the server document list", async ({
  page,
}) => {
  let documents: Array<typeof realDocument> = [];
  let uploadCalls = 0;
  await mockLogin(page);
  await mockProjectList(page, [realProject]);
  await page.route(
    `**/api/projects/${realProject.projectId}/documents`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projectId: realProject.projectId,
          documents,
        }),
      });
    },
  );
  await page.route(
    `**/api/projects/${realProject.projectId}/documents/upload`,
    async (route) => {
      uploadCalls += 1;
      documents = [realDocument];
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          projectId: realProject.projectId,
          documents,
        }),
      });
    },
  );
  await page.route(
    `**/api/projects/${realProject.projectId}/requirements`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(requirementsResponse([])),
      });
    },
  );
  await login(page);
  await openProjectData(page);

  await page.locator('input[type="file"]').setInputFiles({
    name: realDocument.originalFileName,
    mimeType: "text/plain",
    buffer: Buffer.from("real route upload fixture"),
  });

  await expect(
    page
      .getByRole("table")
      .first()
      .getByText(realDocument.originalFileName, { exact: true }),
  ).toBeVisible();
  expect(uploadCalls).toBe(1);
  await expect(page.getByRole("button", { name: "삭제" })).toHaveCount(0);
});

test("keeps the real workspace usable without page overflow on mobile", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.setViewportSize({ width: 390, height: 844 });
  const longTitleRequirement = {
    ...realRequirement,
    title:
      "프로젝트 문서에서 도출된 매우 긴 요구사항 제목도 화면 너비 안에서 자연스럽게 줄바꿈되어야 합니다.",
  };
  await setupProjectData(page, [realDocument], [longTitleRequirement]);
  await login(page);
  await openProjectData(page);

  await expect(
    page.getByRole("navigation", { name: "실데이터 화면" }),
  ).toBeVisible();
  await expect(page.locator("aside")).toBeHidden();
  const widths = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
    main: document.querySelector("main")?.scrollWidth,
    mainViewport: document.querySelector("main")?.clientWidth,
  }));
  expect(widths.page).toBe(widths.viewport);
  expect(widths.main).toBe(widths.mainViewport);
  const requirementsTableContainer = page.getByRole("table").nth(1).locator("..");
  const requirementsTableWidths = await requirementsTableContainer.evaluate(
    (element) => ({
      content: element.scrollWidth,
      viewport: element.clientWidth,
    }),
  );
  expect(requirementsTableWidths.content).toBe(
    requirementsTableWidths.viewport,
  );
  expect(consoleErrors).toEqual([]);
});

async function setupProjectData(
  page: Page,
  documents: Array<typeof realDocument>,
  requirements: Array<typeof realRequirement>,
) {
  await mockLogin(page);
  await mockProjectList(page, [realProject]);
  await page.route(
    `**/api/projects/${realProject.projectId}/documents`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projectId: realProject.projectId,
          documents,
        }),
      });
    },
  );
  await page.route(
    `**/api/projects/${realProject.projectId}/requirements`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(requirementsResponse(requirements)),
      });
    },
  );
}

function requirementsResponse(items: Array<typeof realRequirement>) {
  return {
    projectId: realProject.projectId,
    aiSuggestions: items,
    finalRequirements: items,
  };
}

async function mockProjectList(
  page: Page,
  projects: Array<typeof realProject>,
) {
  await page.route("**/api/projects/*/requirements/readjustments", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        projectId: realProject.projectId,
        changeCandidates: [],
      }),
    });
  });
  await page.route("**/api/projects", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(projects),
    });
  });
}

async function mockLogin(page: Page) {
  await page.route("**/api/users/login", async (route: Route) => {
    const now = Date.now();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: "ok",
        employeeNumber: "PM-REAL",
        name: "Real Route PM",
        role: "PM",
        accessToken: "real-route-access-token",
        refreshToken: "real-route-refresh-token",
        accessTokenExpiresAt: now + 3_600_000,
        absoluteExpiresAt: now + 86_400_000,
        serverTime: now,
      }),
    });
  });
}

async function login(page: Page) {
  await page.goto("/real");
  await page.locator("#email").fill("real-route@example.test");
  await page.locator("#password").fill("local-test-password");
  await page.locator('button[type="submit"]').click();
}

async function openProjectData(page: Page) {
  await page
    .getByRole("button", { name: "문서 및 요구사항", exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/real/projects/${realProject.projectId}/data$`),
  );
}

async function expectNoDemoProjects(page: Page) {
  for (const projectName of demoProjectNames) {
    await expect(page.getByText(projectName, { exact: true })).toHaveCount(0);
  }
}
