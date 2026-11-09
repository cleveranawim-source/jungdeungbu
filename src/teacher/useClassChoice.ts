// 교사가 고를 수 있는 반(담당 반, 관리자는 전체)과 마지막으로 고른 반(기기마다 기억).
import { useCallback, useState } from 'react';
import { useLoader, type Loaded } from '../app/useLoader';
import { listClasses } from '../data/classes';
import { db } from '../lib/firebase';
import type { ClassDoc, Teacher, WithId } from '../types';

export type Cls = WithId<ClassDoc>;

const KEY = 'jungdeungbu.teacher.classId';

function readStored(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
function writeStored(id: string): void {
  try { localStorage.setItem(KEY, id); } catch { /* 저장 막힌 브라우저: 이번 화면에서만 기억 */ }
}

/** 반 목록(order 순). 관리자는 전체, 교사는 classIds 에 있는 반만(지워진 반 ID 는 빠진다). */
export function useMyClasses(teacher: Teacher): Loaded<Cls[]> {
  const isAdmin = teacher.role === 'admin';
  const ids = teacher.classIds.join('\n');
  return useLoader(useCallback(async () => {
    const all = await listClasses(db);
    const mine = new Set(ids.split('\n'));
    return isAdmin ? all : all.filter((c) => mine.has(c.id));
  }, [isAdmin, ids]));
}

/** 고른 반 ID. 기억한 반이 목록에 없으면 첫 반. 목록이 비면 null. */
export function useClassChoice(classes: Cls[] | undefined): [string | null, (id: string) => void] {
  const [picked, setPicked] = useState<string | null>(readStored);
  const choose = useCallback((id: string) => { setPicked(id); writeStored(id); }, []);
  if (!classes || classes.length === 0) return [null, choose];
  const current = classes.some((c) => c.id === picked) ? picked! : classes[0].id;
  return [current, choose];
}
