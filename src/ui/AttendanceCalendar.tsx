import { formatMonthDay, sundaysBetween } from '../lib/dates';
import type { AttendanceDoc } from '../types';
import s from './AttendanceCalendar.module.css';

export interface AttendanceCalendarProps {
  records: AttendanceDoc[];
  /** 학기 시작(보통 `semesterStart(이번 주일)`). 이 날 이후 첫 주일부터 */
  from: string;
  /** 마지막 주일(보통 이번 주일). 이 칸에 "이번 주" 고리 */
  to: string;
}

/**
 * 주일만 모은 출석 달력. 달마다 한 줄(9월 ○ ○ · ○), 오래된 달이 위, 이번 주가 맨 끝.
 * 출석 = 남색(어두운 모드 금색) 채운 동그라미(날짜가 안에), 결석·기록 없음 = 같은 옅은 점(탓하지 않으려고 겉모습은 같다).
 * 칸마다 화면 읽기용 이름("11월 8일 출석" / "결석" / "기록 없음").
 */
export function AttendanceCalendar({ records, from, to }: AttendanceCalendarProps) {
  const byDate = new Map(records.map((r) => [r.date, r.present]));
  const months: { key: string; label: string; days: string[] }[] = [];
  for (const id of sundaysBetween(from, to)) {
    const key = id.slice(0, 7);
    let m = months.at(-1);
    if (!m || m.key !== key) {
      m = { key, label: `${Number(id.slice(5, 7))}월`, days: [] };
      months.push(m);
    }
    m.days.push(id);
  }

  return (
    <div className={s.calendar}>
      <ul className={s.legend} aria-hidden="true">
        <li><span className={[s.mark, s.present, s.mini].join(' ')} />출석</li>
        <li><span className={[s.mark, s.mini].join(' ')}><span className={s.dot} /></span>출석 기록 없음</li>
      </ul>
      {months.map((m) => (
        <div key={m.key} className={s.month}>
          <span className={s.monthLabel} aria-hidden="true">{m.label}</span>
          <ul className={s.days} aria-label={m.label}>
            {m.days.map((id) => {
              const v = byDate.get(id);
              const status = v === true ? '출석' : v === false ? '결석' : '기록 없음';
              const isTo = id === to;
              return (
                <li key={id}>
                  <span
                    role="img"
                    aria-label={`${formatMonthDay(id)} ${status}${isTo ? ', 이번 주' : ''}`}
                    className={[s.mark, v === true && s.present, isTo && s.current].filter(Boolean).join(' ')}
                  >
                    <span className={s.day}>{Number(id.slice(8))}</span>
                    {v !== true && <span className={s.dot} />}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
