import { useCallback, useState, type FormEvent } from 'react';
import { describeError, useToast } from '../app/Toast';
import { useLoader } from '../app/useLoader';
import { createClass, listClasses, updateClass } from '../data/classes';
import { deleteInvite, listInvites, listTeachers, removeTeacher, saveInvite, saveTeacherProfile } from '../data/teachers';
import { db } from '../lib/firebase';
import { withTitle } from '../lib/korean';
import type { ClassDoc, Invite, Role, Teacher, WithId } from '../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ChoiceChips } from '../ui/ChoiceChips';
import { ConfirmAction } from '../ui/ConfirmAction';
import { Field } from '../ui/Field';
import { Icon } from '../ui/icons';
import { List, ListRow } from '../ui/List';
import { LoadError } from '../ui/LoadError';
import { Loading } from '../ui/Loading';
import s from './ClassesTeachersAdmin.module.css';
import { TitleField } from './TitleField';

type Cls = WithId<ClassDoc>;

const ROLE_LABEL: Record<Role, string> = { teacher: '교사', admin: '관리자' };
const ROLE_CHOICES = [
  { value: 'teacher', label: '교사' },
  { value: 'admin', label: '관리자' },
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function loadAll() {
  const [classes, invites, teachers] = await Promise.all([listClasses(db), listInvites(db), listTeachers(db)]);
  return { classes, invites, teachers };
}

/**
 * 관리 → 반·교사: 반 목록(고치기·추가), 선생님 초대(대기 중 초대 고치기·취소),
 * 등록된 선생님(이름·호칭·역할·담당 반, 내보내기). 내 줄에서는 내 이름·호칭만 고친다.
 */
export function ClassesTeachersAdmin({ myUid, onProfileChanged }: { myUid: string; onProfileChanged(): Promise<void> }) {
  const { data, error, loading, reload } = useLoader(useCallback(loadAll, []));
  const [open, setOpen] = useState<string | null>(null); // 펼친 줄: 'c:반ID' | 'i:이메일' | 't:uid'
  const toggle = (k: string) => setOpen((o) => (o === k ? null : k));

  if (!data) {
    if (error) return <LoadError error={error} onRetry={reload} />;
    return <Loading />;
  }
  const { classes, invites, teachers } = data;
  const registered = new Set(teachers.map((t) => t.email.toLowerCase()));
  const pending = invites.filter((i) => !registered.has(i.id));
  const className = (id: string) => classes.find((c) => c.id === id)?.name ?? '지워진 반';
  const classList = (ids: string[]) => (ids.length ? ids.map(className).join(', ') : '담당 반 없음');

  return (
    <div className={s.stack} aria-busy={loading || undefined}>
      <Card title="반">
        {classes.length === 0 ? (
          <p className={s.muted}>아직 반이 없어요. 아래에서 첫 반을 만들어 주세요.</p>
        ) : (
          <List label="반 목록">
            {classes.map((c) => (
              <ListRow key={c.id} title={c.name} meta={`${c.grade}학년, 순서 ${c.order}`}
                open={open === `c:${c.id}`} onToggle={() => toggle(`c:${c.id}`)}>
                <ClassEdit cls={c} otherNames={classes.filter((o) => o.id !== c.id).map((o) => o.name)}
                  onSaved={async () => { setOpen(null); await reload(); }} />
              </ListRow>
            ))}
          </List>
        )}
        <NewClass nextOrder={Math.max(0, ...classes.map((c) => c.order)) + 1} classNames={classes.map((c) => c.name)} onAdded={reload} />
      </Card>

      <Card title="선생님 초대">
        <NewInvite classes={classes} registered={registered} onSaved={reload} />
        {pending.length > 0 && (
          <div className={s.sub}>
            <h3>아직 로그인하지 않은 초대</h3>
            <List label="대기 중인 초대">
              {pending.map((inv) => (
                <ListRow key={inv.id} title={withTitle(inv.name, inv.title)} meta={inv.id} aside={ROLE_LABEL[inv.role]}
                  open={open === `i:${inv.id}`} onToggle={() => toggle(`i:${inv.id}`)}>
                  <InviteEdit invite={inv} classes={classes}
                    onDone={async () => { setOpen(null); await reload(); }} />
                </ListRow>
              ))}
            </List>
          </div>
        )}
      </Card>

      <Card title="등록된 선생님">
        {teachers.length === 0 ? (
          <p className={s.muted}>초대받은 선생님이 로그인하면 여기에 보여요.</p>
        ) : (
          <List label="등록된 선생님">
            {teachers.map((t) => (
              <ListRow key={t.id} title={t.id === myUid ? `${withTitle(t.name, t.title)} (나)` : withTitle(t.name, t.title)}
                meta={<>{t.email}<br />{t.role === 'admin' ? '모든 반' : classList(t.classIds)}</>}
                aside={ROLE_LABEL[t.role]}
                open={open === `t:${t.id}`} onToggle={() => toggle(`t:${t.id}`)}>
                {t.id === myUid ? (
                  <SelfEdit teacher={t}
                    onDone={async () => { setOpen(null); await Promise.all([reload(), onProfileChanged()]); }} />
                ) : (
                  <TeacherEdit teacher={t} classes={classes}
                    onDone={async () => { setOpen(null); await reload(); }} />
                )}
              </ListRow>
            ))}
          </List>
        )}
      </Card>
    </div>
  );
}

/** 학년·순서: 1 이상의 정수만 */
function toPositiveInt(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

function ClassFields({ name, grade, order, onName, onGrade, onOrder, errors }: {
  name: string; grade: string; order: string;
  onName(v: string): void; onGrade(v: string): void; onOrder(v: string): void;
  errors: { name?: string; grade?: string; order?: string };
}) {
  return (
    <>
      <Field label="반 이름" value={name} onChange={(e) => onName(e.target.value)} placeholder="1학년 1반"
        autoComplete="off" maxLength={30} error={errors.name} />
      <div className={s.pair}>
        <Field label="학년" inputMode="numeric" value={grade} onChange={(e) => onGrade(e.target.value)} error={errors.grade} />
        <Field label="순서" inputMode="numeric" value={order} onChange={(e) => onOrder(e.target.value)}
          hint="목록에 보이는 차례" error={errors.order} />
      </div>
    </>
  );
}

/** otherNames: 이 반을 뺀 나머지 반 이름들(같은 이름이면 일괄 등록·고르기에서 어느 반인지 알 수 없다) */
function validateClass(name: string, grade: string, order: string, otherNames: readonly string[]) {
  const errors: { name?: string; grade?: string; order?: string } = {};
  if (!name.trim()) errors.name = '반 이름을 적어 주세요';
  else if (otherNames.some((n) => n.trim() === name.trim())) errors.name = '같은 이름의 반이 이미 있어요';
  if (toPositiveInt(grade) === null) errors.grade = '1 이상의 숫자로 적어 주세요';
  if (toPositiveInt(order) === null) errors.order = '1 이상의 숫자로 적어 주세요';
  return errors;
}

function NewClass({ nextOrder, classNames, onAdded }: { nextOrder: number; classNames: string[]; onAdded(): Promise<void> }) {
  const { show } = useToast();
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('1');
  const [order, setOrder] = useState<string | null>(null); // null = 다음 순서 자동
  const [errors, setErrors] = useState<ReturnType<typeof validateClass>>({});
  const [busy, setBusy] = useState(false);
  const orderValue = order ?? String(nextOrder);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = validateClass(name, grade, orderValue, classNames);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await createClass(db, { name: name.trim(), grade: toPositiveInt(grade)!, order: toPositiveInt(orderValue)! });
      show('반을 추가했어요');
      setName('');
      setOrder(null);
      await onAdded();
    } catch (err) {
      show(describeError(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={s.form} onSubmit={submit} noValidate aria-label="새 반">
      <h3>새 반</h3>
      <ClassFields name={name} grade={grade} order={orderValue} errors={errors}
        onName={setName} onGrade={setGrade} onOrder={setOrder} />
      <Button type="submit" block busy={busy} icon={<Icon name="plus" size={20} />}>반 추가</Button>
    </form>
  );
}

function ClassEdit({ cls, otherNames, onSaved }: { cls: Cls; otherNames: string[]; onSaved(): Promise<void> }) {
  const { show } = useToast();
  const [name, setName] = useState(cls.name);
  const [grade, setGrade] = useState(String(cls.grade));
  const [order, setOrder] = useState(String(cls.order));
  const [errors, setErrors] = useState<ReturnType<typeof validateClass>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = validateClass(name, grade, order, otherNames);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await updateClass(db, cls.id, { name: name.trim(), grade: toPositiveInt(grade)!, order: toPositiveInt(order)! });
      show('반을 고쳤어요');
      await onSaved();
    } catch (err) {
      show(describeError(err), 'error');
      setBusy(false);
    }
  }

  return (
    <form className={s.form} onSubmit={submit} noValidate>
      <ClassFields name={name} grade={grade} order={order} errors={errors}
        onName={setName} onGrade={setGrade} onOrder={setOrder} />
      <Button type="submit" variant="secondary" block busy={busy}>반 고치기</Button>
    </form>
  );
}

function Assignment({ role, classIds, classes, onRole, onClassIds }: {
  role: Role; classIds: string[]; classes: Cls[]; onRole(r: Role): void; onClassIds(ids: string[]): void;
}) {
  return (
    <>
      <ChoiceChips legend="역할" options={ROLE_CHOICES} value={role} onChange={onRole} />
      {classes.length > 0 ? (
        <ChoiceChips multiple legend="담당 반" options={classes.map((c) => ({ value: c.id, label: c.name }))}
          value={classIds} onChange={onClassIds}
          hint={role === 'admin' ? '관리자는 담당 반과 상관없이 모든 반을 봐요' : '출석을 부르고 기도 제목을 볼 반'} />
      ) : (
        <p className={s.muted}>반을 먼저 만들면 담당 반을 고를 수 있어요.</p>
      )}
    </>
  );
}

function NewInvite({ classes, registered, onSaved }: { classes: Cls[]; registered: Set<string>; onSaved(): Promise<void> }) {
  const { show } = useToast();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [role, setRole] = useState<Role>('teacher');
  const [classIds, setClassIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ email?: string; name?: string }>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const id = email.trim().toLowerCase();
    const errs: typeof errors = {};
    if (!EMAIL_RE.test(id)) errs.email = 'Google 계정 이메일을 적어 주세요';
    else if (registered.has(id)) errs.email = '이미 등록된 선생님이에요. 아래 목록에서 고쳐 주세요';
    if (!name.trim()) errs.name = '이름을 적어 주세요';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await saveInvite(db, id, { name: name.trim(), title, role, classIds });
      show('초대했어요');
      setEmail(''); setName(''); setTitle(''); setRole('teacher'); setClassIds([]);
      await onSaved();
    } catch (err) {
      show(describeError(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={s.form} onSubmit={submit} noValidate aria-label="선생님 초대">
      <p className={s.muted}>초대한 이메일의 Google 계정으로 로그인하면 바로 들어와요.</p>
      <Field label="선생님 이메일" type="email" inputMode="email" autoComplete="off" value={email}
        onChange={(e) => setEmail(e.target.value)} placeholder="teacher@gmail.com" error={errors.email} />
      <Field label="선생님 이름" autoComplete="off" value={name} maxLength={20}
        onChange={(e) => setName(e.target.value)} placeholder="김선생" error={errors.name} />
      <TitleField value={title} onChange={setTitle} />
      <Assignment role={role} classIds={classIds} classes={classes} onRole={setRole} onClassIds={setClassIds} />
      <Button type="submit" variant="secondary" block busy={busy} icon={<Icon name="mail" size={20} />}>초대하기</Button>
    </form>
  );
}

function InviteEdit({ invite, classes, onDone }: { invite: WithId<Invite>; classes: Cls[]; onDone(): Promise<void> }) {
  const { show } = useToast();
  const [name, setName] = useState(invite.name);
  const [title, setTitle] = useState(invite.title ?? '');
  const [role, setRole] = useState<Role>(invite.role);
  const [classIds, setClassIds] = useState<string[]>(invite.classIds);
  const [nameError, setNameError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setNameError('이름을 적어 주세요'); return; }
    setBusy(true);
    try {
      await saveInvite(db, invite.id, { name: name.trim(), title, role, classIds });
      show('초대를 고쳤어요');
      await onDone();
    } catch (err) {
      show(describeError(err), 'error');
      setBusy(false);
    }
  }

  return (
    <form className={s.form} onSubmit={submit} noValidate>
      <Field label="이름" autoComplete="off" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} error={nameError} />
      <TitleField value={title} onChange={setTitle} />
      <Assignment role={role} classIds={classIds} classes={classes} onRole={setRole} onClassIds={setClassIds} />
      <div className={s.actions}>
        <Button type="submit" variant="secondary" busy={busy}>초대 고치기</Button>
        <ConfirmAction label="초대 취소" icon="close" confirmLabel="초대 취소하기"
          message={<>{invite.id} 로는 더 이상 들어올 수 없어요. 다시 들이려면 새로 초대해야 해요.</>}
          onConfirm={async () => { await deleteInvite(db, invite.id); show('초대를 취소했어요'); await onDone(); }} />
      </div>
    </form>
  );
}

function TeacherEdit({ teacher, classes, onDone }: { teacher: WithId<Teacher>; classes: Cls[]; onDone(): Promise<void> }) {
  const { show } = useToast();
  const [name, setName] = useState(teacher.name);
  const [title, setTitle] = useState(teacher.title ?? '');
  const [role, setRole] = useState<Role>(teacher.role);
  const [classIds, setClassIds] = useState<string[]>(teacher.classIds);
  const [nameError, setNameError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const label = withTitle(teacher.name, teacher.title);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setNameError('이름을 적어 주세요'); return; }
    setBusy(true);
    try {
      // 교사 문서와 초대를 한 번에 같게 맞춘다(교사 문서가 지워졌다 다시 생길 때 옛 값으로 돌아가지 않게)
      await saveTeacherProfile(db, teacher.id, teacher.email, { name: name.trim(), title, role, classIds });
      show('저장했어요');
      await onDone();
    } catch (err) {
      show(describeError(err), 'error');
      setBusy(false);
    }
  }

  return (
    <form className={s.form} onSubmit={submit} noValidate aria-label={`${label} 고치기`}>
      <Field label="이름" autoComplete="off" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} error={nameError} />
      <TitleField value={title} onChange={setTitle} />
      <Assignment role={role} classIds={classIds} classes={classes} onRole={setRole} onClassIds={setClassIds} />
      <div className={s.actions}>
        <Button type="submit" variant="secondary" busy={busy}>저장</Button>
        <ConfirmAction label="교사 내보내기" icon="userOff" confirmLabel="내보내기"
          message={<>{label} 계정으로는 더 이상 들어올 수 없어요. 다시 들이려면 새로 초대해야 해요.</>}
          onConfirm={async () => {
            await removeTeacher(db, teacher.id, teacher.email);
            show(`${label} 계정을 내보냈어요`);
            await onDone();
          }} />
      </div>
    </form>
  );
}

/** 내 줄: 이름·호칭만(역할·담당 반과 내보내기는 다른 관리자가 한다 — 스스로 관리자 권한을 잃지 않게). */
function SelfEdit({ teacher, onDone }: { teacher: WithId<Teacher>; onDone(): Promise<void> }) {
  const { show } = useToast();
  const [name, setName] = useState(teacher.name);
  const [title, setTitle] = useState(teacher.title ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setNameError('이름을 적어 주세요'); return; }
    setBusy(true);
    try {
      await saveTeacherProfile(db, teacher.id, teacher.email,
        { name: name.trim(), title, role: teacher.role, classIds: teacher.classIds });
      show('저장했어요');
      await onDone();
    } catch (err) {
      show(describeError(err), 'error');
      setBusy(false);
    }
  }

  return (
    <form className={s.form} onSubmit={submit} noValidate aria-label="내 이름·호칭 고치기">
      <Field label="이름" autoComplete="off" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} error={nameError} />
      <TitleField value={title} onChange={setTitle} />
      <p className={s.muted}>내 역할과 담당 반은 다른 관리자가 바꿀 수 있어요.</p>
      <Button type="submit" variant="secondary" busy={busy}>저장</Button>
    </form>
  );
}
