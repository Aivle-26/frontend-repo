import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

interface E2eMetadata {
  prefix: string;
  projectId?: number;
  projectName?: string;
  documentId?: number;
  fileName?: string;
  requirementIds?: number[];
  cleanupDeferred: boolean;
  cleanedUp?: boolean;
}

const email = process.env.E2E_PM_EMAIL;
const password = process.env.E2E_PM_PASSWORD;
const resultPath = process.env.E2E_RESULT_PATH;
const deferCleanup = process.env.E2E_DEFER_CLEANUP === "1";

test("PM document analysis persists three requirements across refresh", async ({
  page,
}) => {
  test.skip(!email || !password, "E2E_PM_EMAIL and E2E_PM_PASSWORD are required.");

  const prefix =
    process.env.E2E_DATA_PREFIX ??
    `E2E-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const metadata: E2eMetadata = {
    prefix,
    cleanupDeferred: deferCleanup,
  };
  let projectId: number | undefined;

  try {
    await page.goto("/");
    await page.locator("#email").fill(email!);
    await page.locator("#password").fill(password!);

    const loginResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/users/login"),
    );
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    const loginResponse = await loginResponsePromise;
    expect(loginResponse.status()).toBe(200);
    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean(window.localStorage.getItem("aipm.authSession")),
        ),
      )
      .toBe(true);

    const projectName = `${prefix}-Project`;
    const project = await createDraftProject(page, projectName);
    projectId = project.projectId;
    metadata.projectId = projectId;
    metadata.projectName = projectName;
    writeMetadata(metadata);

    const projectsResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.url().endsWith("/api/projects"),
    );
    await page.reload();
    expect((await projectsResponsePromise).status()).toBe(200);
    await expect(page.getByText(projectName, { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "공고문 업로드", exact: true }).click();

    const fileName = `${prefix}-requirements.txt`;
    const uploadResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes(`/api/projects/${projectId}/documents/upload`),
    );
    await page.locator('input[type="file"]').setInputFiles({
      name: fileName,
      mimeType: "text/plain",
      buffer: Buffer.from(`${prefix}: requirements E2E source document.`),
    });
    const uploadResponse = await uploadResponsePromise;
    expect(uploadResponse.status()).toBe(201);
    const uploadBody = (await uploadResponse.json()) as {
      documents: Array<{ documentId: number }>;
    };
    const documentId = uploadBody.documents[0]?.documentId;
    expect(documentId).toBeTruthy();
    metadata.documentId = documentId;
    metadata.fileName = fileName;
    writeMetadata(metadata);

    const row = page.getByRole("row").filter({ hasText: fileName });
    await expect(row).toBeVisible();
    const analyzeResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes(
          `/api/projects/${projectId}/requirements/analyze`,
        ),
    );
    await expect(
      row.getByRole("button", { name: "다시 분석" }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "전체 문서 분석", exact: true })
      .click();
    await expect(row.getByText("분석 중", { exact: true })).toBeVisible();
    const analyzeResponse = await analyzeResponsePromise;
    expect(analyzeResponse.status()).toBe(200);
    const analysisBody = (await analyzeResponse.json()) as {
      finalRequirements: Array<{ requirementId: number }>;
    };
    expect(analysisBody.finalRequirements).toHaveLength(3);
    metadata.requirementIds = analysisBody.finalRequirements.map(
      (requirement) => requirement.requirementId,
    );
    writeMetadata(metadata);

    await expect(
      page.getByText("E2E-PLANNING-STUB-V1 User Login", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page
        .getByText("E2E-PLANNING-STUB-V1 Project Document Upload", {
          exact: true,
        })
        .first(),
    ).toBeVisible();
    await expect(
      page
        .getByText("E2E-PLANNING-STUB-V1 Requirement Review", { exact: true })
        .first(),
    ).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: "요구사항", exact: true }).click();
    await expect(
      page.getByText("E2E-PLANNING-STUB-V1 User Login", { exact: true }).first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "공고문 업로드", exact: true }).click();
    const restoredRow = page.getByRole("row").filter({ hasText: fileName });
    await expect(restoredRow).toBeVisible();
    await expect(restoredRow.getByText("분석 완료", { exact: true })).toBeVisible();
    await expect(
      restoredRow.getByRole("button", { name: "다시 분석" }),
    ).toHaveCount(0);
  } finally {
    if (projectId && !deferCleanup) {
      metadata.cleanedUp = await deleteProject(page, projectId);
      writeMetadata(metadata);
    }
  }
});

async function createDraftProject(page: Page, projectName: string) {
  return page.evaluate(async ({ name }) => {
    const rawSession = window.localStorage.getItem("aipm.authSession");
    if (!rawSession) throw new Error("authenticated session is missing");
    const session = JSON.parse(rawSession) as {
      accessToken: string;
      employeeNumber: string;
    };
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 30);
    const response = await fetch("/api/projects/drafts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        description: "AIPM vertical slice E2E project",
        pmEmployeeNumber: session.employeeNumber,
        plannedStartDate: start.toISOString().slice(0, 10),
        plannedEndDate: end.toISOString().slice(0, 10),
      }),
    });
    if (response.status !== 201) {
      throw new Error(`project creation failed with ${response.status}`);
    }
    return (await response.json()) as { projectId: number };
  }, { name: projectName });
}

async function deleteProject(page: Page, projectId: number) {
  return page.evaluate(async ({ id }) => {
    const rawSession = window.localStorage.getItem("aipm.authSession");
    if (!rawSession) return false;
    const session = JSON.parse(rawSession) as { accessToken: string };
    const response = await fetch(`/api/projects/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    });
    return response.status === 204;
  }, { id: projectId });
}

function writeMetadata(metadata: E2eMetadata) {
  if (!resultPath) return;
  mkdirSync(dirname(resultPath), { recursive: true });
  writeFileSync(resultPath, JSON.stringify(metadata, null, 2), "utf8");
}
