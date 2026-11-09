import { useCallback, useEffect, useState } from 'react';
import { useLoader } from '../app/useLoader';
import { listTeachers } from '../data/teachers';
import { db } from '../lib/firebase';

/** 화면용 줄 key(움직여도 입력칸이 따라가게). sessionStorage 에서 되살린 줄과 겹치지 않게 무작위 */
export const newKey = (): string => Math.random().toString(36).slice(2, 10);

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
