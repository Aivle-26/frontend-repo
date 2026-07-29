import { expect, test, type Page, type Route } from "@playwright/test";

const project = {
  projectId: 77,
  name: "E2E Delete Project",
  description: "delete flow fixture",
  pmEmployeeNumber: "PM-E2E",
  status: "DRAFT",
  plannedStartDate: "2026-07-29",
  plannedEndDate: "2026-08-29",
  createdAt: "2026-07-29T00:00:00",
  updatedAt: "2026-07-29T00:00:00",
};

test("deletes once, waits for 204, and reloads the authoritative list", async ({
  page,
}) => {
  let deleteCount = 0;
  let listCount = 0;
  let authorization = "";
  let releaseDelete: (() => void) | undefined;
  const deleteGate = new Promise<void>((resolve) => {
    releaseDelete = resolve;
  });

  await mockLogin(page);
  await page.route("**/api/projects", async (route) => {
    listCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(listCount === 1 ? [project] : []),
    });
  });
  await page.route(`**/api/projects/${project.projectId}`, async (route) => {
    deleteCount += 1;
    authorization = route.request().headers().authorization ?? "";
    await deleteGate;
    await route.fulfill({ status: 204 });
  });

  await login(page);
  const projectCardName = page.locator("button").filter({
    hasText: project.name,
  });
  await expect(projectCardName).toBeVisible();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page.getByRole("heading", { name: "프로젝트 삭제" })).toBeVisible();

  const confirmButton = page.getByRole("button", { name: "삭제", exact: true });
  await confirmButton.click();
  const deletingButton = page.getByRole("button", { name: "삭제 중..." });
  await expect(deletingButton).toBeDisabled();
  await deletingButton.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(projectCardName).toHaveCount(1);
  expect(deleteCount).toBe(1);

  releaseDelete?.();
  await expect(projectCardName).toHaveCount(0);
  await expect(page.getByText("프로젝트를 삭제했어요.", { exact: true })).toBeVisible();
  expect(deleteCount).toBe(1);
  expect(listCount).toBe(2);
  expect(authorization).toBe("Bearer e2e-access-token");

  await page.reload();
  await expect(projectCardName).toHaveCount(0);
  expect(listCount).toBe(3);
});

test("keeps the project and never shows success when deletion fails", async ({
  page,
}) => {
  let deleteCount = 0;
  let listCount = 0;

  await mockLogin(page);
  await page.route("**/api/projects", async (route) => {
    listCount += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([project]),
    });
  });
  await page.route(`**/api/projects/${project.projectId}`, async (route) => {
    deleteCount += 1;
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ message: "프로젝트 삭제에 실패했습니다." }),
    });
  });

  await login(page);
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "삭제", exact: true })
    .click();

  await expect(
    page.getByText("프로젝트 삭제에 실패했습니다.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("프로젝트를 삭제했어요.", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "취소", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: new RegExp(`^${project.name}`) }),
  ).toBeVisible();
  expect(deleteCount).toBe(1);
  expect(listCount).toBe(1);
});

test("shows the permission message and keeps the project on 403", async ({
  page,
}) => {
  await mockLogin(page);
  await page.route("**/api/projects", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([project]),
    });
  });
  await page.route(`**/api/projects/${project.projectId}`, async (route) => {
    await route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ message: "forbidden" }),
    });
  });

  await login(page);
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "삭제", exact: true })
    .click();

  await expect(
    page.getByText("프로젝트를 삭제할 권한이 없습니다.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("button").filter({ hasText: project.name }),
  ).toHaveCount(1);
});

async function mockLogin(page: Page) {
  await page.route("**/api/users/login", async (route: Route) => {
    const now = Date.now();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: "ok",
        employeeNumber: "PM-E2E",
        name: "E2E PM",
        role: "PM",
        accessToken: "e2e-access-token",
        refreshToken: "e2e-refresh-token",
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
  await page.locator("#email").fill("pm-e2e@example.test");
  await page.locator("#password").fill("local-test-password");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
}
