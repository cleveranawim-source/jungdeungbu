import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLeaveGuard, type LeaveBlocker } from '../app/leaveGuard';
import { DRAFT_STORE_PREFIX } from '../lib/deviceData';
import { afterSave, openDraft, type DraftState } from './draftState';

// 편집 화면(주보·설교) 공통: 날짜마다 폼 하나. 저장된 값(base)과 다르면 dirty.
// dirty 인 동안 폼을 sessionStorage 에 그대로 적어 두고(앱이 꺼져도 이 탭에서 다시 열면 복구),
// 날짜를 바꾸거나 앱 안 메뉴로 나가려 하면 pending 으로 붙잡아 화면이 그 자리에서 묻게 한다.

// 선생님이 로그아웃하면 lib/deviceData 가 이 앞부분의 키를 모두 지운다
const STORE = DRAFT_STORE_PREFIX;

/** 모양은 아직 모른다(부르는 쪽이 isValid 로 따진다) */
function readStored(key: string): unknown {
  try {
    const raw = sessionStorage.getItem(STORE + key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null; // 개인 정보 보호 모드·막힌 저장소·깨진 값
  }
}
function writeStored(key: string, v: unknown, savedAt = Date.now()): void {
  try { sessionStorage.setItem(STORE + key, JSON.stringify({ draftVersion: 1, savedAt, value: v })); } catch { /* 저장소가 막혀도 편집은 계속 */ }
}
function clearStored(key: string): void {
  try { sessionStorage.removeItem(STORE + key); } catch { /* 위와 같음 */ }
}

export type Pending = { kind: 'date'; date: string } | { kind: 'nav'; go(): void };


export interface EditorDraft<T> {
  /** 지금 날짜의 폼이 준비됐으면 그 값, 아니면 undefined(불러오는 중) */
  value: T | undefined;
  set(update: (prev: T) => T): void;
  dirty: boolean;
  /** 열 때 sessionStorage 에서 저장 안 된 내용을 되살렸는지 */
  recovered: boolean;
  serverNewer: boolean;
  /** 불러온 저장값으로 폼을 연다(복구본이 있으면 그걸로). 같은 날짜로 이미 열려 있으면 아무것도 안 한다 */
  open(base: T, serverSavedAt?: number): void;
  /**
   * 저장 성공: sent(저장을 누른 순간의 폼으로 만든 값)가 새 저장값. 그 사이 더 고친 내용은 그대로 남아
   * 계속 "저장 안 한 내용"(복구본도 남음). 열려 있던 날짜 이동 확인은 닫는다.
   */
  saved(sent: T): void;
  /** 복구본 버리고 저장된 값으로 되돌리기 */
  revert(): void;
  /** 서버 초안을 버린 뒤 게시본으로 완전히 돌아갈 때만 사용해요. */
  replace(base: T): void;
  /** 광고 관리에 다녀오기 전 이 기기의 복구본을 즉시 남겨요. */
  keepLocal(): void;
  /** 날짜 바꾸기(저장 안 한 내용이 있으면 pending 으로 붙잡는다) */
  requestDate(date: string): void;
  pending: Pending | null;
  /** 묻는 중 "계속 쓰기" */
  stay(): void;
  /** 묻는 중 "저장하지 않고 이동": 복구본을 지우고 이동 */
  leave(): void;
}

/**
 * @param prefix sessionStorage 키 앞부분('bulletin' | 'sermon')
 * @param date 지금 날짜, setDate 날짜 바꾸기(부르는 쪽 상태)
 * @param comparable 비교할 모양(줄 key 같은 화면용 값을 뺀 것)
 * @param isValid sessionStorage 복구본의 모양 검사(깨졌으면 조용히 버린다)
 */
export function useEditorDraft<T>(
  prefix: string,
  date: string,
  setDate: (d: string) => void,
  comparable: (v: T) => unknown,
  isValid: (x: unknown) => x is T,
): EditorDraft<T> {
  const key = `${prefix}:${date}`;
  const [state, setState] = useState<DraftState<T> | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const ready = state !== null && state.key === key;
  const same = useCallback((a: T, b: T) => JSON.stringify(comparable(a)) === JSON.stringify(comparable(b)), [comparable]);
  const dirty = ready && !same(state.value, state.base);

  // 저장 안 한 내용은 바뀔 때마다 적어 두고, 저장값과 같아지면 지운다
  useEffect(() => {
    if (!state || state.key !== key) return;
    if (same(state.value, state.base)) clearStored(key);
    else writeStored(key, state.value, state.localSavedAt);
  }, [state, key, same]);

  const open = useCallback((base: T, serverSavedAt = 0) => {
    setState((prev) => (prev && prev.key === key ? prev : openDraft(prev, key, base, readStored(key), same, isValid, serverSavedAt)));
  }, [key, same, isValid]);

  const set = useCallback((update: (prev: T) => T) => {
    setState((prev) => (prev && prev.key === key ? { ...prev, value: update(prev.value), localSavedAt: Date.now() } : prev));
  }, [key]);

  const saved = useCallback((sent: T) => {
    // 복구본은 위 효과가 정리한다: 더 고친 것이 없으면 지우고, 있으면 그 내용으로 다시 적는다
    setState((prev) => afterSave(prev, key, sent, same));
    setPending(null);
  }, [key, same]);

  const revert = useCallback(() => {
    clearStored(key);
    setState((prev) => (prev && prev.key === key ? { ...prev, value: prev.base, recovered: false } : prev));
  }, [key]);

  const replace = useCallback((base: T) => {
    clearStored(key);
    setState({ key, base, value: base, recovered: false });
    setPending(null);
  }, [key]);
  const keepLocal = useCallback(() => {
    if (state?.key === key && !same(state.value, state.base)) writeStored(key, state.value, state.localSavedAt);
  }, [state, key, same]);

  const requestDate = useCallback((d: string) => {
    if (d === date) return;
    if (dirty) setPending({ kind: 'date', date: d });
    else { setPending(null); setDate(d); }
  }, [date, dirty, setDate]);

  const stay = useCallback(() => setPending(null), []);
  const leave = useCallback(() => {
    if (!pending) return;
    clearStored(key);
    setPending(null);
    if (pending.kind === 'date') {
      setState(null);
      setDate(pending.date);
    } else {
      pending.go();
    }
  }, [pending, key, setDate]);

  // 앱 안 메뉴 이동 붙잡기(저장 안 한 내용이 있을 때만)
  const blocker = useMemo<LeaveBlocker | null>(
    () => (dirty ? (go) => setPending({ kind: 'nav', go }) : null),
    [dirty],
  );
  useLeaveGuard(blocker);

  return {
    value: ready ? state.value : undefined,
    set,
    dirty,
    recovered: ready && state.recovered,
    serverNewer: ready && Boolean(state.serverNewer),
    open,
    saved,
    revert,
    replace,
    keepLocal,
    requestDate,
    pending,
    stay,
    leave,
  };
}
