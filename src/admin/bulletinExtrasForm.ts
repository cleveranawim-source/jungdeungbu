// 주보 작성의 [지난 주 출석·새 친구·생일] 폼 ↔ 저장값. 순수 함수라 React·Firebase 없이 시험한다.
import { formatBirthdayLines, parseBirthdayLines, parseLines, parseTally } from '../lib/bulletin';
import type { AttendanceSummary, BulletinMembers, Tally } from '../types';
import { hasStrings, isObj, newKey } from './formShape';

// ---------- 폼 모양(숫자도 입력 그대로 글자로 둔다 — 틀린 값을 조용히 0으로 바꾸지 않게) ----------

/**
 * 반 한 줄. k 는 화면용 key(저장하지 않는다). 반 문서 ID는 폼에도 두지 않는다 —
 * 저장값은 누구나 읽는 공개 주보이고, 반 ID는 그 반 기도 제목을 여는 열쇠다.
 */
export interface AttClassForm { k: string; name: string; present: string; total: string }
export interface AttForm { sunday: string; classes: AttClassForm[]; teachersPresent: string; teachersTotal: string }
export interface ExtrasForm {
  att: AttForm | null;
  /** 한 줄에 한 명 */
  newFriends: string;
  /** 한 줄에 "mm-dd 이름" */
  birthdays: string;
}
/** 저장을 막는 칸: 틀린 반 줄(폼 key), 교사 칸, 생일 칸 */
export interface ExtrasErrors { classes: string[]; teachers: boolean; birthdays: boolean }

export const NUMBER_ERROR = '0 이상의 숫자로, 출석은 전체보다 많을 수 없어요';
export const BIRTHDAY_ERROR = '한 줄에 "11-20 이름"처럼 적어 주세요';

/** 불러온(또는 저장된) 출석 요약 → 폼. 교사 칸은 keep 이 있으면 그 입력을 그대로 둔다. */
export function attToForm(a: AttendanceSummary, keep?: AttForm | null): AttForm {
  return {
    sunday: a.sunday,
    classes: a.classes.map((c) => ({ k: newKey(), name: c.name, present: String(c.present), total: String(c.total) })),
    teachersPresent: keep ? keep.teachersPresent : a.teachers ? String(a.teachers.present) : '',
    teachersTotal: keep ? keep.teachersTotal : a.teachers ? String(a.teachers.total) : '',
  };
}

export function extrasFromSaved(attendance: AttendanceSummary | null, members: BulletinMembers | null): ExtrasForm {
  return {
    att: attendance ? attToForm(attendance) : null,
    newFriends: (members?.newFriends ?? []).join('\n'),
    birthdays: formatBirthdayLines(members?.birthdays ?? []),
  };
}

export interface ExtrasRead {
  attendance: AttendanceSummary | null;
  members: BulletinMembers;
  /** 고칠 칸이 있으면(저장 막기), 없으면 null */
  errors: ExtrasErrors | null;
  /** 저장 안 한 내용 비교용: 맞는 칸은 저장될 값, 틀린 칸은 입력 그대로 */
  compare: unknown;
}

/**
 * 폼 → 저장할 값. 반 칸은 둘 다 비어도 오류(0/0 으로 저장하지 않는다 — 빼려면 "출석 지우기"),
 * 교사 칸은 둘 다 비면 뺀다. 학생 합계는 반별 값을 더해 다시 낸다.
 * 반 줄이 하나도 없으면 출석을 싣지 않는다(학생 0/0 금지). 반 줄은 이름·인원만 담는다.
 */
export function readExtras(f: ExtrasForm): ExtrasRead {
  const errors: ExtrasErrors = { classes: [], teachers: false, birthdays: false };
  let attendance: AttendanceSummary | null = null;
  let attCompare: unknown = null;
  if (f.att && f.att.classes.length > 0) {
    const att = f.att;
    const classes = att.classes.map((c) => ({ c, t: parseTally(c.present, c.total) }));
    for (const { c, t } of classes) if (t === null || t === 'invalid') errors.classes.push(c.k);
    const teachers = parseTally(att.teachersPresent, att.teachersTotal);
    errors.teachers = teachers === 'invalid';
    const ok = (t: Tally | null | 'invalid'): t is Tally => t !== null && t !== 'invalid';
    const asIs = (p: string, t: string, parsed: Tally | null | 'invalid') => (parsed === 'invalid' ? [p.trim(), t.trim()] : parsed);
    attCompare = {
      sunday: att.sunday,
      classes: classes.map(({ c, t }) => [c.name, asIs(c.present, c.total, t)]),
      teachers: asIs(att.teachersPresent, att.teachersTotal, teachers),
    };
    const counted = classes.flatMap(({ c, t }) => (ok(t) ? [{ name: c.name, present: t.present, total: t.total }] : []));
    attendance = {
      sunday: att.sunday,
      classes: counted,
      students: {
        present: counted.reduce((n, c) => n + c.present, 0),
        total: counted.reduce((n, c) => n + c.total, 0),
      },
      teachers: ok(teachers) ? teachers : null,
    };
  }
  const birthdays = parseBirthdayLines(f.birthdays);
  errors.birthdays = birthdays === 'invalid';
  const newFriends = parseLines(f.newFriends);
  const bad = errors.classes.length > 0 || errors.teachers || errors.birthdays;
  return {
    attendance,
    members: { newFriends, birthdays: birthdays === 'invalid' ? [] : birthdays },
    errors: bad ? errors : null,
    compare: { att: attCompare, newFriends, birthdays: birthdays === 'invalid' ? parseLines(f.birthdays) : birthdays },
  };
}

/** sessionStorage 복구본의 출석 칸 모양 검사(반 줄에 폼 key 가 없는 옛 모양은 버린다) */
export const isAttForm = (x: unknown): x is AttForm =>
  hasStrings(x, ['sunday', 'teachersPresent', 'teachersTotal'])
  && isObj(x) && Array.isArray(x.classes)
  && x.classes.every((c) => hasStrings(c, ['k', 'name', 'present', 'total']));
