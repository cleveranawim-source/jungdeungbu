import { useCallback, useEffect, useState } from 'react';
import { useLoader } from '../app/useLoader';
import { listTeachers } from '../data/teachers';
import { db } from '../lib/firebase';

export { hasStrings, isObj, isRows, newKey } from './formShape';

/** "n분 전" 이 흘러가게 30초마다 바뀌는 지금 시각 */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** 저장한 사람 uid → 이름. 선생님 목록을 못 읽으면 "관리자" */
export function useSavedBy(): (uid: string) => string {
  const { data } = useLoader(useCallback(() => listTeachers(db), []));
  return useCallback((uid: string) => {
    const t = data?.find((x) => x.id === uid);
    return t?.name || t?.email || '관리자';
  }, [data]);
}
