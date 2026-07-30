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

const evidenceQuote = "Login must support multi factor authentication.";
const secondEvidenceQuote = "Cover page";
const requirementWithEvidence = {
  ...requirement,
  sourceDocumentName: "requirements-evidence.pdf",
  sourceExcerpt: evidenceQuote,
  evidences: [
    {
      evidenceId: 9001,
      documentId: document.documentId,
      sourceDocument: "requirements-evidence.pdf",
      pageNumber: 2,
      chunkId: `${document.documentId}:2:1`,
      quoteText: evidenceQuote,
      startOffset: 0,
      endOffset: evidenceQuote.length,
      boundingBoxes: [],
    },
    {
      evidenceId: 9002,
      documentId: document.documentId,
      sourceDocument: "requirements-evidence.pdf",
      pageNumber: 1,
      chunkId: `${document.documentId}:1:1`,
      quoteText: secondEvidenceQuote,
      startOffset: 0,
      endOffset: secondEvidenceQuote.length,
      boundingBoxes: [],
    },
  ],
};

const evidencePdfBase64 =
  "JVBERi0xLjMKJeLjz9MKMSAwIG9iago8PAovUHJvZHVjZXIgKHB5cGRmKQo+PgplbmRvYmoKMiAwIG9iago8PAovVHlwZSAvUGFnZXMKL0NvdW50IDIKL0tpZHMgWyA0IDAgUiA3IDAgUiBdCj4+CmVuZG9iagozIDAgb2JqCjw8Ci9UeXBlIC9DYXRhbG9nCi9QYWdlcyAyIDAgUgo+PgplbmRvYmoKNCAwIG9iago8PAovVHlwZSAvUGFnZQovUmVzb3VyY2VzIDw8Ci9Gb250IDw8Ci9GMSA1IDAgUgo+Pgo+PgovTWVkaWFCb3ggWyAwLjAgMC4wIDYxMiA3OTIgXQovUGFyZW50IDIgMCBSCi9Db250ZW50cyA2IDAgUgo+PgplbmRvYmoKNSAwIG9iago8PAovVHlwZSAvRm9udAovU3VidHlwZSAvVHlwZTEKL0Jhc2VGb250IC9IZWx2ZXRpY2EKPj4KZW5kb2JqCjYgMCBvYmoKPDwKL0xlbmd0aCA0MQo+PgpzdHJlYW0KQlQgL0YxIDE0IFRmIDcyIDcyMCBUZCAoQ292ZXIgcGFnZSkgVGogRVQKZW5kc3RyZWFtCmVuZG9iago3IDAgb2JqCjw8Ci9UeXBlIC9QYWdlCi9SZXNvdXJjZXMgPDwKL0ZvbnQgPDwKL0YxIDggMCBSCj4+Cj4+Ci9NZWRpYUJveCBbIDAuMCAwLjAgNjEyIDc5MiBdCi9QYXJlbnQgMiAwIFIKL0NvbnRlbnRzIDkgMCBSCj4+CmVuZG9iago4IDAgb2JqCjw8Ci9UeXBlIC9Gb250Ci9TdWJ0eXBlIC9UeXBlMQovQmFzZUZvbnQgL0hlbHZldGljYQo+PgplbmRvYmoKOSAwIG9iago8PAovTGVuZ3RoIDc4Cj4+CnN0cmVhbQpCVCAvRjEgMTQgVGYgNzIgNzIwIFRkIChMb2dpbiBtdXN0IHN1cHBvcnQgbXVsdGkgZmFjdG9yIGF1dGhlbnRpY2F0aW9uLikgVGogRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgMTAKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE1IDAwMDAwIG4gCjAwMDAwMDAwNTQgMDAwMDAgbiAKMDAwMDAwMDExOSAwMDAwMCBuIAowMDAwMDAwMTY4IDAwMDAwIG4gCjAwMDAwMDAzMDAgMDAwMDAgbiAKMDAwMDAwMDM3MCAwMDAwMCBuIAowMDAwMDAwNDYxIDAwMDAwIG4gCjAwMDAwMDA1OTMgMDAwMDAgbiAKMDAwMDAwMDY2MyAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDEwCi9Sb290IDMgMCBSCi9JbmZvIDEgMCBSCj4+CnN0YXJ0eHJlZgo3OTEKJSVFT0YK";

const latestEvidencePdfBase64 = createSinglePagePdfBase64(
  "Latest evidence document.",
);
const slowRenderingPdfBase64 = createSinglePagePdfBase64(
  "Render in progress.",
  80_000,
);
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

test("opens the source PDF at the evidence page and highlights the quote", async ({
  page,
}) => {
  await page.route(
    `**/api/projects/${project.projectId}/documents/${document.documentId}/content`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        body: Buffer.from(evidencePdfBase64, "base64"),
      });
    },
  );
  await openUpload(page, {
    documents: [document],
    requirements: [requirementWithEvidence],
    real: true,
  });

  await page.getByText(requirementWithEvidence.title, { exact: true }).click();

  await expect(
    page.getByRole("dialog").getByText("requirements-evidence.pdf · 2쪽"),
  ).toBeVisible();
  await expect(page.getByLabel("PDF 텍스트 레이어")).toBeVisible();
  await expect(page.getByText(evidenceQuote, { exact: true })).toBeVisible();
  const highlighted = page
    .getByLabel("PDF 텍스트 레이어")
    .locator("span")
    .filter({ hasText: evidenceQuote });
  await expect(highlighted).toHaveCSS(
    "background-color",
    "rgba(250, 204, 21, 0.52)",
  );

  await page.getByRole("button", { name: "근거 2 · 1쪽" }).click();
  await expect(
    page.getByRole("dialog").getByText("requirements-evidence.pdf · 1쪽"),
  ).toBeVisible();
  await expect(
    page
      .getByLabel("PDF 텍스트 레이어")
      .locator("span")
      .filter({ hasText: secondEvidenceQuote }),
  ).toHaveCSS("background-color", "rgba(250, 204, 21, 0.52)");
});

test("shows the quote fallback when the PDF text layer has no match", async ({
  page,
}) => {
  await page.route(
    `**/api/projects/${project.projectId}/documents/${document.documentId}/content`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        body: Buffer.from(evidencePdfBase64, "base64"),
      });
    },
  );
  const unmatchedQuote = "This quote is not present in the fixture.";
  await openUpload(page, {
    documents: [document],
    requirements: [
      {
        ...requirementWithEvidence,
        evidences: [
          {
            ...requirementWithEvidence.evidences[0],
            quoteText: unmatchedQuote,
          },
        ],
      },
    ],
    real: true,
  });

  await page.getByText(requirementWithEvidence.title, { exact: true }).click();
  await expect(page.getByText(unmatchedQuote, { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "PDF 텍스트 레이어에서 정확한 인용문을 찾지 못해 별도 영역에 표시했습니다.",
      { exact: true },
    ),
  ).toBeVisible();
});

test("clears the render spinner when switching to page-less evidence", async ({
  page,
}) => {
  await page.route(
    `**/api/projects/${project.projectId}/documents/${document.documentId}/content`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        body: Buffer.from(slowRenderingPdfBase64, "base64"),
      });
    },
  );
  const pageLessQuote = "Verified excerpt without PDF page metadata.";
  const requirementWithPageLessEvidence = {
    ...requirementWithEvidence,
    evidences: [
      {
        ...requirementWithEvidence.evidences[0],
        pageNumber: 1,
        quoteText: "Render in progress.",
      },
      {
        ...requirementWithEvidence.evidences[1],
        evidenceId: 9005,
        pageNumber: null,
        chunkId: `${document.documentId}:text:page-less`,
        quoteText: pageLessQuote,
      },
    ],
  };
  await openUpload(page, {
    documents: [document],
    requirements: [requirementWithPageLessEvidence],
    real: true,
  });

  await page
    .getByText(requirementWithPageLessEvidence.title, { exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("1 / 1", { exact: true })).toBeVisible();
  await expect(dialog.locator("svg.animate-spin")).toBeVisible();

  await dialog.getByRole("button", { name: "근거 2", exact: true }).click();

  await expect(dialog.locator("svg.animate-spin")).toHaveCount(0);
  await expect(
    dialog.getByText("페이지 정보가 없습니다.", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText(pageLessQuote, { exact: true })).toBeVisible();
});

test("aborts superseded and unmounted PDF requests without showing an error", async ({
  page,
}) => {
  const secondDocument = {
    ...document,
    documentId: 502,
    originalFileName: "replacement-evidence.pdf",
  };
  const switchingRequirement = {
    ...requirementWithEvidence,
    evidences: [
      requirementWithEvidence.evidences[0],
      {
        ...requirementWithEvidence.evidences[1],
        evidenceId: 9003,
        documentId: secondDocument.documentId,
        sourceDocument: secondDocument.originalFileName,
      },
    ],
  };
  await installPdfFetchHarness(page, true);
  await openUpload(page, {
    documents: [document, secondDocument],
    requirements: [switchingRequirement],
    real: true,
  });

  await page.getByText(switchingRequirement.title, { exact: true }).click();
  await expect.poll(() => pdfRequestCount(page)).toBe(1);

  await page.getByRole("button", { name: "근거 2 · 1쪽" }).click();
  await expect.poll(() => pdfRequestCount(page)).toBe(2);
  await expect.poll(() => pdfRequestWasAborted(page, 0)).toBe(true);

  await resolvePdfRequest(page, 1, evidencePdfBase64);
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText(`${secondDocument.originalFileName} · 1쪽`),
  ).toBeVisible();
  await expect(dialog.getByLabel("PDF 텍스트 레이어")).toBeVisible();
  await expect(dialog.getByRole("alert")).toHaveCount(0);

  await page.getByRole("button", { name: "근거 1 · 2쪽" }).click();
  await expect.poll(() => pdfRequestCount(page)).toBe(3);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect.poll(() => pdfRequestWasAborted(page, 2)).toBe(true);
});

test("ignores a stale PDF response after the evidence selection changes", async ({
  page,
}) => {
  const secondDocument = {
    ...document,
    documentId: 503,
    originalFileName: "latest-evidence.pdf",
  };
  const switchingRequirement = {
    ...requirementWithEvidence,
    evidences: [
      requirementWithEvidence.evidences[0],
      {
        ...requirementWithEvidence.evidences[1],
        evidenceId: 9004,
        documentId: secondDocument.documentId,
        sourceDocument: secondDocument.originalFileName,
      },
    ],
  };
  await installPdfFetchHarness(page, false);
  await openUpload(page, {
    documents: [document, secondDocument],
    requirements: [switchingRequirement],
    real: true,
  });

  await page.getByText(switchingRequirement.title, { exact: true }).click();
  await expect.poll(() => pdfRequestCount(page)).toBe(1);
  await page.getByRole("button", { name: "근거 2 · 1쪽" }).click();
  await expect.poll(() => pdfRequestCount(page)).toBe(2);
  await expect.poll(() => pdfRequestWasAborted(page, 0)).toBe(true);

  await resolvePdfRequest(page, 1, latestEvidencePdfBase64);
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText(`${secondDocument.originalFileName} · 1쪽`),
  ).toBeVisible();
  await expect(dialog.getByLabel("PDF 텍스트 레이어")).toBeVisible();
  await expect(dialog.getByText("1 / 1", { exact: true })).toBeVisible();

  await resolvePdfRequest(page, 0, evidencePdfBase64);
  await page.waitForTimeout(1_000);
  await expect(
    dialog.getByText(`${secondDocument.originalFileName} · 1쪽`),
  ).toBeVisible();
  await expect(dialog.getByText("1 / 1", { exact: true })).toBeVisible();
  await expect(dialog.getByText("1 / 2", { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("alert")).toHaveCount(0);
});

test("keeps readjustment candidates separate until PM approval and apply", async ({
  page,
}) => {
  const proposedRequirement = {
    requirementId: 2,
    sourceDocumentId: document.documentId,
    functionName: "감사 로그",
    requirementText: "시스템은 감사 로그를 보관해야 한다.",
    category: "SECURITY",
    priority: "HIGH",
    acceptanceCriteria: null,
    dueDate: null,
    deliverableName: null,
    securityCondition: null,
    sourceDocument: document.originalFileName,
    sourceExcerpt: "감사 로그를 보관해야 한다.",
    evidences: [],
  };
  const candidate = {
    candidateId: 8001,
    existingRequirementId: null,
    changeType: "ADDED",
    reviewStatus: "PENDING_REVIEW",
    changeReason: "추가 문서에서 새 요구사항이 도출되었습니다.",
    existingRequirement: null,
    proposedRequirement,
    evidences: proposedRequirement.evidences,
    applied: false,
    createdAt: "2026-07-30T00:00:00",
    reviewedAt: null,
  };
  let applyCalls = 0;

  await page.route(
    `**/api/projects/${project.projectId}/requirements/readjust`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projectId: project.projectId,
          changeCandidates: [candidate],
        }),
      });
    },
  );
  await page.route(
    `**/api/projects/${project.projectId}/requirements/readjustments/${candidate.candidateId}`,
    async (route) => {
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...candidate,
          reviewStatus: body.reviewStatus,
          proposedRequirement:
            body.proposedRequirement ?? candidate.proposedRequirement,
          reviewedAt: "2026-07-30T00:01:00",
        }),
      });
    },
  );
  await page.route(
    `**/api/projects/${project.projectId}/requirements/readjustments/apply`,
    async (route) => {
      applyCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          requirementsResponse([
            requirement,
            {
              ...requirement,
              requirementId: 702,
              externalReferenceId: 2,
              title: proposedRequirement.functionName,
              description: proposedRequirement.requirementText,
              type: "SECURITY",
            },
          ]),
        ),
      });
    },
  );
  await openUpload(page, {
    documents: [document],
    requirements: [requirement],
    real: true,
  });

  const readjustmentCard = page
    .getByRole("heading", { name: "요구사항 재조정" })
    .locator('xpath=ancestor::*[@data-slot="card"][1]');
  await readjustmentCard.getByRole("checkbox").check();
  await readjustmentCard
    .getByRole("button", { name: "선택 문서로 요구사항 재조정" })
    .click();

  await expect(
    page.getByRole("heading", { name: "AI 재조정 검토" }),
  ).toBeVisible();
  await expect(page.getByText("감사 로그", { exact: true })).toBeVisible();
  await expect(page.getByText(requirement.title, { exact: true })).toBeVisible();

  const candidateRow = page.getByRole("row").filter({ hasText: "감사 로그" });
  await candidateRow.getByTitle("거절").click();
  await expect(candidateRow.getByText("거절", { exact: true })).toBeVisible();
  await candidateRow.getByTitle("승인").click();
  await candidateRow.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "선택한 승인 결과 반영" })
    .click();
  await page.getByRole("button", { name: "반영", exact: true }).click();

  await expect(page.getByText("감사 로그", { exact: true }).first()).toBeVisible();
  expect(applyCalls).toBe(1);
});

test("drops stale candidate selections when readjustment results change", async ({
  page,
}) => {
  const proposedRequirement = {
    requirementId: 801,
    sourceDocumentId: document.documentId,
    functionName: "Legacy candidate",
    requirementText: "The legacy candidate should not be applied.",
    category: "FUNCTIONAL",
    priority: "HIGH",
    acceptanceCriteria: null,
    dueDate: null,
    deliverableName: null,
    securityCondition: null,
    sourceDocument: document.originalFileName,
    sourceExcerpt: "Legacy candidate",
    evidences: [],
  };
  const replacementRequirement = {
    ...proposedRequirement,
    requirementId: 802,
    functionName: "Replacement candidate",
    requirementText: "The replacement candidate should be applied.",
  };
  const firstCandidate = {
    candidateId: 8101,
    existingRequirementId: null,
    changeType: "ADDED",
    reviewStatus: "PENDING_REVIEW",
    changeReason: "First readjustment result",
    existingRequirement: null,
    proposedRequirement,
    evidences: [],
    applied: false,
    createdAt: "2026-07-30T00:00:00",
    reviewedAt: null,
  };
  const replacementCandidate = {
    ...firstCandidate,
    candidateId: 8102,
    reviewStatus: "APPROVED",
    changeReason: "Replacement readjustment result",
    proposedRequirement: replacementRequirement,
  };
  let readjustCalls = 0;
  let appliedCandidateIds: number[] = [];

  await page.route(
    `**/api/projects/${project.projectId}/requirements/readjust`,
    async (route) => {
      const changeCandidates =
        readjustCalls++ === 0 ? [firstCandidate] : [replacementCandidate];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projectId: project.projectId,
          changeCandidates,
        }),
      });
    },
  );
  await page.route(
    `**/api/projects/${project.projectId}/requirements/readjustments/${firstCandidate.candidateId}`,
    async (route) => {
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...firstCandidate,
          reviewStatus: body.reviewStatus,
          proposedRequirement:
            body.proposedRequirement ?? firstCandidate.proposedRequirement,
          reviewedAt: "2026-07-30T00:01:00",
        }),
      });
    },
  );
  await page.route(
    `**/api/projects/${project.projectId}/requirements/readjustments/apply`,
    async (route) => {
      appliedCandidateIds = route.request().postDataJSON().candidateIds;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(requirementsResponse([requirement])),
      });
    },
  );
  await openUpload(page, {
    documents: [document],
    requirements: [requirement],
    real: true,
  });

  const readjustmentCard = page
    .getByRole("heading", { name: "요구사항 재조정" })
    .locator('xpath=ancestor::*[@data-slot="card"][1]');
  await readjustmentCard.getByRole("checkbox").check();
  await readjustmentCard
    .getByRole("button", { name: "선택 문서로 요구사항 재조정" })
    .click();

  const firstRow = page.getByRole("row").filter({ hasText: "Legacy candidate" });
  await firstRow.getByTitle("승인").click();
  await firstRow.getByRole("checkbox").check();

  await readjustmentCard.getByRole("checkbox").check();
  await readjustmentCard
    .getByRole("button", { name: "선택 문서로 요구사항 재조정" })
    .click();

  await expect(firstRow).toHaveCount(0);
  const replacementRow = page
    .getByRole("row")
    .filter({ hasText: "Replacement candidate" });
  await expect(replacementRow.getByRole("checkbox")).not.toBeChecked();
  await replacementRow.getByRole("checkbox").check();
  await page.getByRole("button", { name: "선택한 승인 결과 반영" }).click();
  await page.getByRole("button", { name: "반영", exact: true }).click();

  expect(appliedCandidateIds).toEqual([replacementCandidate.candidateId]);
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
    `**/api/projects/${project.projectId}/requirements/readjust`,
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

test("recovers the analysis controls and preserves results after a timeout", async ({
  page,
}) => {
  let readjustCalls = 0;
  await page.route(
    `**/api/projects/${project.projectId}/requirements/readjust`,
    async (route) => {
      readjustCalls += 1;
      await route.fulfill({
        status: 504,
        contentType: "application/json",
        body: JSON.stringify({ message: "upstream timeout" }),
      });
    },
  );
  await openUpload(page, {
    documents: [document],
    requirements: [requirementWithEvidence],
    real: true,
  });

  const readjustmentCard = page
    .getByRole("heading", { name: "요구사항 재조정" })
    .locator('xpath=ancestor::*[@data-slot="card"][1]');
  await readjustmentCard.getByRole("checkbox").check();
  const readjustButton = readjustmentCard.getByRole("button", {
    name: "선택 문서로 요구사항 재조정",
  });
  await readjustButton.click();

  await expect(
    page
      .getByRole("alert")
      .getByText(
        "문서 분석 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.",
        { exact: true },
      ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "요구사항을 분석 중입니다. 완료될 때까지 다시 실행할 수 없습니다.",
      { exact: true },
    ),
  ).toHaveCount(0);
  await expect(readjustButton).toBeEnabled();
  await expect(
    page.getByText(requirementWithEvidence.title, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "AI 재조정 검토" }),
  ).toHaveCount(0);
  const documentRow = page
    .getByRole("row")
    .filter({ hasText: document.originalFileName });
  await expect(documentRow.getByText("대기", { exact: true })).toBeVisible();
  await page.waitForTimeout(300);
  expect(readjustCalls).toBe(1);
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

function createSinglePagePdfBase64(text: string, drawingOperations = 0) {
  const escapedText = text.replace(/([\\()])/g, "\\$1");
  let graphics = "";
  for (let index = 0; index < drawingOperations; index += 1) {
    graphics += `${index % 600} ${index % 760} 1 1 re f\n`;
  }
  const content = [
    `BT /F1 14 Tf 72 720 Td (${escapedText}) Tj ET`,
    graphics ? `q 0.8 g\n${graphics}Q` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
  ];
  const offsets = [0];
  let pdf = "%PDF-1.4\n";
  objects.forEach((body, index) => {
    offsets[index + 1] = Buffer.byteLength(pdf, "latin1");
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1").toString("base64");
}

async function installPdfFetchHarness(page: Page, rejectOnAbort: boolean) {
  await page.addInitScript(
    ({ shouldRejectOnAbort }) => {
      type PdfRequestRecord = {
        url: string;
        aborted: boolean;
        resolve: (response: Response) => void;
        reject: (reason?: unknown) => void;
      };
      type PdfTestWindow = Window & {
        __pdfFetchRequests: PdfRequestRecord[];
        __resolvePdfRequest: (index: number, base64: string) => void;
      };

      const testWindow = window as PdfTestWindow;
      const originalFetch = window.fetch.bind(window);
      testWindow.__pdfFetchRequests = [];
      testWindow.__resolvePdfRequest = (index, base64) => {
        const request = testWindow.__pdfFetchRequests[index];
        if (!request) throw new Error(`Unknown PDF request ${index}`);
        const binary = window.atob(base64);
        const bytes = Uint8Array.from(binary, (value) => value.charCodeAt(0));
        request.resolve(
          new Response(bytes, {
            status: 200,
            headers: { "Content-Type": "application/pdf" },
          }),
        );
      };

      window.fetch = ((
        input: Parameters<typeof window.fetch>[0],
        init?: Parameters<typeof window.fetch>[1],
      ) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (!url.includes("/documents/") || !url.endsWith("/content")) {
          return originalFetch(input, init);
        }

        const signal =
          init?.signal ?? (input instanceof Request ? input.signal : null);
        return new Promise<Response>((resolve, reject) => {
          const request: PdfRequestRecord = {
            url,
            aborted: false,
            resolve,
            reject,
          };
          const abort = () => {
            request.aborted = true;
            if (shouldRejectOnAbort) {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            }
          };
          signal?.addEventListener("abort", abort, { once: true });
          if (signal?.aborted) abort();
          testWindow.__pdfFetchRequests.push(request);
        });
      }) as typeof window.fetch;
    },
    { shouldRejectOnAbort: rejectOnAbort },
  );
}

async function pdfRequestCount(page: Page) {
  return page.evaluate(
    () =>
      (
        window as Window & {
          __pdfFetchRequests?: Array<{ aborted: boolean }>;
        }
      ).__pdfFetchRequests?.length ?? 0,
  );
}

async function pdfRequestWasAborted(page: Page, index: number) {
  return page.evaluate(
    (requestIndex) =>
      (
        window as Window & {
          __pdfFetchRequests?: Array<{ aborted: boolean }>;
        }
      ).__pdfFetchRequests?.[requestIndex]?.aborted ?? false,
    index,
  );
}

async function resolvePdfRequest(page: Page, index: number, base64: string) {
  await page.evaluate(
    ({ requestIndex, body }) =>
      (
        window as Window & {
          __resolvePdfRequest: (index: number, value: string) => void;
        }
      ).__resolvePdfRequest(requestIndex, body),
    { requestIndex: index, body: base64 },
  );
}

async function openUpload(
  page: Page,
  options: {
    documents: Array<typeof document>;
    requirements:
      | Array<typeof requirement>
      | (() => Array<typeof requirement>);
    real?: boolean;
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
  await page.route(
    `**/api/projects/${project.projectId}/requirements/readjustments`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projectId: project.projectId,
          changeCandidates: [],
        }),
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

  await login(
    page,
    options.real
      ? `/real/projects/${project.projectId}/data`
      : "/",
  );
  if (!options.real) {
    await page.getByRole("button", { name: "문서 업로드", exact: true }).click();
  }
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
        serverTime: now,
      }),
    });
  });
}

async function login(page: Page, path = "/") {
  await page.goto(path);
  await page.locator("#email").fill("requirements-ui@example.test");
  await page.locator("#password").fill("local-test-password");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
}
