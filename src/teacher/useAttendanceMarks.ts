// 출석 버튼의 낙관적 토글. 누르면 화면이 바로 바뀌고(오프라인에서도), 저장은 뒤에서 한다.
import { useCallback, useRef, useState } from 'react';
import { describeError, useToast } from '../app/Toast';
import { setAttendance } from '../data/attendance';
import { db } from '../lib/firebase';

type Key = string; // `${dateId}/${token}`
const keyOf = (dateId: string, token: string): Key => `${dateId}/${token}`;

export interface StreakInfo { streak: number; lastPresent: string | null }

export interface AttendanceMarks {
  /** 화면에 보일 출석 값: 누른 값이 있으면 그것, 없으면 불러온 값 */
  present(dateId: string, token: string, loaded: boolean): boolean;
  /** 저장이 서버에 닿기를 기다리는 중 */
  pending(dateId: string, token: string): boolean;
  /** 저장 뒤 다시 계산된 연속 출석(오프라인 저장이면 없음 → 원래 값을 쓴다) */
  streak(token: string): StreakInfo | undefined;
  toggle(dateId: string, token: string, shown: boolean): void;
}

/**
 * 학생마다 저장은 한 번에 하나만 보낸다. 저장 중에 또 누르면 화면은 바로 바뀌고,
 * 앞 저장이 끝난 뒤 마지막으로 누른 값을 한 번 더 저장한다(중간 값은 건너뜀).
 * 오프라인이면 setAttendance 가 서버에 닿을 때까지 끝나지 않으므로, 잘못 누른 것을 바로 되돌릴 수 있게 버리지 않고 이렇게 모은다.
 * 저장이 거절되면(permission-denied 등) 마지막으로 서버가 받은 값으로 되돌리고 오류 토스트.
 */
export function useAttendanceMarks(uid: string): AttendanceMarks {
  const { show } = useToast();
  const [shownMap, setShownMap] = useState<ReadonlyMap<Key, boolean>>(new Map());
  const [pendingSet, setPendingSet] = useState<ReadonlySet<Key>>(new Set());
  const [streaks, setStreaks] = useState<ReadonlyMap<string, StreakInfo>>(new Map());
  const confirmed = useRef(new Map<Key, boolean>()); // 서버가 받았다고 아는 값
  const desired = useRef(new Map<Key, boolean>());   // 마지막으로 누른 값
  const inflight = useRef(new Set<Key>());

  const setShown = (key: Key, v: boolean) => setShownMap((m) => new Map(m).set(key, v));
  const setPending = (key: Key, on: boolean) => setPendingSet((p) => {
    const n = new Set(p);
    if (on) n.add(key); else n.delete(key);
    return n;
  });

  const write = useCallback((dateId: string, token: string) => {
    const key = keyOf(dateId, token);
    const want = desired.current.get(key)!;
    inflight.current.add(key);
    setPending(key, true);
    setAttendance(db, uid, token, dateId, want).then(
      (res) => {
        confirmed.current.set(key, want);
        if (res) setStreaks((m) => new Map(m).set(token, res));
        if (desired.current.get(key) !== want) { write(dateId, token); return; } // 저장 중에 또 누름
        inflight.current.delete(key);
        setPending(key, false);
      },
      (e: unknown) => {
        const back = confirmed.current.get(key)!;
        desired.current.set(key, back);
        setShown(key, back);
        inflight.current.delete(key);
        setPending(key, false);
        show(describeError(e), 'error');
      },
    );
  }, [uid, show]);

  const toggle = useCallback((dateId: string, token: string, shown: boolean) => {
    const key = keyOf(dateId, token);
    if (!confirmed.current.has(key)) confirmed.current.set(key, shown);
    desired.current.set(key, !shown);
    setShown(key, !shown);
    if (!inflight.current.has(key)) write(dateId, token);
  }, [write]);

  return {
    present: (dateId, token, loaded) => shownMap.get(keyOf(dateId, token)) ?? loaded,
    pending: (dateId, token) => pendingSet.has(keyOf(dateId, token)),
    streak: (token) => streaks.get(token),
    toggle,
  };
}
