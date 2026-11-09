import { useCallback, useState } from 'react';
import { teacherHref } from '../app/router';
import { useLoader } from '../app/useLoader';
import { listAttendanceByDate } from '../data/attendance';
import { listStudents } from '../data/students';
import { addDays, formatMonthDay, isBirthdayWeek, toDateId } from '../lib/dates';
import { db } from '../lib/firebase';
import { activeStreak } from '../lib/streak';
import { Button, LinkButton } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/icons';
import { LoadError } from '../ui/LoadError';
import { Loading } from '../ui/Loading';
import { ClassPicker } from './ClassPicker';
import type { TeacherTabProps } from './types';
import { useAttendanceMarks, type AttendanceMarks } from './useAttendanceMarks';
import { useClassChoice, useMyClasses } from './useClassChoice';
import s from './AttendanceTab.module.css';

const toDate = (id: string) => {
  const [y, m, d] = id.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const shift = (id: string, days: number) => toDateId(addDays(toDate(id), days));
const weeksFrom = (base: string, id: string) => Math.round((toDate(id).getTime() - toDate(base).getTime()) / (7 * 864e5));

function relativeWeek(n: number): string {
  if (n === 0) return '이번 주';
  if (n === -1) return '지난주';
  if (n === 1) return '다음 주';
  return n < 0 ? `${-n}주 전` : `${n}주 뒤`;
}

/** 출석: 날짜(주일)·반을 고르고, 이름 버튼을 눌러 출석/취소. 예배실에서 한 손으로 빠르게. */
export function AttendanceTab({ uid, teacher, thisSunday }: TeacherTabProps) {
  const isAdmin = teacher.role === 'admin';
  const classes = useMyClasses(teacher);
  const [current, choose] = useClassChoice(classes.data);
  const [dateId, setDateId] = useState(thisSunday);
  // 반·날짜를 옮겨도 저장 중인 토글을 잃지 않게 그리드 밖에 둔다
  const marks = useAttendanceMarks(uid);
  const latest = shift(thisSunday, 7); // 다음 주일까지만(미리 찍기)

  if (classes.data === undefined) {
    return classes.error ? <LoadError error={classes.error} onRetry={classes.reload} /> : <Loading />;
  }
  if (current === null) {
    return isAdmin ? (
      <EmptyState icon="class" title="아직 반이 없어요"
        action={<LinkButton href={teacherHref('admin', 'classes')} variant="secondary" size="sm">반 만들기</LinkButton>}>
        반·교사에서 반을 먼저 만들어 주세요.
      </EmptyState>
    ) : (
      <EmptyState icon="class" title="담당 반이 없어요">
        관리자에게 담당 반을 정해 달라고 해 주세요.
      </EmptyState>
    );
  }
  const klass = classes.data.find((c) => c.id === current)!;

  return (
    <>
      <Card className={s.controls}>
        <DateStepper value={dateId} thisSunday={thisSunday} latest={latest} onChange={setDateId} />
        <ClassPicker classes={classes.data} value={current} onChange={choose} />
      </Card>
      <Roll key={current} marks={marks} classId={current} className={classes.data.length < 2 ? klass.name : undefined}
        dateId={dateId} thisSunday={thisSunday} isAdmin={isAdmin} />
    </>
  );
}

function DateStepper({ value, thisSunday, latest, onChange }: {
  value: string; thisSunday: string; latest: string; onChange(id: string): void;
}) {
  const away = weeksFrom(thisSunday, value);
  return (
    <div className={s.stepper}>
      <Button variant="secondary" className={s.step} aria-label="지난 주일" icon={<Icon name="chevronLeft" />}
        onClick={() => onChange(shift(value, -7))} />
      <div className={s.when}>
        <p className={s.date} aria-live="polite">{formatMonthDay(value)} 주일</p>
        <div className={s.rel}>
          <span>{relativeWeek(away)}</span>
          {away !== 0 && (
            <Button variant="ghost" size="sm" className={s.today} icon={<Icon name="calendar" size={18} />}
              onClick={() => onChange(thisSunday)}>
              오늘로
            </Button>
          )}
        </div>
      </div>
      <Button variant="secondary" className={s.step} aria-label="다음 주일" icon={<Icon name="chevronRight" />}
        disabled={value >= latest} onClick={() => onChange(shift(value, 7))} />
    </div>
  );
}

/** 한 반의 출석 그리드. 반이 바뀌면 key 로 새로 만든다. */
function Roll({ marks, classId, className, dateId, thisSunday, isAdmin }: {
  marks: AttendanceMarks; classId: string; className?: string; dateId: string; thisSunday: string; isAdmin: boolean;
}) {
  const students = useLoader(useCallback(() => listStudents(db, classId), [classId]));
  // useLoader 는 다시 불러오는 동안 앞 값을 그대로 두므로, 어느 날짜의 값인지 함께 들고 다닌다
  const att = useLoader(useCallback(async () => ({ dateId, map: await listAttendanceByDate(db, dateId) }), [dateId]));

  if (students.data === undefined) {
    return students.error ? <LoadError error={students.error} onRetry={students.reload} /> : <Loading />;
  }
  if (students.data.length === 0) {
    return (
      <EmptyState icon="class" title="이 반에는 아직 학생이 없어요"
        action={isAdmin && <LinkButton href={teacherHref('admin', 'roster')} variant="secondary" size="sm">학생 명단</LinkButton>}>
        {isAdmin ? '학생 명단에서 이 반 학생을 추가해 주세요.' : '관리자에게 학생 등록을 부탁해 주세요.'}
      </EmptyState>
    );
  }
  const map = att.data?.dateId === dateId ? att.data.map : undefined;
  if (map === undefined) {
    return att.error && !att.loading ? <LoadError error={att.error} onRetry={att.reload} /> : <Loading />;
  }

  // 출석 인원은 반의 활성 학생만 센다(맵에는 재발급된 옛 토큰도 섞여 있다)
  const rows = students.data.map((st) => ({ st, on: marks.present(dateId, st.id, map.get(st.id) === true) }));
  const n = rows.filter((r) => r.on).length;

  return (
    <section className={s.roll} aria-labelledby="roll-count">
      <div className={s.head}>
        <h2 id="roll-count" className={s.count}>출석 {n} / {rows.length}</h2>
        {className && <span className={s.className}>{className}</span>}
      </div>
      <ul className={s.grid}>
        {rows.map(({ st, on }) => {
          const busy = marks.pending(dateId, st.id);
          const streak = activeStreak({ ...st, ...marks.streak(st.id) }, thisSunday);
          const birthday = st.birthday !== null && isBirthdayWeek(st.birthday, dateId);
          return (
            <li key={st.id}>
              <button type="button" className={s.student} aria-pressed={on} aria-busy={busy || undefined}
                onClick={() => {
                  try { navigator.vibrate?.(10); } catch { /* 진동 없는 기기 */ }
                  marks.toggle(dateId, st.id, on);
                }}>
                <span className={s.tick} aria-hidden="true">{on && <Icon name="check" size={18} />}</span>
                <span className={s.name}>{st.name}</span>
                {(streak >= 4 || birthday) && (
                  <span className={s.marks}>
                    {birthday && <Icon name="cake" size={16} label="생일 주간" />}
                    {streak >= 4 && <span><span aria-hidden="true">{streak}주</span><span className="sr-only">{streak}주 연속 출석</span></span>}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
