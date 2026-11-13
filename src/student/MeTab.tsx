import { useCallback } from 'react';
import { useLoader } from '../app/useLoader';
import { listStudentAttendance } from '../data/attendance';
import { getClass } from '../data/classes';
import { emphasisParts, streakCelebration } from '../lib/celebrate';
import { formatBirthday, semesterStart } from '../lib/dates';
import { db } from '../lib/firebase';
import { activeStreak } from '../lib/streak';
import { AttendanceCalendar } from '../ui/AttendanceCalendar';
import { Card } from '../ui/Card';
import { JourneyLines } from '../ui/JourneyLines';
import { Icon } from '../ui/icons';
import { LoadError } from '../ui/LoadError';
import { Loading } from '../ui/Loading';
import type { StudentTabProps } from './types';
import s from './MeTab.module.css';

/** 나: 이름·반·생일, 이번 학기 출석 달력, 연속 출석. */
export function MeTab({ student, token, classId, sundayId }: StudentTabProps) {
  // 반 이름이 안 와도 나머지는 보이게 따로 불러온다
  const klass = useLoader(useCallback(() => getClass(db, classId), [classId]));
  const att = useLoader(useCallback(() => listStudentAttendance(db, token), [token]));
  const from = semesterStart(sundayId);
  const streak = activeStreak(student, sundayId);
  const celebration = streakCelebration(student, sundayId);
  const presentCount = (att.data ?? []).filter(
    (r) => r.present && r.date >= from && r.date <= sundayId,
  ).length;

  return (
    <div className={s.layout}>
      <Card as="section" className={s.me}>
        <JourneyLines />
        <h2 className={s.name}>{student.name}</h2>
        <dl className={s.facts}>
          <div>
            <dt>반</dt>
            <dd>
              {klass.data === undefined
                ? klass.error
                  ? '반 이름을 불러오지 못했어요'
                  : '…'
                : (klass.data?.name ?? '반 없음')}
            </dd>
          </div>
          <div>
            <dt>생일</dt>
            <dd>{student.birthday ? formatBirthday(student.birthday) : '선생님께 알려 주세요'}</dd>
          </div>
        </dl>
      </Card>

      <Card title="이번 학기 출석" tone="gold">
        {streak > 0 && (
          <div className={s.attendanceSummary}>
            <p className={s.streak}>
              연속 출석 <strong>{streak}주</strong>
            </p>
            {celebration && (
              <p className={s.acknowledgement}>
                <Icon name="calendar" size={20} />
                <span>{emphasisParts(celebration).map((part, i) => (
                  part.strong ? <strong key={i}>{part.text}</strong> : part.text
                ))}</span>
              </p>
            )}
          </div>
        )}
        {att.data === undefined ? (
          att.error ? (
            <LoadError error={att.error} onRetry={att.reload} audience="student" />
          ) : (
            <Loading />
          )
        ) : (
          <>
            <p className={s.count}>
              {presentCount > 0
                ? `이번 학기에 ${presentCount}번 왔어요`
                : '이번 학기 첫 출석을 기다리고 있어요'}
            </p>
            <AttendanceCalendar records={att.data} from={from} to={sundayId} />
          </>
        )}
      </Card>
    </div>
  );
}
