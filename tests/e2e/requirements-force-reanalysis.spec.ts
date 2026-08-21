import { expect, test, type Route } from "@playwright/test";

const projectId = 88;
const documents = [
  {
    documentId: 501,
    originalFileName: "a.txt",
    status: "ANALYZED",
    fileSize: 100,
  },
  {
    documentId: 502,
    originalFileName: "b.txt",
    status: "ANALYZED",
    fileSize: 200,
  },
];

function requirement(documentId: number, id: number, title: string) {
  return {
    requirementId: id,
    analysisResultId: 700,
    sourceDocumentId: documentId,
    externalReferenceId: id,
    type: "FUNCTIONAL",
    title,
    description: `${title} 설명`,
    acceptanceCriteria: null,
    dueDate: null,
    deliverableName: null,
    securityCondition: null,
    sourceDocumentName: documentId === 501 ? "a.txt" : "b.txt",
    sourceExcerpt: null,
    priority: "HIGH",
    status: "UNCONFIRMED",
    confirmed: false,
    createdAt: "2026-08-01T00:00:00",
    updatedAt: "2026-08-01T00:00:00",
  };
}

test("선택 문서만 재분석 완료로 남기고 요구사항을 최신 결과로 교체한다", async ({
  page,
}) => {
  let analyzeRequestBody: unknown;
  let releaseAnalysis: (() => void) | undefined;
  const analysisGate = new Promise<void>((resolve) => {
    releaseAnalysis = resolve;
  });
  const initialRequirements = [
    requirement(501, 701, "A 이전 요구사항"),
    requirement(502, 702, "B 이전 요구사항"),
  ];
  const latestRequirements = [requirement(501, 703, "A 최신 요구사항")];
  let persistedRequirements = initialRequirements;

  await page.route("**/api/users/login", async (route: Route) => {
    const now = Date.now();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: "ok",
        employeeNumber: "PM-FORCE",
        name: "Force Reanalysis PM",
        role: "PM",
        accessToken: "force-access-token",
        refreshToken: "force-refresh-token",
        accessTokenExpiresAt: now + 3_600_000,
        absoluteExpiresAt: now + 86_400_000,
        serverTime: now,
      }),
    });
  });
  await page.route("**/api/projects", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          projectId,
          name: "Force Reanalysis Project",
          description: "force integration fixture",
          pmEmployeeNumber: "PM-FORCE",
          status: "DRAFT",
          plannedStartDate: "2026-08-01",
          plannedEndDate: "2026-09-01",
          createdAt: "2026-08-01T00:00:00",
          updatedAt: "2026-08-01T00:00:00",
        },
      ]),
    });
  });
  await page.route(`**/api/projects/${projectId}/documents`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ projectId, documents }),
    });
  });
  await page.route(`**/api/projects/${projectId}/requirements`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        projectId,
        aiSuggestions: persistedRequirements,
        finalRequirements: persistedRequirements,
      }),
    });
  });
  await page.route(
    `**/api/projects/${projectId}/requirements/readjustments`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ projectId, changeCandidates: [] }),
      });
    },
  );
  await page.route(
    `**/api/projects/${projectId}/requirements/analyze`,
    async (route) => {
      analyzeRequestBody = route.request().postDataJSON();
      await analysisGate;
      persistedRequirements = latestRequirements;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projectId,
          aiSuggestions: latestRequirements,
          finalRequirements: latestRequirements,
        }),
      });
    },
  );

  await page.goto("/");
  await page.locator("#email").fill("force@example.test");
  await page.locator("#password").fill("local-test-password");
  await page.locator('button[type="submit"]').click();
  await page.getByRole("button", { name: "요구사항", exact: true }).click();
  await page.getByLabel("a.txt 분석 대상 선택").click({ force: true });
  await page
    .getByRole("button", {
      name: "선택 문서로 요구사항 재조정",
      exact: true,
    })
    .click({ force: true });

  await expect.poll(() => analyzeRequestBody).toEqual({
    documentIds: [501],
    force: true,
  });
  await expect(page.getByText("분석 중", { exact: true })).toHaveCount(1);
  await expect(page.getByText("대기", { exact: true })).toHaveCount(1);

  releaseAnalysis?.();

  await expect(page.getByText("A 최신 요구사항", { exact: true })).toBeVisible();
  await expect(page.getByText("B 이전 요구사항", { exact: true })).toHaveCount(0);
  await expect(page.getByText("분석 완료", { exact: true })).toHaveCount(1);
  await expect(page.getByText("대기", { exact: true })).toHaveCount(1);
});
