import { useState } from 'react';
import { describeError, useToast } from '../app/Toast';
import { loadBulletinExtras } from '../data/bulletinExtras';
import { formatBirthdayLines, parseBirthdayLines, parseLines, parseTally } from '../lib/bulletin';
import { db } from '../lib/firebase';
import type { AttendanceSummary, BulletinMembers, Tally } from '../types';
import { Button } from '../ui/Button';
import { TextArea } from '../ui/Field';
import { Icon } from '../ui/icons';
import { hasStrings, isObj } from './editorUtils';
import ed from './editor.module.css';
import s from './BulletinEditor.module.css';

// ---------- 폼 모양(숫자도 입력 그대로 글자로 둔다 — 틀린 값을 조용히 0으로 바꾸지 않게) ----------

export interface AttClassForm { classId: string; name: string; present: string; total: string }
export interface AttForm { sunday: string; classes: AttClassForm[]; teachersPresent: string; teachersTotal: string }
export interface ExtrasForm {
  att: AttForm | null;
  /** 한 줄에 한 명 */
  newFriends: string;
  /** 한 줄에 "mm-dd 이름" */
  birthdays: string;
}
/** 저장을 막는 칸: 틀린 반(classId), 교사 칸, 생일 칸 */
export interface ExtrasErrors { classes: string[]; teachers: boolean; birthdays: boolean }

export const NUMBER_ERROR = '0 이상의 숫자로, 출석은 전체보다 많을 수 없어요';
export const BIRTHDAY_ERROR = '한 줄에 "11-20 이름"처럼 적어 주세요';

// ---------- 폼 ↔ 저장값 (출석·새 친구·생일) ----------

/** 불러온(또는 저장된) 출석 요약 → 폼. 교사 칸은 keep 이 있으면 그 입력을 그대로 둔다. */
export function attToForm(a: AttendanceSummary, keep?: AttForm | null): AttForm {
  return {
    sunday: a.sunday,
    classes: a.classes.map((c) => ({ classId: c.classId, name: c.name, present: String(c.present), total: String(c.total) })),
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
 */
export function readExtras(f: ExtrasForm): ExtrasRead {
  const errors: ExtrasErrors = { classes: [], teachers: false, birthdays: false };
  let attendance: AttendanceSummary | null = null;
  let attCompare: unknown = null;
  if (f.att) {
    const att = f.att;
    const classes = att.classes.map((c) => ({ c, t: parseTally(c.present, c.total) }));
    for (const { c, t } of classes) if (t === null || t === 'invalid') errors.classes.push(c.classId);
    const teachers = parseTally(att.teachersPresent, att.teachersTotal);
    errors.teachers = teachers === 'invalid';
    const ok = (t: Tally | null | 'invalid'): t is Tally => t !== null && t !== 'invalid';
    const asIs = (p: string, t: string, parsed: Tally | null | 'invalid') => (parsed === 'invalid' ? [p.trim(), t.trim()] : parsed);
    attCompare = {
      sunday: att.sunday,
      classes: classes.map(({ c, t }) => [c.classId, c.name, asIs(c.present, c.total, t)]),
      teachers: asIs(att.teachersPresent, att.teachersTotal, teachers),
    };
    const counted = classes.flatMap(({ c, t }) => (ok(t) ? [{ classId: c.classId, name: c.name, ...t }] : []));
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

/** sessionStorage 복구본의 출석 칸 모양 검사 */
export const isAttForm = (x: unknown): x is AttForm =>
  hasStrings(x, ['sunday', 'teachersPresent', 'teachersTotal'])
  && isObj(x) && Array.isArray(x.classes)
  && x.classes.every((c) => hasStrings(c, ['classId', 'name', 'present', 'total']));

// ---------- 화면 ----------

/** "2026-11-08" → "11.8" (주보 보는 화면과 같은 꼴) */
function dotDate(dateId: string): string {
  const [m, d] = dateId.split('-').slice(-2).map(Number);
  return `${m}.${d}`;
}

/**
 * [지난 주 출석·새 친구·생일] 카드 내용. 값은 부르는 쪽 폼이 가진다(제어 컴포넌트).
 * "불러오기"는 출석 기록·학생 명단에서 채우기만 하고, 그 뒤 손으로 고친 값이 저장된다.
 */
export function BulletinExtrasEditor({ date, value, onChange, errors }: {
  /** 주보 날짜 */
  date: string;
  value: ExtrasForm;
  /** 바꿀 칸만 돌려준다. 불러오기처럼 늦게 끝나는 일도 그때의 폼을 기준으로 바꾸게 함수로 받는다 */
  onChange(update: (prev: ExtrasForm) => Partial<ExtrasForm>): void;
  /** 저장을 눌러 막혔을 때만 */
  errors: ExtrasErrors | null;
}) {
  const { show } = useToast();
  const [loading, setLoading] = useState(false);
  const att = value.att;

  async function load() {
    setLoading(true);
    try {
      const r = await loadBulletinExtras(db, date);
      const birthdays = formatBirthdayLines(r.members.birthdays);
      const found = r.attendance;
      if (found) {
        onChange((prev) => ({ att: attToForm(found, prev.att), newFriends: r.members.newFriends.join('\n'), birthdays }));
        show(`${dotDate(found.sunday)} 주일 출석을 불러왔어요`);
      } else {
        onChange(() => ({ birthdays }));
        show('최근 8주 안에 출석 기록이 없어요');
      }
    } catch (e) {
      show(describeError(e), 'error');
    } finally {
      setLoading(false);
    }
  }

  const setAtt = (patch: Partial<AttForm>) => onChange((prev) => (prev.att ? { att: { ...prev.att, ...patch } } : {}));
  const setClass = (i: number, patch: Partial<AttClassForm>) =>
    onChange((prev) => (prev.att
      ? { att: { ...prev.att, classes: prev.att.classes.map((c, j) => (j === i ? { ...c, ...patch } : c)) } }
      : {}));

  return (
    <div className={s.fields}>
      <div className={s.loadRow}>
        <Button variant="secondary" size="sm" icon={<Icon name="download" size={18} />} busy={loading} onClick={load}>
          출석·새 친구·생일 불러오기
        </Button>
        <p className={s.hint}>
          출석 기록과 학생 명단에서 채워요. 불러온 뒤 고친 그대로 주보에 실려요.
        </p>
      </div>

      {att && (
        <div className={s.att}>
          <p className={s.sunday}>
            <span className={ed.mini}>센 주일</span>
            <span>{dotDate(att.sunday)} 주일</span>
          </p>
          <ul className={s.tallies}>
            {att.classes.map((c, i) => (
              <TallyRow key={c.classId} id={`att-${c.classId}`} name={c.name}
                present={c.present} total={c.total} error={errors?.classes.includes(c.classId) ?? false}
                onPresent={(v) => setClass(i, { present: v })} onTotal={(v) => setClass(i, { total: v })} />
            ))}
            <TallyRow id="att-teachers" name="교사" present={att.teachersPresent} total={att.teachersTotal}
              error={errors?.teachers ?? false}
              onPresent={(v) => setAtt({ teachersPresent: v })} onTotal={(v) => setAtt({ teachersTotal: v })} />
          </ul>
          <p className={s.hint}>교사 칸은 비워 두면 주보에 싣지 않아요.</p>
          <Button variant="ghost" size="sm" className={ed.add} icon={<Icon name="trash" size={18} />}
            onClick={() => onChange(() => ({ att: null }))}>
            출석 지우기
          </Button>
        </div>
      )}

      <TextArea label="새 친구" rows={3} value={value.newFriends}
        hint="한 줄에 한 명. 학생 링크를 받은 사람만 볼 수 있어요"
        onChange={(e) => { const v = e.target.value; onChange(() => ({ newFriends: v })); }} />
      <TextArea label="이번 달 생일" rows={4} value={value.birthdays}
        hint='한 줄에 "11-20 이름". 학생 링크를 받은 사람만 볼 수 있어요'
        error={errors?.birthdays ? BIRTHDAY_ERROR : null}
        onChange={(e) => { const v = e.target.value; onChange(() => ({ birthdays: v })); }} />
    </div>
  );
}

/** 한 줄: 이름 | 출석 | 전체, 틀리면 아래에 안내(두 칸 모두 그 안내와 이어진다) */
function TallyRow({ id, name, present, total, error, onPresent, onTotal }: {
  id: string; name: string; present: string; total: string; error: boolean;
  onPresent(v: string): void; onTotal(v: string): void;
}) {
  const msg = `${id}-msg`;
  const field = (part: 'present' | 'total', label: string, v: string, set: (v: string) => void) => (
    <div className={s.cell}>
      <label className={ed.mini} htmlFor={`${id}-${part}`}><span className="sr-only">{name} </span>{label}</label>
      <input id={`${id}-${part}`} className={`${ed.input} ${s.num}`} inputMode="numeric" autoComplete="off" maxLength={4}
        value={v} aria-invalid={error || undefined} aria-describedby={error ? msg : undefined}
        onChange={(e) => set(e.target.value)} />
    </div>
  );
  return (
    <li className={s.tally}>
      <span className={s.tallyName}>{name}</span>
      {field('present', '출석', present, onPresent)}
      {field('total', '전체', total, onTotal)}
      {error && (
        <span className={s.error} id={msg} role="alert">
          <Icon name="alert" size={16} />
          {NUMBER_ERROR}
        </span>
      )}
    </li>
  );
}
