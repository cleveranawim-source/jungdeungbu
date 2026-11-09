import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

/**
 * 화면 안 이동(탭 바·"관리 메뉴")을 잠깐 붙잡는 장치. 편집 화면이 저장 안 한 내용이 있을 때 막는 함수를 걸어 두면,
 * 앱 안 메뉴로 나가려 할 때 그 함수가 이동 대신 불린다(편집 화면이 그 자리에서 물어보고, 괜찮다면 go()).
 * 브라우저 창 닫기·뒤로 가기는 붙잡지 않는다(beforeunload 경고 X) — 그때는 편집 화면의 sessionStorage 복구본이 지킨다.
 */
export type LeaveBlocker = (go: () => void) => void;

interface Api {
  set(b: LeaveBlocker | null): void;
  /** 막혀 있으면 막는 함수를 부르고 true. 아니면 false(부른 쪽이 그냥 이동) */
  intercept(go: () => void): boolean;
}

const Ctx = createContext<Api | null>(null);

export function LeaveGuardProvider({ children }: { children: ReactNode }) {
  const blocker = useRef<LeaveBlocker | null>(null);
  const api = useMemo<Api>(() => ({
    set(b) { blocker.current = b; },
    intercept(go) {
      if (!blocker.current) return false;
      blocker.current(go);
      return true;
    },
  }), []);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

/** blocker 가 있는 동안(저장 안 한 내용이 있는 동안) 앱 안 이동을 붙잡는다. */
export function useLeaveGuard(blocker: LeaveBlocker | null): void {
  const api = useContext(Ctx);
  useEffect(() => {
    if (!api || !blocker) return;
    api.set(blocker);
    return () => api.set(null);
  }, [api, blocker]);
}

/** 해시 주소로 옮겨 가되, 붙잡혀 있으면 편집 화면에 먼저 묻는다. */
export function useGuardedNavigate(): (href: string) => void {
  const api = useContext(Ctx);
  return useCallback((href: string) => {
    const go = () => { location.hash = href; };
    if (!api?.intercept(go)) go();
  }, [api]);
}

/** <a href> 의 onClick 에: 붙잡혀 있으면 기본 이동을 막고 편집 화면에 묻는다. */
export function useGuardedLinkClick(): (e: { preventDefault(): void; currentTarget: HTMLAnchorElement }) => void {
  const api = useContext(Ctx);
  return useCallback((e) => {
    const href = e.currentTarget.getAttribute('href');
    if (!api || href === null) return;
    if (api.intercept(() => { location.hash = href; })) e.preventDefault();
  }, [api]);
}
