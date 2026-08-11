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

const organizationChartArtifact = {
  artifactId: 901,
  projectId: realProject.projectId,
  artifactType: "ORGANIZATION_CHART",
  artifactName: "조직도",
  version: "1.0",
  approvalStatus: "PENDING",
  contentType: "image/jpeg",
  fileSize: 4,
  generatedAt: "2026-08-05T10:00:00",
  previewUrl: `/api/projects/${realProject.projectId}/artifacts/organization-chart/latest/download`,
  downloadUrl: `/api/projects/${realProject.projectId}/artifacts/organization-chart/latest/download`,
};

const organizationChartHierarchy = {
  projectId: realProject.projectId,
  artifactId: organizationChartArtifact.artifactId,
  version: "1.0",
  projectManagerMemberId: "PM-REAL",
  members: [
    {
      memberId: "PM-REAL",
      parentMemberId: null,
      memberName: "Real Route PM",
      projectJobFamily: "PROJECT_MANAGER",
      order: 0,
      capabilityRegistered: true,
    },
    {
      memberId: "DEV002",
      parentMemberId: "PM-REAL",
      memberName: "Lead Member",
      projectJobFamily: "TECH_LEAD",
      order: 0,
      capabilityRegistered: true,
    },
    {
      memberId: "DEV003",
      parentMemberId: "PM-REAL",
      memberName: "Backend Member",
      projectJobFamily: "BACKEND",
      order: 1,
      capabilityRegistered: true,
    },
    {
      memberId: "DEV008",
      parentMemberId: "DEV002",
      memberName: "Unregistered Member",
      projectJobFamily: null,
      order: 0,
      capabilityRegistered: false,
    },
  ],
};

const organizationChartTreeHierarchy = {
  ...organizationChartHierarchy,
  members: [
    organizationChartHierarchy.members[0],
    {
      memberId: "TREE-A",
      parentMemberId: "PM-REAL",
      memberName: "Tree Member A",
      projectJobFamily: "TECH_LEAD",
      order: 0,
      capabilityRegistered: true,
    },
    {
      memberId: "TREE-B",
      parentMemberId: "PM-REAL",
      memberName: "Tree Member B",
      projectJobFamily: "BACKEND_DEVELOPER",
      order: 1,
      capabilityRegistered: true,
    },
    {
      memberId: "TREE-C",
      parentMemberId: "PM-REAL",
      memberName: "Tree Member C",
      projectJobFamily: "FRONTEND_DEVELOPER",
      order: 2,
      capabilityRegistered: true,
    },
    {
      memberId: "TREE-D",
      parentMemberId: "TREE-A",
      memberName: "Tree Member D",
      projectJobFamily: "FULLSTACK_DEVELOPER",
      order: 0,
      capabilityRegistered: true,
    },
    {
      memberId: "TREE-E",
      parentMemberId: "TREE-A",
      memberName: "Tree Member E",
      projectJobFamily: "QA_ENGINEER",
      order: 1,
      capabilityRegistered: true,
    },
    {
      memberId: "TREE-F",
      parentMemberId: "TREE-D",
      memberName: "Tree Member F",
      projectJobFamily: null,
      order: 0,
      capabilityRegistered: false,
    },
  ],
};

const uiMockupArtifact = {
  artifactId: 902,
  projectId: realProject.projectId,
  artifactType: "UI_MOCKUP",
  artifactName: "UI 목업",
  version: "1.0",
  approvalStatus: "PENDING",
  contentType: "image/jpeg",
  fileSize: 4,
  generatedAt: "2026-08-10T10:00:00",
  previewUrl: `/api/projects/${realProject.projectId}/artifacts/ui-mockup/latest/download`,
  downloadUrl: `/api/projects/${realProject.projectId}/artifacts/ui-mockup/latest/download`,
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

test("generates and previews the required organization chart for PM", async ({
  page,
}) => {
  let generated = false;
  let generateCalls = 0;
  await setupProjectData(page, [realDocument], [realRequirement]);
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/organization-chart/latest`,
    async (route) => {
      await route.fulfill({
        status: generated ? 200 : 404,
        contentType: "application/json",
        body: JSON.stringify(
          generated
            ? organizationChartArtifact
            : {
                code: "ORGANIZATION_CHART_NOT_GENERATED",
                message: "not generated",
              },
        ),
      });
    },
  );
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/organization-chart/generate`,
    async (route) => {
      generateCalls += 1;
      generated = true;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(organizationChartArtifact),
      });
    },
  );
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/organization-chart/latest/download`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "image/jpeg",
        body: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
      });
    },
  );

  await login(page);
  await expect(page.locator("#email")).toHaveCount(0);
  await page.goto(`/real/projects/${realProject.projectId}/data`);
  await expect(page.getByText("필수 산출물", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "조직도 필수 산출물" }))
    .toBeDisabled();
  await page.getByRole("button", { name: "조직도 생성", exact: true }).click();

  await expect(page.getByAltText("프로젝트 조직도 미리보기")).toBeVisible();
  await expect(page.getByText("v1.0", { exact: true })).toBeVisible();
  expect(generateCalls).toBe(1);
});

test("renders organization hierarchy as spaced connector branches", async ({ page }) => {
  await setupProjectData(page, [realDocument], [realRequirement]);
  await mockOrganizationChart(page, organizationChartTreeHierarchy);

  await login(page);
  await expect(page.locator("#email")).toHaveCount(0);
  await page.goto(`/real/projects/${realProject.projectId}/data`);

  const tree = page.getByRole("tree", { name: "프로젝트 보고 라인 계층" });
  await expect(tree).toBeVisible();
  await expect(tree.locator("[data-tree-branch]")).toHaveCount(
    organizationChartTreeHierarchy.members.length - 1,
  );
  await expect(tree.locator('[data-tree-node="PM-REAL"]')).toHaveAttribute(
    "data-tree-depth",
    "0",
  );
  for (const memberId of ["TREE-A", "TREE-B", "TREE-C"]) {
    await expect(tree.locator(`[data-tree-node="${memberId}"]`)).toHaveAttribute(
      "data-tree-depth",
      "1",
    );
  }
  for (const memberId of ["TREE-D", "TREE-E"]) {
    await expect(tree.locator(`[data-tree-node="${memberId}"]`)).toHaveAttribute(
      "data-tree-depth",
      "2",
    );
  }
  await expect(tree.locator('[data-tree-node="TREE-F"]')).toHaveAttribute(
    "data-tree-depth",
    "3",
  );

  const connectorStyles = await tree.locator("[data-tree-branch]").evaluateAll((branches) =>
    branches.map((branch) => ({
      horizontal: getComputedStyle(branch, "::after").borderTopWidth,
      vertical: getComputedStyle(branch, "::before").borderLeftWidth,
    })),
  );
  expect(connectorStyles.every(({ horizontal, vertical }) =>
    horizontal !== "0px" && vertical !== "0px"
  )).toBe(true);

  const cards = await tree.locator("[data-member-id]").evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { id: node.getAttribute("data-member-id"), x: rect.x, y: rect.y, bottom: rect.bottom };
    }),
  );
  const cardById = new Map(cards.map((card) => [card.id, card]));
  expect((cardById.get("TREE-A")?.x ?? 0) - (cardById.get("PM-REAL")?.x ?? 0))
    .toBeGreaterThanOrEqual(40);
  expect((cardById.get("TREE-D")?.x ?? 0) - (cardById.get("TREE-A")?.x ?? 0))
    .toBeGreaterThanOrEqual(40);
  expect((cardById.get("TREE-F")?.x ?? 0) - (cardById.get("TREE-D")?.x ?? 0))
    .toBeGreaterThanOrEqual(40);
  const cardsByTop = [...cards].sort((left, right) => left.y - right.y);
  for (let index = 1; index < cardsByTop.length; index += 1) {
    expect(cardsByTop[index].y).toBeGreaterThanOrEqual(cardsByTop[index - 1].bottom);
  }
});

test("PM edits an organization hierarchy and saves a new artifact version", async ({
  page,
}) => {
  let artifact = organizationChartArtifact;
  let hierarchy = structuredClone(organizationChartHierarchy);
  let savedBody: {
    baseVersion: string;
    members: Array<{ memberId: string; parentMemberId: string | null; order: number }>;
  } | null = null;
  await setupProjectData(page, [realDocument], [realRequirement]);
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/organization-chart/latest`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(artifact),
      });
    },
  );
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/organization-chart/latest/structure`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(hierarchy),
      });
    },
  );
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/organization-chart/latest/download`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "image/jpeg",
        body: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
      });
    },
  );
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/organization-chart/hierarchy`,
    async (route) => {
      savedBody = route.request().postDataJSON();
      hierarchy = {
        ...hierarchy,
        version: "1.1",
        members: hierarchy.members.map((member) => {
          const saved = savedBody?.members.find((item) => item.memberId === member.memberId);
          return saved ? { ...member, ...saved } : member;
        }),
      };
      artifact = { ...organizationChartArtifact, artifactId: 903, version: "1.1" };
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(artifact),
      });
    },
  );

  await login(page);
  await expect(page.locator("#email")).toHaveCount(0);
  await page.goto(`/real/projects/${realProject.projectId}/data`);
  await page.getByRole("button", { name: "계층 편집" }).click();
  await expect(page.getByText(
    "사람 카드를 다른 사람 위에 놓으면 해당 사람의 산하로 이동합니다.",
  )).toBeVisible();
  await rejectCycleDrop(page, "DEV002", "DEV008");
  await expect(page.locator('[data-member-id="DEV002"]')).toContainText("PM 직속");
  await dragMember(page, "DEV008", "DEV003");
  await expect(page.locator('[data-member-id="DEV008"]')).toContainText(
    "Backend Member 산하",
  );
  await dragMemberToPm(page, "DEV008");
  await expect(page.locator('[data-member-id="DEV008"]')).toContainText("PM 직속");
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.locator('[data-member-id="DEV008"]')).toContainText(
    "Lead Member 산하",
  );
  await page.getByRole("button", { name: "계층 편집" }).click();
  await dragMember(page, "DEV008", "DEV003");
  await page.getByRole("button", { name: "저장", exact: true }).click();

  await expect.poll(() => savedBody).not.toBeNull();
  expect(savedBody?.baseVersion).toBe("1.0");
  expect(savedBody?.members.find((member) => member.memberId === "DEV008")?.parentMemberId)
    .toBe("DEV003");
  await expect(page.getByText("v1.1", { exact: true }).first()).toBeVisible();
});

test("PM hierarchy save failure keeps the previous artifact and hierarchy", async ({
  page,
}) => {
  await setupProjectData(page, [realDocument], [realRequirement]);
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/organization-chart/latest`,
    async (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(organizationChartArtifact),
    }),
  );
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/organization-chart/latest/structure`,
    async (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(organizationChartHierarchy),
    }),
  );
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/organization-chart/latest/download`,
    async (route) => route.fulfill({
      status: 200,
      contentType: "image/jpeg",
      body: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
    }),
  );
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/organization-chart/hierarchy`,
    async (route) => route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        code: "ORGANIZATION_CHART_RENDER_UNAVAILABLE",
        message: "renderer unavailable",
      }),
    }),
  );

  await login(page);
  await expect(page.locator("#email")).toHaveCount(0);
  await page.goto(`/real/projects/${realProject.projectId}/data`);
  await page.getByRole("button", { name: "계층 편집" }).click();
  await dragMember(page, "DEV008", "DEV003");
  await page.getByRole("button", { name: "저장", exact: true }).click();

  await expect(page.getByLabel("조직도 보고 라인").getByText(
    "조직도 생성 서버 또는 파일 저장소에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  )).toBeVisible();
  await expect(page.getByText("v1.0", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.locator('[data-member-id="DEV008"]')).toContainText(
    "Lead Member 산하",
  );
});

test("STAFF sees the structured hierarchy without edit controls", async ({ page }) => {
  await mockLogin(page, "STAFF");
  await mockProjectList(page, [realProject]);
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/organization-chart/latest`,
    async (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(organizationChartArtifact),
    }),
  );
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/organization-chart/latest/structure`,
    async (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(organizationChartHierarchy),
    }),
  );
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/organization-chart/latest/download`,
    async (route) => route.fulfill({
      status: 200,
      contentType: "image/jpeg",
      body: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
    }),
  );

  await login(page);

  await expect(page.getByText("보고 라인", { exact: true })).toBeVisible();
  await expect(page.locator('[data-member-id="DEV008"]')).toContainText("역량 미등록");
  await expect(page.getByRole("button", { name: "계층 편집" })).toHaveCount(0);
  await expect(page.locator('[data-member-id="DEV008"]')).toHaveAttribute("draggable", "false");
});

test("legacy organization chart without structure shows regeneration guidance", async ({
  page,
}) => {
  await setupProjectData(page, [realDocument], [realRequirement]);
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/organization-chart/latest`,
    async (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(organizationChartArtifact),
    }),
  );
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/organization-chart/latest/structure`,
    async (route) => route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        code: "ORGANIZATION_CHART_STRUCTURE_NOT_FOUND",
        message: "legacy artifact has no structure",
      }),
    }),
  );
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/organization-chart/latest/download`,
    async (route) => route.fulfill({
      status: 200,
      contentType: "image/jpeg",
      body: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
    }),
  );

  await login(page);
  await expect(page.locator("#email")).toHaveCount(0);
  await page.goto(`/real/projects/${realProject.projectId}/data`);

  await expect(page.getByText(
    "기존 조직도는 계층 편집 정보가 없습니다. 조직도를 다시 생성해 주세요.",
  )).toBeVisible();
  await expect(page.getByAltText("프로젝트 조직도 미리보기")).toBeVisible();
});

test("generates previews and downloads a UI mockup for PM", async ({ page }) => {
  let generated = false;
  let generateCalls = 0;
  let downloadCalls = 0;
  await setupProjectData(page, [realDocument], [realRequirement]);
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/ui-mockup/latest`,
    async (route) => {
      await route.fulfill({
        status: generated ? 200 : 404,
        contentType: "application/json",
        body: JSON.stringify(
          generated
            ? uiMockupArtifact
            : { code: "UI_MOCKUP_NOT_GENERATED", message: "not generated" },
        ),
      });
    },
  );
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/ui-mockup/generate`,
    async (route) => {
      generateCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 100));
      generated = true;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(uiMockupArtifact),
      });
    },
  );
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/ui-mockup/latest/download`,
    async (route) => {
      downloadCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "image/jpeg",
        body: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
      });
    },
  );

  await login(page);
  await expect(page.locator("#email")).toHaveCount(0);
  await page.goto(`/real/projects/${realProject.projectId}/data`);
  const generateButton = page.getByRole("button", { name: "UI 목업 생성", exact: true });
  await generateButton.click();
  await expect(page.getByRole("button", { name: "UI 목업을 생성하고 있습니다" })).toBeDisabled();
  await expect(page.getByAltText("프로젝트 UI 목업 미리보기")).toBeVisible();
  await expect(page.getByText("v1.0", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "다운로드", exact: true }).last().click();
  await expect.poll(() => downloadCalls).toBeGreaterThanOrEqual(2);
  expect(generateCalls).toBe(1);
});

test("PM UI prototype menu uses only the canonical artifact flow", async ({
  page,
}) => {
  let generated = false;
  let assessCalls = 0;
  let generateCalls = 0;
  let downloadCalls = 0;
  let assistantCalls = 0;
  await mockLogin(page);
  await mockProjectList(page, [realProject]);
  page.on("request", (request) => {
    if (request.url().includes("/assistant/query")) assistantCalls += 1;
  });
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/ui-mockup/latest`,
    async (route) => {
      await route.fulfill({
        status: generated ? 200 : 404,
        contentType: "application/json",
        body: JSON.stringify(
          generated
            ? uiMockupArtifact
            : { code: "UI_MOCKUP_NOT_GENERATED", message: "not generated" },
        ),
      });
    },
  );
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/ui-mockup/assess`,
    async (route) => {
      assessCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          decision: "NOT_NEEDED",
          reason: "화면 상호작용이 핵심 요구사항에 포함되지 않았습니다.",
          evidenceRequirementIds: [realRequirement.requirementId],
          candidateScreens: [],
        }),
      });
    },
  );
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/ui-mockup/generate`,
    async (route) => {
      generateCalls += 1;
      generated = true;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(uiMockupArtifact),
      });
    },
  );
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/ui-mockup/latest/download`,
    async (route) => {
      downloadCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "image/jpeg",
        body: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
      });
    },
  );

  await page.goto("/");
  await page.evaluate((projectId) => {
    localStorage.setItem(
      `aipm.uiPrototypeArtifact.${projectId}`,
      JSON.stringify({
        projectName: "Pmate AI",
        screens: [{ name: "대시보드", headline: "전체 진행률 68% D-42" }],
      }),
    );
  }, String(realProject.projectId));
  await page.locator("#email").fill("real-route@example.test");
  await page.locator("#password").fill("local-test-password");
  await page.locator('button[type="submit"]').click();
  await expect(page.locator("#email")).toHaveCount(0);

  await page.getByRole("button", { name: "UI 프로토타입", exact: true }).click();
  await expect(page.getByRole("button", { name: "AI 필요성 분석", exact: true })).toBeVisible();
  expect(assessCalls).toBe(0);
  expect(generateCalls).toBe(0);
  expect(assistantCalls).toBe(0);
  for (const staleText of ["전체 진행률", "68%", "D-42", "열린 리스크", "주간 보고서 생성"]) {
    await expect(page.getByText(staleText, { exact: false })).toHaveCount(0);
  }

  await page.getByRole("button", { name: "AI 필요성 분석", exact: true }).click();
  await expect(page.getByText("필요성 낮음", { exact: true })).toBeVisible();
  await expect(page.getByText("화면 상호작용이 핵심 요구사항에 포함되지 않았습니다.")).toBeVisible();
  await page.getByRole("button", { name: "그래도 생성하기", exact: true }).click();

  await expect(page.getByAltText("프로젝트 UI 목업 미리보기")).toBeVisible();
  await expect(page.getByText("v1.0", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "다운로드", exact: true }).click();
  await expect.poll(() => downloadCalls).toBeGreaterThanOrEqual(2);
  expect(assessCalls).toBe(1);
  expect(generateCalls).toBe(1);
  expect(assistantCalls).toBe(0);
});

test("UI mockup necessity assessment runs only after an explicit action", async ({
  page,
}) => {
  let assessCalls = 0;
  await setupProjectData(page, [realDocument], [realRequirement]);
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/ui-mockup/assess`,
    async (route) => {
      assessCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 100));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          decision: "REQUIRED",
          reason: "로그인과 대시보드 흐름을 화면으로 검증해야 합니다.",
          evidenceRequirementIds: [realRequirement.requirementId],
          candidateScreens: ["로그인", "대시보드"],
        }),
      });
    },
  );

  await login(page);
  await expect(page.locator("#email")).toHaveCount(0);
  await page.goto(`/real/projects/${realProject.projectId}/data`);
  expect(assessCalls).toBe(0);

  await page.getByRole("button", { name: "AI 필요성 분석", exact: true }).click();
  await expect(page.getByRole("button", { name: "분석 중", exact: true })).toBeDisabled();
  await expect(page.getByText("적극 권장", { exact: true })).toBeVisible();
  await expect(page.getByText("로그인과 대시보드 흐름을 화면으로 검증해야 합니다.")).toBeVisible();
  await expect(page.getByText("로그인", { exact: true })).toBeVisible();
  await expect(page.getByText("대시보드", { exact: true }).last()).toBeVisible();
  await expect(page.getByRole("button", { name: "UI 목업 생성", exact: true })).toHaveClass(/ring-2/);
  expect(assessCalls).toBe(1);
});

for (const scenario of [
  {
    decision: "RECOMMENDED",
    label: "생성 권장",
    reason: "운영 화면의 정보 구조를 미리 확인하는 편이 좋습니다.",
    button: "UI 목업 생성",
  },
  {
    decision: "NOT_NEEDED",
    label: "필요성 낮음",
    reason: "사용자 화면이 없는 배치 처리 프로젝트입니다.",
    button: "그래도 생성하기",
  },
] as const) {
  test(`UI mockup necessity ${scenario.decision} keeps generation available`, async ({
    page,
  }) => {
    await setupProjectData(page, [realDocument], [realRequirement]);
    await page.route(
      `**/api/projects/${realProject.projectId}/artifacts/ui-mockup/assess`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            decision: scenario.decision,
            reason: scenario.reason,
            evidenceRequirementIds: [realRequirement.requirementId],
            candidateScreens:
              scenario.decision === "RECOMMENDED" ? ["운영 대시보드"] : [],
          }),
        });
      },
    );

    await login(page);
    await expect(page.locator("#email")).toHaveCount(0);
    await page.goto(`/real/projects/${realProject.projectId}/data`);
    await page.getByRole("button", { name: "AI 필요성 분석", exact: true }).click();

    await expect(page.getByText(scenario.label, { exact: true })).toBeVisible();
    await expect(page.getByText(scenario.reason, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: scenario.button, exact: true })).toBeVisible();
  });
}

test("UI mockup necessity assessment exposes a retryable failure state", async ({
  page,
}) => {
  await setupProjectData(page, [realDocument], [realRequirement]);
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/ui-mockup/assess`,
    async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "AI unavailable" }),
      });
    },
  );

  await login(page);
  await expect(page.locator("#email")).toHaveCount(0);
  await page.goto(`/real/projects/${realProject.projectId}/data`);
  await page.getByRole("button", { name: "AI 필요성 분석", exact: true }).click();

  await expect(
    page.getByText("AI 필요성 분석 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "AI 필요성 분석", exact: true })).toBeEnabled();
});

test("shows the confirmed requirement error for UI mockup generation", async ({ page }) => {
  await setupProjectData(page, [realDocument], [realRequirement]);
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/ui-mockup/generate`,
    async (route) => {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          code: "CONFIRMED_REQUIREMENT_NOT_FOUND",
          message: "confirmed requirement required",
        }),
      });
    },
  );

  await login(page);
  await page.goto(`/real/projects/${realProject.projectId}/data`);
  await page.getByRole("button", { name: "UI 목업 생성", exact: true }).click();
  await expect(
    page.getByRole("alert").getByText(
      "확정된 요구사항이 필요합니다. 요구사항을 확정한 뒤 다시 생성해 주세요.",
    ),
  ).toBeVisible();
});

test("allows STAFF to preview and download without a generate action", async ({
  page,
}) => {
  await mockLogin(page, "STAFF");
  await mockProjectList(page, [realProject]);
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/organization-chart/latest`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(organizationChartArtifact),
      });
    },
  );
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/organization-chart/latest/download`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "image/jpeg",
        body: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
      });
    },
  );

  await login(page);

  await expect(page.getByAltText("프로젝트 조직도 미리보기")).toBeVisible();
  await expect(page.getByRole("button", { name: "조직도 생성" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "재생성" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "AI 필요성 분석" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "UI 목업 생성" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "다운로드" })).toBeVisible();
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

  await expect(page.getByText("대시보드", { exact: true })).toBeVisible();
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

test("hides the file type selector in the new project upload list", async ({
  page,
}) => {
  await mockLogin(page);
  await mockProjectList(page, []);
  await login(page);

  await page.getByRole("button", { name: "새 프로젝트" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "initial-project-document.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("initial project document"),
  });

  await expect(
    dialog.getByText("initial-project-document.txt", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByRole("combobox")).toHaveCount(0);
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
  await page.route(
    "**/api/projects/*/artifacts/organization-chart/latest",
    async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          code: "ORGANIZATION_CHART_NOT_GENERATED",
          message: "not generated",
        }),
      });
    },
  );
  await page.route(
    "**/api/projects/*/artifacts/ui-mockup/latest",
    async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          code: "UI_MOCKUP_NOT_GENERATED",
          message: "not generated",
        }),
      });
    },
  );
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

async function mockLogin(page: Page, role: "PM" | "STAFF" = "PM") {
  await page.route("**/api/users/login", async (route: Route) => {
    const now = Date.now();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: "ok",
        employeeNumber: role === "PM" ? "PM-REAL" : "STAFF-REAL",
        name: role === "PM" ? "Real Route PM" : "Real Route Staff",
        role,
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

async function mockOrganizationChart(page: Page, hierarchy: unknown) {
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/organization-chart/latest`,
    async (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(organizationChartArtifact),
    }),
  );
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/organization-chart/latest/structure`,
    async (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(hierarchy),
    }),
  );
  await page.route(
    `**/api/projects/${realProject.projectId}/artifacts/organization-chart/latest/download`,
    async (route) => route.fulfill({
      status: 200,
      contentType: "image/jpeg",
      body: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
    }),
  );
}

async function dragMember(page: Page, sourceId: string, targetId: string) {
  const source = page.locator(`[data-member-id="${sourceId}"]`);
  const target = page.locator(`[data-member-id="${targetId}"]`);
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await source.dispatchEvent("dragstart", { dataTransfer });
  await target.dispatchEvent("dragover", { dataTransfer });
  await expect(target).toHaveAttribute("data-drop-state", "valid");
  await target.dispatchEvent("drop", { dataTransfer });
  await source.dispatchEvent("dragend", { dataTransfer });
}

async function dragMemberToPm(page: Page, sourceId: string) {
  const source = page.locator(`[data-member-id="${sourceId}"]`);
  const target = page.locator("[data-pm-direct-drop-zone]");
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await source.dispatchEvent("dragstart", { dataTransfer });
  await target.dispatchEvent("dragover", { dataTransfer });
  await expect(target).toHaveAttribute("data-drop-state", "valid");
  await target.dispatchEvent("drop", { dataTransfer });
  await source.dispatchEvent("dragend", { dataTransfer });
}

async function rejectCycleDrop(page: Page, sourceId: string, targetId: string) {
  const source = page.locator(`[data-member-id="${sourceId}"]`);
  const target = page.locator(`[data-member-id="${targetId}"]`);
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await source.dispatchEvent("dragstart", { dataTransfer });
  await target.dispatchEvent("dragover", { dataTransfer });
  await expect(target).toHaveAttribute("data-drop-state", "invalid");
  await target.dispatchEvent("drop", { dataTransfer });
  await source.dispatchEvent("dragend", { dataTransfer });
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
