/**
 * 위클리 스크럼 제출물 태깅 유틸.
 *
 * 백엔드 문서 모델에 아직 "분류(카테고리)" 필드가 없어서, 기존에 이미 동작하는
 * 문서 업로드/조회 API(uploadProjectDocuments / listProjectDocuments)를 그대로
 * 쓰되 파일명 앞에 태그를 붙여 위클리 스크럼 제출물만 구분해낸다.
 * 나중에 백엔드에 분류 필드가 생기면 이 파일만 지우고 그 필드를 쓰면 된다.
 */

export const WEEKLY_SCRUM_PREFIX = "[위클리스크럼]";

export function buildTaggedFileName(
  week: string,
  authorName: string,
  originalName: string,
) {
  return `${WEEKLY_SCRUM_PREFIX} ${week}_${authorName}_${originalName}`;
}

export interface ParsedWeeklyScrumFileName {
  week: string;
  authorName: string;
  originalName: string;
}

export function parseTaggedFileName(
  fileName: string,
): ParsedWeeklyScrumFileName | null {
  if (!fileName.startsWith(WEEKLY_SCRUM_PREFIX)) return null;
  const rest = fileName.slice(WEEKLY_SCRUM_PREFIX.length).trim();
  const [week, authorName, ...originalParts] = rest.split("_");
  return {
    week: week ?? "",
    authorName: authorName ?? "",
    originalName: originalParts.join("_") || rest,
  };
}

/** 특정 날짜(YYYY-MM-DD)의 ISO 8601 주차 문자열(예: "2026-W31")을 계산한다. */
export function weekOfDate(dateStr: string) {
  const now = new Date(dateStr);
  const target = new Date(now.getTime());
  const dayNumber = (now.getDay() + 6) % 7; // 월요일=0
  target.setDate(now.getDate() - dayNumber + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const week =
    1 +
    Math.round(
      ((target.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getDay() + 6) % 7)) /
        7,
    );
  return `${target.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** ISO 8601 주차 문자열(예: "2026-W31")을 오늘 날짜 기준으로 계산한다. */
export function currentWeekValue() {
  return weekOfDate(new Date().toISOString().slice(0, 10));
}