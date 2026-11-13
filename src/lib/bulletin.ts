// 종이 주보와 같은 주보를 만드는 순수 계산(호수·순서표 채움·출석 요약·생일·입력 파싱). 타입만 import 한다.
import type {
  AttendanceDoc, AttendanceSummary, Birthday, ClassDoc, OrderItem, Student, Tally, WithId,
} from '../types';

/** 호수의 마지막 숫자 묶음을 1 올린다(자릿수 유지: 09→10). 숫자가 없으면 ''. */
export function nextIssue(prev: string): string {
  const matches = [...prev.matchAll(/\d+/g)];
  const last = matches[matches.length - 1];
  if (!last) return '';
  const next = String(Number(last[0]) + 1).padStart(last[0].length, '0');
  const at = last.index ?? 0;
  return prev.slice(0, at) + next + prev.slice(at + last[0].length);
}

export interface OrderRowView extends OrderItem { from?: 'scripture' | 'sermon' }

const squash = (s: string) => s.replace(/\s+/g, '');

/** 순서표를 보여줄 줄로 바꾼다. 비어 있는 성경봉독·설교 줄(첫 줄만)은 본문·설교 제목으로 채우고, 완전히 빈 줄은 뺀다. */
export function displayOrder(order: OrderItem[], scripture: string, sermonTitle: string):
  { rows: OrderRowView[]; showsScripture: boolean; showsSermon: boolean } {
  let showsScripture = false;
  let showsSermon = false;
  const rows: OrderRowView[] = [];
  for (const item of order) {
    if (!item.type && !item.title && !item.detail) continue;
    const name = squash(item.type);
    if (!item.title && name === '성경봉독' && !showsScripture && scripture.trim()) {
      showsScripture = true;
      rows.push({ ...item, title: scripture, from: 'scripture' });
    } else if (!item.title && name === '설교' && !showsSermon && sermonTitle.trim()) {
      showsSermon = true;
      rows.push({ ...item, title: sermonTitle, from: 'sermon' });
    } else {
      rows.push({ ...item });
    }
  }
  return { rows, showsScripture, showsSermon };
}

/**
 * 활성 학생 기준 반별·전체 출석 집계. 기록이 하나도 없으면 null. 교사 칸은 손으로 적으므로 null.
 * 반 줄은 이름·인원만(공개 주보로 가는 값이라 반 ID를 남기지 않는다).
 */
export function summarizeAttendance(
  sunday: string,
  students: WithId<Student>[],
  classes: WithId<ClassDoc>[],
  present: Map<string, boolean>,
): AttendanceSummary | null {
  const active = students.filter((s) => s.active);
  if (!active.some((s) => present.has(s.id))) return null;
  const counts: AttendanceSummary['classes'] = [];
  for (const c of [...classes].sort((a, b) => a.order - b.order)) {
    const mine = active.filter((s) => s.classId === c.id);
    if (mine.length === 0) continue;
    counts.push({ name: c.name, present: mine.filter((s) => present.get(s.id) === true).length, total: mine.length });
  }
  return {
    sunday,
    classes: counts,
    students: {
      present: active.filter((s) => present.get(s.id) === true).length,
      total: active.length,
    },
    teachers: null,
  };
}

/** 주보 날짜(yyyy-mm-dd)와 같은 달에 생일인 학생을 날짜순 → 이름순으로. */
export function birthdaysInMonth(students: WithId<Student>[], dateId: string): Birthday[] {
  const month = dateId.slice(5, 7);
  return students
    .filter((s) => s.birthday && s.birthday.slice(0, 2) === month)
    .map((s) => ({ name: s.name, date: s.birthday as string }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, 'ko'));
}

/** 그 주일에 출석했고 그 전 출석이 하나도 없을 때만 true. */
export function isFirstAttendance(records: Pick<AttendanceDoc, 'date' | 'present'>[], sunday: string): boolean {
  if (!records.some((r) => r.date === sunday && r.present)) return false;
  return !records.some((r) => r.date < sunday && r.present);
}

/** 출석/전체 입력. 둘 다 비면 null, 0 이상 정수이고 출석<=전체가 아니면 'invalid'. */
export function parseTally(present: string, total: string): Tally | null | 'invalid' {
  const p = present.trim();
  const t = total.trim();
  if (!p && !t) return null;
  if (!/^\d+$/.test(p) || !/^\d+$/.test(t)) return 'invalid';
  const out = { present: Number(p), total: Number(t) };
  return out.present <= out.total ? out : 'invalid';
}

/** 줄마다 앞뒤 공백을 정리하고 빈 줄은 뺀다. */
export function parseLines(text: string): string[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

/** "mm-dd 이름" 줄 목록. 한 줄이라도 어긋나면 'invalid'. */
export function parseBirthdayLines(text: string): Birthday[] | 'invalid' {
  const out: Birthday[] = [];
  for (const line of parseLines(text)) {
    const m = /^(\d{2})-(\d{2})\s+(.+)$/.exec(line);
    if (!m) return 'invalid';
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return 'invalid';
    out.push({ name: m[3].trim(), date: `${m[1]}-${m[2]}` });
  }
  return out;
}

export function formatBirthdayLines(list: Birthday[]): string {
  return list.map((b) => `${b.date} ${b.name}`).join('\n');
}

/** http(s) 주소만 링크로 쓴다. 그 밖(javascript: 등)은 null. */
export function safeHttpUrl(url: string): string | null {
  const u = url.trim();
  return /^https?:\/\/\S+$/i.test(u) ? u : null;
}

/** 전화번호에서 숫자와 맨 앞 +만 남긴 tel: 링크. 숫자가 없으면 null. */
export function telHref(phone: string): string | null {
  const t = phone.trim();
  const digits = t.replace(/\D/g, '');
  if (!digits) return null;
  return `tel:${t.startsWith('+') ? '+' : ''}${digits}`;
}
