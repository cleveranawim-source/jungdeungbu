import { useCallback } from 'react';
import { teacherHref } from '../app/router';
import { useLoader } from '../app/useLoader';
import { listStudents } from '../data/students';
import { isBirthdayWeek } from '../lib/dates';
import { db } from '../lib/firebase';
import { activeStreak } from '../lib/streak';
import { isToken } from '../lib/token';
import { LinkButton } from '../ui/Button';
import { Card } from '../ui/Card';
import { PageIntro } from '../ui/PageIntro';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/icons';
import { LoadError } from '../ui/LoadError';
import { Loading } from '../ui/Loading';
import { ClassPicker } from './ClassPicker';
import { StudentDetail } from './StudentDetail';
import type { TeacherTabProps } from './types';
import { useClassChoice, useMyClasses } from './useClassChoice';
import s from './ClassTab.module.css';

/** 우리 반: 반 고르기 → 학생 목록(연속 출석·생일 주간). 학생을 누르면 `#/t/class/{토큰}` 상세. */
export function ClassTab(props: TeacherTabProps) {
  const { teacher, thisSunday, sub } = props;
  const classes = useMyClasses(teacher);
  const [current, choose] = useClassChoice(classes.data);

  if (sub && isToken(sub))
    return <StudentDetail token={sub} teacher={teacher} thisSunday={thisSunday} />;

  if (classes.data === undefined) {
    return classes.error ? (
      <LoadError error={classes.error} onRetry={classes.reload} />
    ) : (
      <Loading />
    );
  }
  if (current === null) {
    return teacher.role === 'admin' ? (
      <EmptyState
        icon="class"
        title="아직 반이 없어요"
        action={
          <LinkButton href={teacherHref('admin', 'classes')} variant="secondary" size="sm">
            반 만들기
          </LinkButton>
        }
      >
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
      <PageIntro title="한 사람씩, 함께 걸어요" icon="class">
        학생을 누르면 출석 기록과 생일을 보고, 개인 링크를 전할 수 있어요.
      </PageIntro>
      <ClassPicker classes={classes.data} value={current} onChange={choose} />
      <Roster
        key={current}
        classId={current}
        className={klass.name}
        thisSunday={thisSunday}
        isAdmin={teacher.role === 'admin'}
      />
    </>
  );
}

function Roster({
  classId,
  className,
  thisSunday,
  isAdmin,
}: {
  classId: string;
  className: string;
  thisSunday: string;
  isAdmin: boolean;
}) {
  const students = useLoader(useCallback(() => listStudents(db, classId), [classId]));
  if (students.data === undefined) {
    return students.error ? (
      <LoadError error={students.error} onRetry={students.reload} />
    ) : (
      <Loading />
    );
  }
  if (students.data.length === 0) {
    return (
      <EmptyState
        icon="class"
        title={`${className}에는 아직 학생이 없어요`}
        action={
          isAdmin && (
            <LinkButton href={teacherHref('admin', 'roster')} variant="secondary" size="sm">
              학생 명단
            </LinkButton>
          )
        }
      >
        {isAdmin
          ? '학생 명단에서 이 반 학생을 추가해 주세요.'
          : '관리자에게 학생 등록을 부탁해 주세요.'}
      </EmptyState>
    );
  }
  return (
    <Card title={`${className} ${students.data.length}명`} tone="sage">
      <ul className={s.list} aria-label="학생 목록">
        {students.data.map((st) => {
          const streak = activeStreak(st, thisSunday);
          const birthday = st.birthday !== null && isBirthdayWeek(st.birthday, thisSunday);
          return (
            <li key={st.id}>
              <a className={s.row} href={teacherHref('class', st.id)}>
                <span className={s.text}>
                  <span className={s.name}>{st.name}</span>
                  {streak > 0 && <span className={s.meta}>{streak}주 연속</span>}
                </span>
                {birthday && (
                  <span className={s.cake}>
                    <Icon name="cake" size={20} label="생일 주간" />
                  </span>
                )}
                <Icon name="chevronRight" size={20} />
              </a>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
