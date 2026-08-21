import { useEffect, useState } from "react";

/**
 * 미디어 쿼리 일치 여부를 구독한다.
 *
 * CSS의 반응형 클래스로 충분한 경우에는 이 훅을 쓰지 않는 편이 낫다.
 * "좁아지면 같은 요소를 다른 위치에 렌더링한다"처럼 DOM 구조 자체가
 * 달라져야 할 때만 사용한다. (CSS로 양쪽을 모두 그려두고 숨기면
 * 같은 요소가 두 벌 생겨 id 중복·중복 요청 같은 문제가 생긴다.)
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent) =>
      setMatches(event.matches);

    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}
