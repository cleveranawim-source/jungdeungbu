import { useCallback } from 'react';
import { teacherHref } from '../app/router';
import { useLoader } from '../app/useLoader';
import { listStudentAttendance } from '../data/attendance';
import { getClass } from '../data/classes';
import { getStudent } from '../data/students';
import { formatBirthday, isBirthdayWeek, semesterStart } from '../lib/dates';
import { db } from '../lib/firebase';
import { activeStreak } from '../lib/streak';
import type { Teacher } from '../types';
import { AttendanceCalendar } from '../ui/AttendanceCalendar';
import { LinkButton } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/icons';
import { LoadError } from '../ui/LoadError';
import { Loading } from '../ui/Loading';
import { ShareLink } from '../ui/ShareLink';
import s from './StudentDetail.module.css';

export interface StudentDetailProps { token: string; teacher: Teacher; thisSunday: string }

async function load(token: string) {
  const student = await getStudent(db, token);
  if (!student) return { student: null, className: null };
  const klass = await getClass(db, student.classId);
  return { student, className: klass?.name ?? null };
}

/** 우리 반 → 학생 한 명: 이름·반·생일·연속 출석, 이번 학기 출석 달력, 학생 링크 보내기. */
export function StudentDetail({ token, teacher, thisSunday }: StudentDetailProps) {
  const one = useLoader(useCallback(() => load(token), [token]));
  // 출석 기록은 따로: 실패해도 이름·링크는 보인다
  const att = useLoader(useCallback(() => listStudentAttendance(db, token), [token]));
  const from = semesterStart(thisSunday);

  const back = (
    <div className={s.back}>
      <LinkButton href={teacherHref('class')} variant="ghost" size="sm" icon={<Icon name="back" size={18} />}>
        우리 반 목록
      </LinkButton>
    </div>
  );

  if (one.data === undefined) {
    return <>{back}{one.error ? <LoadError error={one.error} onRetry={one.reload} /> : <Loading />}</>;
  }
  const { student, className } = one.data;
  if (!student || !student.active) {
    return (
      <>
        {back}
        <EmptyState icon="userOff" title="학생을 찾지 못했어요">
          링크가 다시 만들어졌거나 비활성화된 학생이에요. 목록에서 다시 골라 주세요.
        </EmptyState>
      </>
    );
  }
  if (teacher.role !== 'admin' && !teacher.classIds.includes(student.classId)) {
    return (
      <>
        {back}
        <EmptyState icon="class" title="담당 반 학생이 아니에요">목록에서 우리 반 학생을 골라 주세요.</EmptyState>
      </>
    );
  }

  const streak = activeStreak(student, thisSunday);
  const birthdayWeek = student.birthday !== null && isBirthdayWeek(student.birthday, thisSunday);
  const presentCount = (att.data ?? []).filter((r) => r.present && r.date >= from && r.date <= thisSunday).length;

  return (
    <>
      {back}
      <Card as="section" className={s.me}>
        <h2 className={s.name}>{student.name}</h2>
        <dl className={s.facts}>
          <div><dt>반</dt><dd>{className ?? '반 없음'}</dd></div>
          <div>
            <dt>생일</dt>
            <dd>
              {student.birthday ? formatBirthday(student.birthday) : '등록하지 않았어요'}
              {birthdayWeek && <span className={s.cake}><Icon name="cake" size={18} />생일 주간</span>}
            </dd>
          </div>
          <div><dt>연속 출석</dt><dd className={s.num}>{streak}주</dd></div>
        </dl>
      </Card>

      <Card title="이번 학기 출석">
        {att.data === undefined ? (
          att.error ? <LoadError error={att.error} onRetry={att.reload} /> : <Loading />
        ) : (
          <>
            <p className={s.count}>이번 학기에 {presentCount}번 왔어요</p>
            <AttendanceCalendar records={att.data} from={from} to={thisSunday} />
          </>
        )}
      </Card>

      <Card title="학생 링크">
        <ShareLink token={token} name={student.name} />
      </Card>
    </>
  );
}
