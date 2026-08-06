import {
  assistantApi,
  AssistantApiError,
  type AssistantLlmStatus,
} from "@/app/api/assistantApi";
import { getAccessToken } from "@/app/api/authToken";

export type UiPrototypeStyle = "WORKSPACE" | "MINIMAL" | "MOBILE_FIRST";

export interface UiPrototypeKpi {
  label: string;
  value: string;
  helper: string;
}

export interface UiPrototypeSection {
  title: string;
  items: string[];
}

export interface UiPrototypeScreen {
  id: string;
  name: string;
  purpose: string;
  headline: string;
  navigation: string[];
  kpis: UiPrototypeKpi[];
  sections: UiPrototypeSection[];
  primaryAction: string;
}

export interface UiPrototypeResult {
  projectId: string;
  projectName: string;
  request: string;
  style: UiPrototypeStyle;
  summary: string;
  screens: UiPrototypeScreen[];
  generatedAt: string;
  llmStatus: AssistantLlmStatus;
  sourceLabels: string[];
  structuredFromAi: boolean;
}

export interface GenerateUiPrototypeInput {
  projectId: string;
  projectName: string;
  request: string;
  style: UiPrototypeStyle;
}

const STORAGE_PREFIX = "aipm.uiPrototypeArtifact";

function storageKey(projectId: string) {
  return `${STORAGE_PREFIX}.${projectId}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function textArray(value: unknown, fallback: string[] = []) {
  if (!Array.isArray(value)) return fallback;
  const normalized = value
    .map((item) => text(item))
    .filter(Boolean)
    .slice(0, 8);
  return normalized.length ? normalized : fallback;
}

function compact(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength - 1)}…`;
}

function safeId(value: string, index: number) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `screen-${index + 1}`;
}

function fallbackScreens(
  projectName: string,
  request: string,
): UiPrototypeScreen[] {
  const commonNavigation = ["프로젝트", "요구사항", "일정", "리스크"];
  const requestHint = compact(request, 64) || "프로젝트 핵심 정보를 빠르게 확인";

  return [
    {
      id: "dashboard",
      name: "대시보드",
      purpose: "프로젝트 상태와 우선순위를 한 화면에서 확인합니다.",
      headline: `${projectName} 운영 현황`,
      navigation: commonNavigation,
      kpis: [
        { label: "전체 진행률", value: "68%", helper: "지난주 대비 +4%" },
        { label: "남은 일정", value: "D-42", helper: "계획 범위 내" },
        { label: "열린 리스크", value: "3건", helper: "고위험 1건" },
        { label: "요구사항", value: "24건", helper: "확정 19건" },
      ],
      sections: [
        {
          title: "이번 주 우선순위",
          items: [requestHint, "일정 지연 가능 작업 확인", "담당자별 업무 부하 점검"],
        },
        {
          title: "최근 활동",
          items: ["요구사항 검토 완료", "WBS 일정 갱신", "리스크 대응안 등록"],
        },
      ],
      primaryAction: "주간 보고서 생성",
    },
    {
      id: "list",
      name: "목록 화면",
      purpose: "업무와 요구사항을 필터링하고 상태별로 관리합니다.",
      headline: "업무 통합 목록",
      navigation: commonNavigation,
      kpis: [
        { label: "전체", value: "32", helper: "모든 작업" },
        { label: "진행 중", value: "11", helper: "담당자 배정 완료" },
        { label: "검토 대기", value: "5", helper: "PM 확인 필요" },
      ],
      sections: [
        {
          title: "작업 목록",
          items: ["상태 · 우선순위 · 담당자 필터", "마감일 오름차순 정렬", "다중 선택 일괄 변경"],
        },
        {
          title: "빠른 검색",
          items: [requestHint, "요구사항 ID 검색", "담당자 및 산출물 검색"],
        },
      ],
      primaryAction: "새 작업 추가",
    },
    {
      id: "detail",
      name: "상세 화면",
      purpose: "선택한 작업의 맥락, 일정, 담당자와 이력을 확인합니다.",
      headline: "업무 상세",
      navigation: commonNavigation,
      kpis: [
        { label: "상태", value: "진행 중", helper: "검토 전" },
        { label: "우선순위", value: "높음", helper: "핵심 경로" },
        { label: "예상 공수", value: "16h", helper: "잔여 6h" },
      ],
      sections: [
        {
          title: "업무 개요",
          items: [requestHint, "완료 조건 및 관련 요구사항", "선행·후행 작업 연결"],
        },
        {
          title: "협업 기록",
          items: ["담당자 코멘트", "첨부 산출물", "변경 이력 타임라인"],
        },
      ],
      primaryAction: "검토 요청",
    },
  ];
}

function extractJson(answer: string): unknown | null {
  const withoutFence = answer
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    return JSON.parse(withoutFence.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

function normalizeScreens(
  raw: unknown,
  projectName: string,
  request: string,
): UiPrototypeScreen[] {
  if (!Array.isArray(raw)) return fallbackScreens(projectName, request);

  const screens = raw
    .slice(0, 5)
    .map((item, index): UiPrototypeScreen | null => {
      const record = asRecord(item);
      if (!record) return null;
      const name = text(record.name, `화면 ${index + 1}`);

      const rawKpis = Array.isArray(record.kpis) ? record.kpis : [];
      const kpis = rawKpis
        .slice(0, 4)
        .map((kpi): UiPrototypeKpi | null => {
          const kpiRecord = asRecord(kpi);
          if (!kpiRecord) return null;
          return {
            label: text(kpiRecord.label, "지표"),
            value: text(kpiRecord.value, "-"),
            helper: text(kpiRecord.helper, "프로젝트 데이터 기반"),
          };
        })
        .filter((kpi): kpi is UiPrototypeKpi => Boolean(kpi));

      const rawSections = Array.isArray(record.sections) ? record.sections : [];
      const sections = rawSections
        .slice(0, 4)
        .map((section): UiPrototypeSection | null => {
          const sectionRecord = asRecord(section);
          if (!sectionRecord) return null;
          return {
            title: text(sectionRecord.title, "주요 영역"),
            items: textArray(sectionRecord.items, ["프로젝트 정보를 표시합니다."]),
          };
        })
        .filter((section): section is UiPrototypeSection => Boolean(section));

      return {
        id: safeId(name, index),
        name,
        purpose: text(record.purpose, "프로젝트 업무를 효율적으로 지원합니다."),
        headline: text(record.headline, `${projectName} ${name}`),
        navigation: textArray(record.navigation, ["프로젝트", "업무", "리스크"]),
        kpis:
          kpis.length > 0
            ? kpis
            : fallbackScreens(projectName, request)[0].kpis.slice(0, 3),
        sections:
          sections.length > 0
            ? sections
            : fallbackScreens(projectName, request)[0].sections,
        primaryAction: text(record.primaryAction, "작업 실행"),
      };
    })
    .filter((screen): screen is UiPrototypeScreen => Boolean(screen));

  return screens.length ? screens : fallbackScreens(projectName, request);
}

function buildPrompt(input: GenerateUiPrototypeInput) {
  const styleLabel: Record<UiPrototypeStyle, string> = {
    WORKSPACE: "업무용 SaaS 대시보드, 정보 밀도는 높지만 읽기 쉬운 구성",
    MINIMAL: "여백이 넉넉한 미니멀 웹 서비스",
    MOBILE_FIRST: "모바일 우선 반응형 서비스",
  };

  return [
    "현재 프로젝트의 확정 요구사항, WBS, 일정, 리스크 및 산출물 맥락을 참고해 UI 화면 시안을 설계해 주세요.",
    `프로젝트명: ${input.projectName}`,
    `추가 요청: ${input.request || "핵심 프로젝트 관리 흐름을 중심으로 구성"}`,
    `디자인 방향: ${styleLabel[input.style]}`,
    "",
    "반드시 아래 JSON 객체만 출력하세요. 마크다운과 설명문은 출력하지 마세요.",
    "{",
    '  "summary": "전체 시안 설계 의도 1~2문장",',
    '  "screens": [',
    "    {",
    '      "name": "화면 이름",',
    '      "purpose": "사용 목적",',
    '      "headline": "화면 상단 제목",',
    '      "navigation": ["메뉴1", "메뉴2", "메뉴3"],',
    '      "kpis": [{"label":"지표명","value":"표시값","helper":"보조 설명"}],',
    '      "sections": [{"title":"영역명","items":["항목1","항목2"]}],',
    '      "primaryAction": "주요 버튼 문구"',
    "    }",
    "  ]",
    "}",
    "화면은 3개를 제안하고, 각 화면의 KPI는 최대 4개, 섹션은 최대 3개로 제한하세요.",
    "응답 값은 모두 한국어로 작성하세요.",
  ].join("\n");
}

function sourceLabels(answer: Awaited<ReturnType<typeof assistantApi.query>>) {
  const labels = answer.sources
    .map((source) =>
      source.documentName
        ? source.documentName
        : source.requirementId
          ? `요구사항 #${source.requirementId}`
          : source.wbsId
            ? `WBS #${source.wbsId}`
            : null,
    )
    .filter((label): label is string => Boolean(label));
  return [...new Set(labels)].slice(0, 6);
}

export async function generateUiPrototype(
  input: GenerateUiPrototypeInput,
): Promise<UiPrototypeResult> {
  const accessToken = getAccessToken();
  const answer = await assistantApi.query(
    input.projectId,
    buildPrompt(input),
    accessToken,
    true,
  );
  const parsed = extractJson(answer.answer);
  const parsedRecord = asRecord(parsed);
  const structuredFromAi = Boolean(parsedRecord);
  const fallbackSummary = answer.answer
    ? compact(answer.answer, 260)
    : "프로젝트 데이터에 맞춘 기본 화면 구조를 구성했습니다.";

  const result: UiPrototypeResult = {
    projectId: input.projectId,
    projectName: input.projectName,
    request: input.request,
    style: input.style,
    summary: text(parsedRecord?.summary, fallbackSummary),
    screens: normalizeScreens(
      parsedRecord?.screens,
      input.projectName,
      input.request,
    ),
    generatedAt: answer.generatedAt ?? new Date().toISOString(),
    llmStatus: answer.llmStatus,
    sourceLabels: sourceLabels(answer),
    structuredFromAi,
  };

  saveStoredUiPrototype(result);
  return result;
}

export function loadStoredUiPrototype(projectId: string): UiPrototypeResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return null;
    const value = JSON.parse(raw) as UiPrototypeResult;
    if (
      value.projectId !== projectId ||
      !Array.isArray(value.screens) ||
      value.screens.length === 0
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function saveStoredUiPrototype(result: UiPrototypeResult) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(result.projectId), JSON.stringify(result));
}

export function uiPrototypeErrorMessage(error: unknown) {
  if (!(error instanceof AssistantApiError)) {
    return "UI 시안을 생성하는 중 오류가 발생했습니다.";
  }
  if (error.status === 401) return "로그인이 만료되었습니다. 다시 로그인해 주세요.";
  if (error.status === 403) return "이 프로젝트의 AI 기능을 사용할 권한이 없습니다.";
  if (error.status === 502 || error.status === 503) {
    return "AI 서버에 연결할 수 없습니다. 백엔드와 AI 서버 상태를 확인해 주세요.";
  }
  return error.message;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function svgText(value: string, maxLength: number) {
  return escapeXml(compact(value, maxLength));
}

export function buildUiPrototypeSvg(
  result: UiPrototypeResult,
  screen: UiPrototypeScreen,
) {
  const width = 1440;
  const height = 900;
  const sidebarWidth = 220;
  const contentX = 260;
  const contentWidth = 1140;
  const kpiGap = 18;
  const kpiCount = Math.max(1, Math.min(4, screen.kpis.length));
  const kpiWidth = (contentWidth - kpiGap * (kpiCount - 1)) / kpiCount;

  const nav = screen.navigation
    .slice(0, 7)
    .map((item, index) => {
      const y = 142 + index * 52;
      const active = index === 0;
      return `
        <rect x="20" y="${y - 28}" width="180" height="40" rx="10" fill="${active ? "#dbeafe" : "transparent"}"/>
        <circle cx="42" cy="${y - 8}" r="5" fill="${active ? "#2563eb" : "#94a3b8"}"/>
        <text x="58" y="${y - 3}" font-size="15" fill="${active ? "#1d4ed8" : "#475569"}" font-family="Arial, sans-serif">${svgText(item, 18)}</text>`;
    })
    .join("");

  const kpis = screen.kpis
    .slice(0, 4)
    .map((kpi, index) => {
      const x = contentX + index * (kpiWidth + kpiGap);
      return `
        <rect x="${x}" y="188" width="${kpiWidth}" height="126" rx="16" fill="#ffffff" stroke="#e2e8f0"/>
        <text x="${x + 20}" y="220" font-size="14" fill="#64748b" font-family="Arial, sans-serif">${svgText(kpi.label, 22)}</text>
        <text x="${x + 20}" y="262" font-size="29" font-weight="700" fill="#0f172a" font-family="Arial, sans-serif">${svgText(kpi.value, 16)}</text>
        <text x="${x + 20}" y="291" font-size="12" fill="#64748b" font-family="Arial, sans-serif">${svgText(kpi.helper, 30)}</text>`;
    })
    .join("");

  const sectionWidth = (contentWidth - 20) / 2;
  const sections = screen.sections
    .slice(0, 4)
    .map((section, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = contentX + column * (sectionWidth + 20);
      const y = 342 + row * 228;
      const items = section.items
        .slice(0, 5)
        .map(
          (item, itemIndex) => `
            <circle cx="${x + 26}" cy="${y + 70 + itemIndex * 32}" r="4" fill="#3b82f6"/>
            <text x="${x + 40}" y="${y + 75 + itemIndex * 32}" font-size="14" fill="#334155" font-family="Arial, sans-serif">${svgText(item, 58)}</text>`,
        )
        .join("");
      return `
        <rect x="${x}" y="${y}" width="${sectionWidth}" height="204" rx="16" fill="#ffffff" stroke="#e2e8f0"/>
        <text x="${x + 22}" y="${y + 36}" font-size="18" font-weight="700" fill="#0f172a" font-family="Arial, sans-serif">${svgText(section.title, 34)}</text>
        ${items}`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#f8fafc"/>
  <rect x="0" y="0" width="${sidebarWidth}" height="${height}" fill="#ffffff" stroke="#e2e8f0"/>
  <circle cx="38" cy="38" r="18" fill="#2563eb"/>
  <text x="66" y="44" font-size="18" font-weight="700" fill="#0f172a" font-family="Arial, sans-serif">BidWorks AI</text>
  <text x="20" y="94" font-size="11" fill="#94a3b8" font-family="Arial, sans-serif">PROJECT WORKSPACE</text>
  ${nav}
  <rect x="${contentX}" y="28" width="${contentWidth}" height="64" rx="16" fill="#ffffff" stroke="#e2e8f0"/>
  <text x="${contentX + 24}" y="56" font-size="13" fill="#64748b" font-family="Arial, sans-serif">${svgText(result.projectName, 52)}</text>
  <text x="${contentX + 24}" y="80" font-size="19" font-weight="700" fill="#0f172a" font-family="Arial, sans-serif">${svgText(screen.name, 34)}</text>
  <rect x="1196" y="43" width="180" height="36" rx="10" fill="#2563eb"/>
  <text x="1286" y="66" text-anchor="middle" font-size="14" font-weight="700" fill="#ffffff" font-family="Arial, sans-serif">${svgText(screen.primaryAction, 22)}</text>
  <text x="${contentX}" y="138" font-size="28" font-weight="700" fill="#0f172a" font-family="Arial, sans-serif">${svgText(screen.headline, 48)}</text>
  <text x="${contentX}" y="166" font-size="14" fill="#64748b" font-family="Arial, sans-serif">${svgText(screen.purpose, 92)}</text>
  ${kpis}
  ${sections}
  <text x="${contentX}" y="870" font-size="11" fill="#94a3b8" font-family="Arial, sans-serif">AI-generated UI draft · ${svgText(result.generatedAt, 30)}</text>
</svg>`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadUiPrototypeSvg(
  result: UiPrototypeResult,
  screen: UiPrototypeScreen,
) {
  const svg = buildUiPrototypeSvg(result, screen);
  downloadBlob(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    `ui-prototype-${screen.id}.svg`,
  );
}

export function downloadUiPrototypeJson(result: UiPrototypeResult) {
  downloadBlob(
    new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json;charset=utf-8",
    }),
    `ui-prototype-${result.projectId}.json`,
  );
}
