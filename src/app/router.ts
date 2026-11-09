// 해시 라우터. 형식: `#/` 랜딩, `#/s/{token}/{tab?}` 학생, `#/t/{tab?}/{sub?}` 교사(sub = 관리 탭 안의 화면).
import { isToken } from '../lib/token';

export type StudentTab = 'home' | 'bulletin' | 'sermon' | 'prayer' | 'me';
export const STUDENT_TABS: readonly StudentTab[] = ['home', 'bulletin', 'sermon', 'prayer', 'me'];

export const DEFAULT_TEACHER_TAB = 'attendance';

export type Route =
  | { kind: 'landing' }
  | { kind: 'student'; token: string; tab: StudentTab }
  | { kind: 'teacher'; tab: string; sub?: string }
  | { kind: 'invalid' };

const isStudentTab = (s: string | undefined): s is StudentTab =>
  s !== undefined && (STUDENT_TABS as readonly string[]).includes(s);

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#/, '').split('/').filter(Boolean);
  const [head, a, b] = parts;
  if (head === 's') {
    if (!isToken(a)) return { kind: 'invalid' };
    return { kind: 'student', token: a, tab: isStudentTab(b) ? b : 'home' };
  }
  if (head === 't') {
    const tab = a ?? DEFAULT_TEACHER_TAB;
    return b ? { kind: 'teacher', tab, sub: b } : { kind: 'teacher', tab };
  }
  return { kind: 'landing' };
}

/** 학생 주소(해시만). 'home'이면 탭을 생략한다. */
export function studentHref(token: string, tab?: StudentTab): string {
  return tab && tab !== 'home' ? `#/s/${token}/${tab}` : `#/s/${token}`;
}

/** 교사 주소(해시만). sub 는 tab 이 있을 때만 붙는다(`#/t/admin/roster`). */
export function teacherHref(tab?: string, sub?: string): string {
  if (!tab) return '#/t';
  return sub ? `#/t/${tab}/${sub}` : `#/t/${tab}`;
}
