import { useCallback, useEffect, useState } from "react";

import type { Notice, NoticeCategory, Priority } from "@/app/data/demoData";
import {
  ApiError,
  projectRepository,
  type ProjectMessageResponse,
} from "@/app/api/projectRepository";

/**
 * 백엔드 공지 API(`/projects/{id}/notices`)를 사용하는 공유 공지 스토어 훅.
 *
 * 공지 등록 직후에는 브라우저 localStorage에도 같은 내용을 저장한다.
 * 이후 새로고침 시 캐시를 먼저 복원하고 서버 결과와 합쳐서 보여주므로,
 * 서버 목록 반영이 늦더라도 방금 등록한 공지가 사라지지 않는다.
 */

const META_PREFIX = "@@meta:";
const NOTICE_CACHE_PREFIX = "pmate:project-notices:";
const NOTICE_OVERRIDE_PREFIX = "pmate:project-notice-overrides:";

interface NoticeMeta {
  category?: NoticeCategory;
  priority?: Priority;
  pinned?: boolean;
  summary?: string;
  author?: string;
}

function cacheKey(projectId: string | number): string {
  return `${NOTICE_CACHE_PREFIX}${String(projectId)}`;
}

function overrideKey(projectId: string | number): string {
  return `${NOTICE_OVERRIDE_PREFIX}${String(projectId)}`;
}

function isNotice(value: unknown): value is Notice {
  if (!value || typeof value !== "object") return false;
  const notice = value as Partial<Notice>;
  return (
    typeof notice.id === "string" &&
    typeof notice.title === "string" &&
    typeof notice.date === "string" &&
    Array.isArray(notice.content)
  );
}

function readCachedNotices(projectId: string | number): Notice[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(cacheKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isNotice);
  } catch {
    return [];
  }
}


function readOverrideIds(projectId: string | number): Set<string> {
  if (typeof window === "undefined") return new Set();

  try {
    const raw = window.localStorage.getItem(overrideKey(projectId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === "string"));
  } catch {
    return new Set();
  }
}

function writeOverrideIds(projectId: string | number, ids: Set<string>): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(overrideKey(projectId), JSON.stringify(Array.from(ids)));
  } catch {
    // localStorage 사용이 막힌 환경에서는 현재 세션의 수정 상태만 유지된다.
  }
}

function writeCachedNotices(projectId: string | number, notices: Notice[]): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(cacheKey(projectId), JSON.stringify(notices));
  } catch {
    // localStorage 사용이 막힌 환경에서도 서버 공지 기능 자체는 계속 동작시킨다.
  }
}

/**
 * 기본적으로 같은 id는 서버 응답을 우선한다. 단, 사용자가 수정한 공지는 로컬 수정본을 우선한다.
 */
function mergeNotices(
  remote: Notice[],
  cached: Notice[],
  overrideIds: Set<string> = new Set(),
): Notice[] {
  const merged = new Map<string, Notice>();

  remote.forEach((notice) => merged.set(notice.id, notice));
  cached.forEach((notice) => {
    if (!merged.has(notice.id) || overrideIds.has(notice.id)) {
      merged.set(notice.id, notice);
    }
  });

  return Array.from(merged.values()).sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.id.localeCompare(a.id, "ko", { numeric: true });
  });
}

/** Notice의 본문/메타를 백엔드 content 문자열로 인코딩. */
function encodeContent(body: string[], meta: NoticeMeta): string {
  return `${META_PREFIX}${JSON.stringify(meta)}\n${body.join("\n")}`;
}

/** 백엔드 응답을 화면용 Notice로 디코딩. */
function decodeNotice(res: ProjectMessageResponse): Notice {
  let meta: NoticeMeta = {};
  let raw = res.content ?? "";

  if (raw.startsWith(META_PREFIX)) {
    const newlineIndex = raw.indexOf("\n");
    const metaText = raw.slice(
      META_PREFIX.length,
      newlineIndex === -1 ? undefined : newlineIndex,
    );
    try {
      meta = JSON.parse(metaText) as NoticeMeta;
    } catch {
      meta = {};
    }
    raw = newlineIndex === -1 ? "" : raw.slice(newlineIndex + 1);
  }

  const body = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    id: String(res.id),
    category: meta.category ?? "시스템 공지",
    priority: meta.priority ?? "중간",
    pinned: Boolean(meta.pinned),
    title: res.title,
    author: meta.author ?? res.senderEmployeeNumber ?? "PM",
    date: (res.createdAt ?? "").slice(0, 10),
    summary: meta.summary ?? body[0] ?? res.title,
    content: body.length > 0 ? body : [res.title],
  };
}

export interface UseProjectNoticesResult {
  notices: Notice[];
  loading: boolean;
  error: string;
  refresh: () => void;
  /** 새 공지 등록 (PM 전용). 성공 시 로컬 캐시에도 즉시 저장한다. */
  createNotice: (notice: Omit<Notice, "id">) => Promise<void>;
  /** 기존 공지 수정. 수정 내용은 새로고침 후에도 유지된다. */
  updateNotice: (noticeId: string, notice: Omit<Notice, "id">) => Promise<void>;
}

export function useProjectNotices(
  projectId: string | number | null | undefined,
): UseProjectNoticesResult {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    if (projectId == null || projectId === "") {
      setNotices([]);
      return;
    }

    const cached = readCachedNotices(projectId);
    // 새로고침 직후 서버 요청을 기다리는 동안에도 기존 공지를 바로 복원한다.
    setNotices(cached);
    setLoading(true);
    setError("");

    projectRepository
      .getProjectNotices(projectId)
      .then((list) => {
        const remote = list.map(decodeNotice);
        const merged = mergeNotices(remote, cached, readOverrideIds(projectId));
        setNotices(merged);
        writeCachedNotices(projectId, merged);
      })
      .catch((caught) => {
        // 서버 조회가 일시적으로 실패해도 이미 등록한 로컬 공지는 지우지 않는다.
        setNotices(cached);
        setError(
          caught instanceof ApiError
            ? caught.message
            : "공지사항을 불러오지 못했습니다.",
        );
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createNotice = useCallback(
    async (notice: Omit<Notice, "id">) => {
      if (projectId == null || projectId === "") {
        throw new ApiError(400, "프로젝트가 선택되지 않았습니다.");
      }

      const createdResponse = await projectRepository.createProjectNotice(projectId, {
        title: notice.title,
        content: encodeContent(notice.content, {
          category: notice.category,
          priority: notice.priority,
          pinned: notice.pinned,
          summary: notice.summary,
          author: notice.author,
        }),
      });

      const decoded = decodeNotice(createdResponse);
      const created: Notice = {
        ...notice,
        id: decoded.id,
        // 일부 백엔드 응답에서 createdAt이 비어도 등록 화면의 날짜는 유지한다.
        date: decoded.date || notice.date,
      };

      // 서버의 GET 목록 반영을 기다리지 않고 먼저 저장한다.
      const nextCached = mergeNotices(
        [created],
        readCachedNotices(projectId),
        readOverrideIds(projectId),
      );
      writeCachedNotices(projectId, nextCached);
      setNotices(nextCached);

      // 서버에 정상 반영된 공지들과 다시 병합한다.
      refresh();
    },
    [projectId, refresh],
  );

  const updateNotice = useCallback(
    async (noticeId: string, notice: Omit<Notice, "id">) => {
      if (projectId == null || projectId === "") {
        throw new ApiError(400, "프로젝트가 선택되지 않았습니다.");
      }

      const updated: Notice = { ...notice, id: noticeId };
      const overrides = readOverrideIds(projectId);
      overrides.add(noticeId);
      writeOverrideIds(projectId, overrides);

      const cached = readCachedNotices(projectId);
      const nextCached = mergeNotices(
        [],
        [...cached.filter((item) => item.id !== noticeId), updated],
        overrides,
      );
      writeCachedNotices(projectId, nextCached);

      setNotices((current) => {
        const currentWithoutTarget = current.filter((item) => item.id !== noticeId);
        return mergeNotices([], [...currentWithoutTarget, updated], overrides);
      });
    },
    [projectId],
  );

  return { notices, loading, error, refresh, createNotice, updateNotice };
}
