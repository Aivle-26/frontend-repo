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
 * PM 등록 화면(StaffNotice)과 직원 열람 화면(StaffNoticeBoard)이 이 훅을 함께 써서
 * 같은 백엔드 데이터를 바라본다. (기존 localStorage 스토어는 PM/직원이 분리돼 있어
 * 서로 동기화되지 않았다.)
 *
 * 백엔드 스키마는 title + content(문자열)만 저장하므로, 화면에서 쓰는
 * category/priority/pinned/summary/author는 content 앞에 한 줄 메타(@@meta:{...})로
 * 실어 왕복시킨다. 메타 줄은 화면 표시에서 제외된다.
 */

const META_PREFIX = "@@meta:";

interface NoticeMeta {
  category?: NoticeCategory;
  priority?: Priority;
  pinned?: boolean;
  summary?: string;
  author?: string;
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
  /** 새 공지 등록 (PM 전용). 성공 시 목록을 새로고침한다. 실패 시 throw. */
  createNotice: (notice: Omit<Notice, "id">) => Promise<void>;
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
    setLoading(true);
    setError("");
    projectRepository
      .getProjectNotices(projectId)
      .then((list) => setNotices(list.map(decodeNotice)))
      .catch((caught) => {
        setNotices([]);
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
      await projectRepository.createProjectNotice(projectId, {
        title: notice.title,
        content: encodeContent(notice.content, {
          category: notice.category,
          priority: notice.priority,
          pinned: notice.pinned,
          summary: notice.summary,
          author: notice.author,
        }),
      });
      refresh();
    },
    [projectId, refresh],
  );

  return { notices, loading, error, refresh, createNotice };
}
