import { useEffect, useState } from "react";
import type { Notice } from "@/app/data/demoData";

/**
 * 직원 전용 공지사항 스토어입니다. (staffNoticeStore)
 *
 * PM 쪽 noticeStore.ts와는 완전히 분리된 별도 스토어예요 — localStorage 키도
 * 다르고("aipm.staffNotices"), 이벤트명도 다릅니다. PM 화면 코드가 바뀌어도
 * 이 스토어와 StaffNoticeBoard.tsx는 영향을 받지 않습니다.
 *
 * 더미 데이터(SEED_NOTICES)도 demoData.ts를 참조하지 않고 이 파일 안에
 * 직접 넣어뒀습니다. demoData.ts의 STAFF_NOTICES는 다른 팀원이 계속
 * 정리(비우기)하고 있어서, 그걸 참조하면 이 스토어도 같이 비어버려요.
 * (백엔드에 공지사항 API가 추가되면 이 스토어를 API 호출로 교체하면 됩니다.)
 */

const SEED_NOTICES: Notice[] = [
  {
    id: "n1",
    category: "PM 피드백",
    priority: "높음",
    pinned: true,
    title: "3.2 환경 규정 준수 초안 검토 의견",
    author: "PM 정하늘",
    date: "2026-07-22",
    summary: "근거 조항 인용이 빠져 있어 감점 요인이 될 수 있습니다.",
    content: [
      "3.2 환경 규정 준수 초안을 검토했습니다. 전반적인 구성은 좋으나, 근거 조항을 명시하지 않으면 감점 대상이 됩니다.",
      "'온실가스 저감 계획' 항목에는 관련 법령의 구체적 조항 번호를 함께 기재해 주세요.",
      "표 3의 수치 출처도 각주로 표기가 필요합니다. 금주 목요일 최종본 취합 전까지 반영 부탁드립니다.",
    ],
  },
  {
    id: "n2",
    category: "마감 안내",
    priority: "높음",
    pinned: true,
    title: "RFP 4.1 기술 요건 제출 마감 D-3",
    author: "운영팀",
    date: "2026-07-21",
    summary: "입찰 전략 API 최적화 항목 마감이 임박했습니다.",
    content: [
      "RFP 4.1 기술 요건 관련 산출물 제출 마감이 7월 25일(금) 18:00로 다가왔습니다.",
      "현재 진행률은 약 70%이며, 미완료 항목은 API 응답 시간 벤치마크 표 작성입니다.",
      "마감 이후 제출본은 재검토 절차가 추가로 필요하니 기한 내 업로드 부탁드립니다.",
    ],
  },
  {
    id: "n3",
    category: "PM 피드백",
    priority: "중간",
    pinned: false,
    title: "UI 리팩토링(업무 보드) 1차 리뷰 코멘트",
    author: "PM 이서연",
    date: "2026-07-20",
    summary: "우선순위 뱃지 색상 대비를 조금 더 높여주세요.",
    content: [
      "업무 보드 UI 리팩토링 1차 안 잘 봤습니다. 전체적인 레이아웃은 승인합니다.",
      "다만 '중간' 뱃지 색상이 배경과 대비가 낮아 접근성 기준을 충족하지 못할 수 있어요. 색상값 조정 부탁드립니다.",
      "모바일 뷰에서 사이드바 축소 시 아이콘 정렬도 함께 확인해 주세요.",
    ],
  },
  {
    id: "n4",
    category: "시스템 공지",
    priority: "낮음",
    pinned: false,
    title: "정기 점검 안내 (7/27 새벽 2시~4시)",
    author: "운영팀",
    date: "2026-07-19",
    summary: "해당 시간 동안 문서 통합 관리 기능 이용이 일시 제한됩니다.",
    content: [
      "서버 안정화 작업을 위해 7월 27일(월) 02:00~04:00 동안 정기 점검을 진행합니다.",
      "점검 시간 동안 문서 통합 관리 및 산출물 제출 기능 이용이 일시적으로 제한됩니다.",
      "작업 중 진행 중이던 초안은 자동 저장되며, 점검 종료 후 정상 이용 가능합니다.",
    ],
  },
  {
    id: "n5",
    category: "업데이트",
    priority: "낮음",
    pinned: false,
    title: "LLM 피드백 루프 v2 배포 완료",
    author: "개발팀",
    date: "2026-07-18",
    summary: "RFP 5.3 운영 요건 관련 자동 피드백 생성 속도가 개선되었습니다.",
    content: [
      "LLM 피드백 루프 연동 기능이 v2로 업데이트되었습니다. 평균 응답 생성 시간이 기존 대비 약 40% 단축되었습니다.",
      "또한 피드백 근거로 참조한 RFP 조항이 함께 표시되도록 개선했습니다.",
      "이슈 발견 시 '피드백' 메뉴를 통해 알려주세요.",
    ],
  },
  {
    id: "n6",
    category: "PM 피드백",
    priority: "중간",
    pinned: false,
    title: "RFP V3 데이터셋 검토 코멘트",
    author: "PM 정하늘",
    date: "2026-07-15",
    summary: "개인정보 비식별화 처리 근거를 추가해 주세요.",
    content: [
      "RFP V3 데이터셋 검토를 마쳤습니다. 전반적인 데이터 정합성은 양호합니다.",
      "데이터 요건 중 개인정보 비식별화 처리 방식에 대한 근거 자료가 누락되어 있어, 관련 문서를 첨부해 주시기 바랍니다.",
      "다음 검토는 7월 24일 오전 중 진행 예정입니다.",
    ],
  },
  {
    id: "n7",
    category: "위클리 스크럼",
    priority: "중간",
    pinned: true,
    title: "이번 주 위클리 스크럼 제출 요청",
    author: "PM 정하늘",
    date: "2026-07-27",
    summary: "이번 주 진행 상황을 정리해 금요일까지 제출해 주세요.",
    content: [
      "이번 주 위클리 스크럼을 [산출물 제출] 화면에서 파일로 제출해 주세요.",
      "이번 주 완료한 작업, 다음 주 계획, 막힌 부분을 간단히 정리해 주시면 됩니다.",
      "제출 마감은 금요일 오후 6시입니다.",
    ],
  },
  {
    id: "n8",
    category: "위클리 스크럼",
    priority: "낮음",
    pinned: false,
    title: "지난주 위클리 스크럼 확인했어요",
    author: "PM 정하늘",
    date: "2026-07-20",
    summary: "제출 잘 받았습니다. 다음 주도 같은 형식으로 부탁드려요.",
    content: [
      "지난주 위클리 스크럼 잘 확인했습니다.",
      "진행 상황 정리가 깔끔해서 보기 좋았어요. 다음 주도 같은 형식으로 부탁드립니다.",
    ],
  },
  {
    id: "n9",
    category: "위클리 스크럼",
    priority: "중간",
    pinned: false,
    title: "위클리 스크럼 제출 형식 안내",
    author: "PM 정하늘",
    date: "2026-07-13",
    summary: "이번 주 완료 / 다음 주 계획 / 이슈 3항목으로 정리해 주세요.",
    content: [
      "위클리 스크럼 작성 시 아래 3항목을 포함해 주세요.",
      "1) 이번 주 완료한 작업 2) 다음 주 계획 3) 막힌 부분·이슈",
      "형식이 통일되면 검토가 훨씬 빨라져요. 협조 부탁드립니다.",
    ],
  },
];

const STORAGE_KEY = "aipm.staffNotices";
const CHANGED_EVENT = "aipm:staff-notices-changed";

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

export function getNotices(): Notice[] {
  if (!canUseStorage()) {
    return SEED_NOTICES;
  }

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_NOTICES));
    return SEED_NOTICES;
  }

  try {
    const parsed = JSON.parse(saved) as Notice[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_NOTICES));
      return SEED_NOTICES;
    }
    return parsed;
  } catch (error) {
    console.error("공지 데이터를 읽지 못했습니다.", error);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_NOTICES));
    return SEED_NOTICES;
  }
}

function saveNotices(notices: Notice[]): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notices));
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
}

/** 새 공지를 목록 맨 앞에 추가합니다. */
export function addNotice(notice: Omit<Notice, "id">): void {
  const current = getNotices();
  const newNotice: Notice = {
    ...notice,
    id: `n${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  saveNotices([newNotice, ...current]);
}

/** React 컴포넌트에서 공지 목록을 구독하는 Hook입니다. */
export function useNotices(): Notice[] {
  const [notices, setNotices] = useState<Notice[]>(() => getNotices());

  useEffect(() => {
    const sync = () => setNotices(getNotices());

    window.addEventListener(CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener(CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return notices;
}