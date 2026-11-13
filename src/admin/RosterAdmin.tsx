import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { teacherHref } from '../app/router';
import { describeError, useToast } from '../app/Toast';
import { useLoader } from '../app/useLoader';
import { listClasses } from '../data/classes';
import { bulkCreateStudents, createStudent, deactivateStudent, listStudents, reissueToken, updateStudent } from '../data/students';
import { db } from '../lib/firebase';
import { normalizeBirthday, parseRoster } from '../lib/roster';
import type { ClassDoc, Student, WithId } from '../types';
import { Button, LinkButton } from '../ui/Button';
import { Card } from '../ui/Card';
import { ChoiceChips } from '../ui/ChoiceChips';
import { ConfirmAction } from '../ui/ConfirmAction';
import { EmptyState } from '../ui/EmptyState';
import { Field, Select, TextArea } from '../ui/Field';
import { Icon } from '../ui/icons';
import { List, ListRow } from '../ui/List';
import { LoadError } from '../ui/LoadError';
import { Loading } from '../ui/Loading';
import { ShareLink } from '../ui/ShareLink';
import s from './RosterAdmin.module.css';

type Cls = WithId<ClassDoc>;
type Stu = WithId<Student>;

const ALL = 'all';

async function loadAll() {
  const [classes, students] = await Promise.all([listClasses(db), listStudents(db)]);
  return { classes, students };
}

/** '03-05' → '3월 5일' */
function birthdayLabel(b: string): string {
  const [m, d] = b.split('-').map(Number);
  return `${m}월 ${d}일`;
}

const NEWCOMER_HINT = '처음 출석한 주의 주보에 새 친구로 올라가요';

/** 새 친구 체크칸(추가·고치기 공통): 네이티브 체크 + 글자까지 눌리는 줄 + 힌트 */
function NewcomerCheck({ checked, onChange }: { checked: boolean; onChange(v: boolean): void }) {
  const hintId = useId();
  return (
    <div className={s.check}>
      <label className={s.checkLabel}>
        <input type="checkbox" checked={checked} aria-describedby={hintId} onChange={(e) => onChange(e.target.checked)} />
        <span>새 친구</span>
      </label>
      <span className={s.checkHint} id={hintId}>{NEWCOMER_HINT}</span>
    </div>
  );
}

const rowDomId = (token: string) => `student-${token}`;

/** 학생 추가·고치기 공통: 이름은 꼭, 생일은 비우거나 월-일 */
function validateStudent(name: string, birthday: string): { name?: string; birthday?: string } {
  const errs: { name?: string; birthday?: string } = {};
  if (!name.trim()) errs.name = '이름을 적어 주세요';
  if (normalizeBirthday(birthday.trim()) === undefined) errs.birthday = '월-일로 적어 주세요 (예: 03-05)';
  return errs;
}

/**
 * 관리 → 학생 명단: 반 보기 → 학생 목록(이름·생일·연속 출석). 줄을 열면 링크 공유·이름·생일 고치기·반 옮기기·링크 재발급·비활성화.
 * 아래에 학생 추가 폼과 일괄 등록(붙여 넣기 → 미리보기 → n명 등록).
 */
export function RosterAdmin() {
  const { show } = useToast();
  const { data, error, loading, reload } = useLoader(useCallback(loadAll, []));
  const [filter, setFilter] = useState<string>(ALL);
  const [open, setOpen] = useState<string | null>(null);
  const [reveal, setReveal] = useState<string | null>(null); // 방금 추가한 학생: 보이게 스크롤 + 초점

  // 새로 추가한 학생 줄로 옮겨 간다(폼은 목록 아래에 있으니)
  useEffect(() => {
    if (!reveal || !data?.students.some((x) => x.id === reveal)) return;
    const btn = document.getElementById(rowDomId(reveal))?.querySelector('button');
    btn?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    btn?.focus({ preventScroll: true });
    setReveal(null);
  }, [reveal, data]);

  if (!data) {
    if (error) return <LoadError error={error} onRetry={reload} />;
    return <Loading />;
  }
  const { classes, students } = data;

  if (classes.length === 0) {
    return (
      <EmptyState icon="class" title="아직 반이 없어요"
        action={<LinkButton href={teacherHref('admin', 'classes')} variant="secondary" size="sm">반 만들기</LinkButton>}>
        학생은 반에 속해요. 반·교사에서 반을 먼저 만들어 주세요.
      </EmptyState>
    );
  }

  const className = (id: string) => classes.find((c) => c.id === id)?.name ?? '지워진 반';
  const shown = filter === ALL ? students : students.filter((x) => x.classId === filter);
  const chip = (label: string, n: number) => <>{label}<span className={s.count}>{n}명</span></>;
  const filterOptions = [{ value: ALL, label: chip('전체', students.length) }, ...classes.map((c) => ({
    value: c.id, label: chip(c.name, students.filter((x) => x.classId === c.id).length),
  }))];

  async function added(token: string, classId: string) {
    if (filter !== ALL && filter !== classId) setFilter(classId);
    setOpen(token);
    setReveal(token);
    await reload();
  }

  return (
    <div className={s.stack} aria-busy={loading || undefined}>
      <ChoiceChips legend="반 보기" options={filterOptions} value={filter}
        onChange={(v) => { setFilter(v); setOpen(null); }} />

      <Card title={filter === ALL ? `학생 ${students.length}명` : `${className(filter)} ${shown.length}명`}>
        {shown.length === 0 ? (
          <p className={s.muted}>이 반에는 아직 학생이 없어요. 아래에서 추가해 주세요.</p>
        ) : (
          <List label="학생 목록">
            {shown.map((st) => (
              <StudentRow key={st.id} st={st} classes={classes}
                meta={[filter === ALL && className(st.classId), st.birthday && `생일 ${birthdayLabel(st.birthday)}`, st.newcomer === true && '새 친구']
                  .filter(Boolean).join(', ') || undefined}
                open={open === st.id}
                onToggle={() => setOpen((o) => (o === st.id ? null : st.id))}
                onReissued={async (next) => {
                  setOpen(next);
                  show('새 링크를 만들었어요. 학생에게 다시 보내 주세요');
                  await reload();
                }}
                onChanged={reload}
                onDeactivated={async () => { setOpen(null); show(`${st.name} 학생을 비활성화했어요`); await reload(); }}
              />
            ))}
          </List>
        )}
      </Card>

      <NewStudent classes={classes} defaultClassId={filter === ALL ? classes[0].id : filter} onAdded={added} />
      <BulkRegister classes={classes} onDone={reload} />
    </div>
  );
}

function StudentRow({ st, classes, meta, open, onToggle, onReissued, onChanged, onDeactivated }: {
  st: Stu; classes: Cls[]; meta?: string; open: boolean; onToggle(): void;
  onReissued(next: string): Promise<void>; onChanged(): Promise<void>; onDeactivated(): Promise<void>;
}) {
  const { show } = useToast();
  const [moveTo, setMoveTo] = useState(st.classId);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(st.name);
  const [birthday, setBirthday] = useState(st.birthday ?? '');
  const [errors, setErrors] = useState<{ name?: string; birthday?: string }>({});
  const [saving, setSaving] = useState(false);
  const b = normalizeBirthday(birthday.trim());
  const [newcomer, setNewcomer] = useState(st.newcomer === true);
  const unchanged = name.trim() === st.name && b === (st.birthday ?? null) && newcomer === (st.newcomer === true);

  async function save(e: FormEvent) {
    e.preventDefault();
    const errs = validateStudent(name, birthday);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await updateStudent(db, st.id, { name: name.trim(), birthday: b ?? null, newcomer });
      show('저장했어요');
      await onChanged();
    } catch (err) {
      show(describeError(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function move() {
    setBusy(true);
    try {
      await updateStudent(db, st.id, { classId: moveTo });
      show(`${st.name} 학생의 반을 옮겼어요`);
      await onChanged();
    } catch (e) {
      show(describeError(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ListRow id={rowDomId(st.id)} title={st.name} meta={meta}
        aside={st.streak > 0 ? <span className={s.streak}>{st.streak}주 연속</span> : undefined}
        open={open} onToggle={onToggle}>
        <ShareLink token={st.id} name={st.name} />
        <form className={s.edit} onSubmit={save} noValidate aria-label={`${st.name} 정보 고치기`}>
          <div className={s.pair}>
            <Field label="이름" autoComplete="off" maxLength={20} value={name}
              onChange={(e) => setName(e.target.value)} error={errors.name} />
            <Field label="생일" inputMode="numeric" autoComplete="off" maxLength={5} value={birthday}
              onChange={(e) => setBirthday(e.target.value)} placeholder="03-05" hint="비워 둬도 돼요" error={errors.birthday} />
          </div>
          <NewcomerCheck checked={newcomer} onChange={setNewcomer} />
          <Button type="submit" variant="secondary" block busy={saving} disabled={unchanged}>저장</Button>
        </form>
        <div className={s.move}>
          <Select label="반 옮기기" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Button variant="secondary" busy={busy} disabled={moveTo === st.classId} onClick={move}>옮기기</Button>
        </div>
        <div className={s.danger}>
          <ConfirmAction label="링크 재발급" icon="refresh" confirmLabel="재발급하기"
            message="지금 링크는 바로 닫혀요. 출석 기록은 새 링크로 옮겨 가고, 새 링크를 학생에게 다시 보내야 해요."
            onConfirm={async () => { const next = await reissueToken(db, st.id); await onReissued(next); }} />
          <ConfirmAction label="비활성화" icon="userOff" confirmLabel="비활성화하기"
            message="목록에서 빠지고 링크도 열리지 않아요. 출석 기록은 남아요."
            onConfirm={async () => { await deactivateStudent(db, st.id); await onDeactivated(); }} />
        </div>
    </ListRow>
  );
}

function NewStudent({ classes, defaultClassId, onAdded }: {
  classes: Cls[]; defaultClassId: string; onAdded(token: string, classId: string): Promise<void>;
}) {
  const { show } = useToast();
  const [name, setName] = useState('');
  const [classId, setClassId] = useState<string | null>(null); // null = 지금 보는 반
  const [birthday, setBirthday] = useState('');
  const [newcomer, setNewcomer] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; birthday?: string }>({});
  const [busy, setBusy] = useState(false);
  const cid = classId ?? defaultClassId;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const b = normalizeBirthday(birthday.trim());
    const errs = validateStudent(name, birthday);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const token = await createStudent(db, { name: name.trim(), classId: cid, birthday: b ?? null, newcomer });
      show(`${name.trim()} 학생을 추가했어요`);
      setName('');
      setBirthday('');
      setNewcomer(false);
      await onAdded(token, cid);
    } catch (err) {
      show(describeError(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="학생 추가">
      <form className={s.form} onSubmit={submit} noValidate aria-label="학생 추가">
        <Field label="학생 이름" autoComplete="off" maxLength={20} value={name}
          onChange={(e) => setName(e.target.value)} placeholder="김하늘" error={errors.name} />
        <div className={s.pair}>
          <Select label="반" value={cid} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Field label="생일" inputMode="numeric" autoComplete="off" maxLength={5} value={birthday}
            onChange={(e) => setBirthday(e.target.value)} placeholder="03-05" hint="비워 둬도 돼요" error={errors.birthday} />
        </div>
        <NewcomerCheck checked={newcomer} onChange={setNewcomer} />
        <Button type="submit" block busy={busy} icon={<Icon name="plus" size={20} />}>학생 추가</Button>
      </form>
    </Card>
  );
}

function BulkRegister({ classes, onDone }: { classes: Cls[]; onDone(): Promise<void> }) {
  const { show } = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const names = useMemo(() => classes.map((c) => c.name), [classes]);
  const { rows, errors } = useMemo(() => parseRoster(text, names), [text, names]);
  // 반 이름 → ID. 같은 이름이 둘 이상이면(parseRoster 가 이미 고칠 줄로 뺀다) 짐작하지 않고 넣지 않는다
  const idByName = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const c of classes) m.set(c.name, m.has(c.name) ? null : c.id);
    return m;
  }, [classes]);

  async function register() {
    const resolved = rows.map((r) => ({ name: r.name, classId: idByName.get(r.className) ?? null, birthday: r.birthday }));
    if (resolved.some((r) => r.classId === null)) {
      show('반을 정하지 못한 줄이 있어요. 반 이름이 겹치지 않게 고친 뒤 다시 해 주세요', 'error');
      return;
    }
    setBusy(true);
    try {
      await bulkCreateStudents(db, resolved.map((r) => ({ ...r, classId: r.classId! })));
      show(`${rows.length}명을 등록했어요`);
      setText('');
      await onDone();
    } catch (e) {
      show(describeError(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="일괄 등록">
      <TextArea label="명단 붙여 넣기" value={text} onChange={(e) => setText(e.target.value)} rows={5}
        placeholder={'김하늘, 1반, 03-05\n이바다, 2반'} spellCheck={false}
        hint="한 줄에 한 명씩 이름, 반, 생일 순서로 적어요. 엑셀에서 세 칸을 복사해 붙여 넣어도 돼요." />
      {text.trim() !== '' && (
        <div className={s.preview}>
          <p className={s.summary} aria-live="polite">
            등록할 학생 {rows.length}명{errors.length > 0 && `, 고칠 줄 ${errors.length}개`}
          </p>
          {errors.length > 0 && (
            <ul className={s.errors} aria-label="고칠 줄">
              {errors.map((er) => (
                <li key={er.line}><Icon name="alert" size={18} />{er.message}</li>
              ))}
            </ul>
          )}
          {rows.length > 0 && (
            <ul className={s.rows} aria-label="등록할 학생">
              {rows.map((r, i) => (
                <li key={i}>
                  <span className={s.rowName}>{r.name}</span>
                  <span className={s.rowMeta}>{r.className}{r.birthday && `, 생일 ${birthdayLabel(r.birthday)}`}</span>
                </li>
              ))}
            </ul>
          )}
          {errors.length > 0 && rows.length > 0 && (
            <p className={s.muted}>고칠 줄은 빼고 등록해요. 고친 뒤 다시 붙여 넣으면 돼요.</p>
          )}
          <Button variant="secondary" block busy={busy} disabled={rows.length === 0} onClick={register}
            icon={<Icon name="plus" size={20} />}>
            {rows.length}명 등록
          </Button>
        </div>
      )}
    </Card>
  );
}
