import { expect, test, type Page, type Route } from "@playwright/test";

const project = {
  projectId: 88,
  name: "Requirements UI Project",
  description: "requirements UI fixture",
  pmEmployeeNumber: "PM-UI",
  status: "DRAFT",
  plannedStartDate: "2026-07-29",
  plannedEndDate: "2026-08-29",
  createdAt: "2026-07-29T00:00:00",
  updatedAt: "2026-07-29T00:00:00",
};

const document = {
  documentId: 501,
  originalFileName: "requirements-ui.txt",
  status: "UPLOADED",
  fileSize: 1024,
};

const requirement = {
  requirementId: 701,
  analysisResultId: 601,
  sourceDocumentId: document.documentId,
  externalReferenceId: 1,
  type: "FUNCTIONAL",
  title: "실제 서버 요구사항",
  description: "RDS에서 조회한 요구사항 설명",
  acceptanceCriteria: null,
  dueDate: null,
  deliverableName: null,
  securityCondition: null,
  sourceDocumentName: document.originalFileName,
  sourceExcerpt: null,
  priority: "HIGH",
  status: "UNCONFIRMED",
  confirmed: false,
  createdAt: "2026-07-29T00:00:00",
  updatedAt: "2026-07-29T00:00:00",
};

const staleNotice = "AI 요구사항 추출은 아직 연결되지 않았습니다.";

test("shows the upload prompt when requirements and documents are empty", async ({
  page,
}) => {
  await openUpload(page, { documents: [], requirements: [] });

  await expect(
    page.getByText(
      "요구사항을 분석하려면 먼저 프로젝트 문서를 업로드해 주세요.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText(staleNotice, { exact: true })).toHaveCount(0);
});

test("shows the analysis action when documents exist without requirements", async ({
  page,
}) => {
  await openUpload(page, { documents: [document], requirements: [] });

  await expect(
    page.getByText("아직 도출된 요구사항이 없습니다.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "전체 문서 분석", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(staleNotice, { exact: true })).toHaveCount(0);
});

test("renders persisted requirements with a user-friendly review status", async ({
  page,
}) => {
  await openUpload(page, {
    documents: [document],
    requirements: [requirement],
  });

  await expect(page.getByText(requirement.title, { exact: true })).toBeVisible();
  await expect(
    page.getByText(requirement.description, { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("검토 전", { exact: true })).toBeVisible();
  await expect(page.getByText(staleNotice, { exact: true })).toHaveCount(0);
});

test("shows analysis progress and blocks duplicate submissions", async ({
  page,
}) => {
  let analyzeCalls = 0;
  let releaseAnalysis: (() => void) | undefined;
  const analysisGate = new Promise<void>((resolve) => {
    releaseAnalysis = resolve;
  });
  let currentRequirements: Array<typeof requirement> = [];

  await page.route(
    `**/api/projects/${project.projectId}/requirements/analyze`,
    async (route) => {
      analyzeCalls += 1;
      await analysisGate;
      currentRequirements = [requirement];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(requirementsResponse(currentRequirements)),
      });
    },
  );
  await openUpload(page, {
    documents: [document],
    requirements: () => currentRequirements,
  });

  const analyzeButton = page.getByRole("button", {
    name: "전체 문서 분석",
    exact: true,
  });
  await analyzeButton.click();

  await expect(
    page.getByText(
      "요구사항을 분석 중입니다. 완료될 때까지 다시 실행할 수 없습니다.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page
      .getByRole("button", { name: "요구사항 분석 중", exact: true })
      .first(),
  ).toBeDisabled();
  expect(analyzeCalls).toBe(1);

  releaseAnalysis?.();
  await expect(
    page.getByText("요구사항 분석을 완료했습니다.", { exact: true }),
  ).toBeVisible();
  expect(analyzeCalls).toBe(1);
});

test("keeps existing requirements visible when analysis fails", async ({
  page,
}) => {
  await page.route(
    `**/api/projects/${project.projectId}/requirements/analyze`,
    async (route) => {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ message: "upstream failed" }),
      });
    },
  );
  await openUpload(page, {
    documents: [document],
    requirements: [requirement],
  });

  const row = page.getByRole("row").filter({ hasText: document.originalFileName });
  await row.getByRole("button", { name: "다시 분석" }).click();

  await expect(
    page
      .getByRole("alert")
      .getByText(
        "분석 결과 형식이 올바르지 않습니다. 잠시 후 다시 시도해 주세요.",
        { exact: true },
      ),
  ).toBeVisible();
  await expect(page.getByText(requirement.title, { exact: true })).toBeVisible();
  await expect(page.getByText(staleNotice, { exact: true })).toHaveCount(0);
});

test("reloads persisted requirements from the server after a page refresh", async ({
  page,
}) => {
  let requirementRequests = 0;
  await openUpload(page, {
    documents: [document],
    requirements: () => {
      requirementRequests += 1;
      return [requirement];
    },
  });
  await expect(page.getByText(requirement.title, { exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "문서 업로드", exact: true }).click();

  await expect(page.getByText(requirement.title, { exact: true })).toBeVisible();
  expect(requirementRequests).toBeGreaterThanOrEqual(2);
  await expect(page.getByText(staleNotice, { exact: true })).toHaveCount(0);
});

async function openUpload(
  page: Page,
  options: {
    documents: Array<typeof document>;
    requirements:
      | Array<typeof requirement>
      | (() => Array<typeof requirement>);
  },
) {
  await mockLogin(page);
  await page.route("**/api/projects", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([project]),
    });
  });
  await page.route(
    `**/api/projects/${project.projectId}/documents`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projectId: project.projectId,
          documents: options.documents,
        }),
      });
    },
  );
  await page.route(
    `**/api/projects/${project.projectId}/requirements`,
    async (route) => {
      const items =
        typeof options.requirements === "function"
          ? options.requirements()
          : options.requirements;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(requirementsResponse(items)),
      });
    },
  );
  await page.route(`**/api/projects/${project.projectId}/wbs`, async (route) => {
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ message: "not found" }),
    });
  });

  await login(page);
  await page.getByRole("button", { name: "문서 업로드", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "도출된 요구사항", exact: true }),
  ).toBeVisible();
}

function requirementsResponse(items: Array<typeof requirement>) {
  return {
    projectId: project.projectId,
    aiSuggestions: items,
    finalRequirements: items,
  };
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
        employeeNumber: "PM-UI",
        name: "Requirements UI PM",
        role: "PM",
        accessToken: "requirements-ui-access-token",
        refreshToken: "requirements-ui-refresh-token",
        accessTokenExpiresAt: now + 3_600_000,
        absoluteExpiresAt: now + 86_400_000,
        lastActivityAt: now,
        serverTime: now,
        inactivityTimeoutMinutes: 30,
      }),
    });
  });
}

async function login(page: Page) {
  await page.goto("/");
  await page.locator("#email").fill("requirements-ui@example.test");
  await page.locator("#password").fill("local-test-password");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
}
