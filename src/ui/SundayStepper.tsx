import { useId } from 'react';
import { formatMonthDay, shiftDateId, weeksBetween } from '../lib/dates';
import { Button } from './Button';
import { Icon } from './icons';
import s from './SundayStepper.module.css';

function relativeWeek(n: number): string {
  if (n === 0) return '이번 주';
  if (n === -1) return '지난주';
  if (n === 1) return '다음 주';
  return n < 0 ? `${-n}주 전` : `${n}주 뒤`;
}

export interface SundayStepperProps {
  /** 지금 고른 주일(yyyy-mm-dd). 주일에서 7일씩만 움직이므로 주일만 고를 수 있다 */
  value: string;
  /** 이번 주일. "이번 주 / n주 뒤" 와 "오늘로" 의 기준 */
  thisSunday: string;
  onChange(id: string): void;
  /** 이보다 앞으로는 못 간다(포함) */
  earliest?: string;
  /** 이보다 뒤로는 못 간다(포함) */
  latest?: string;
  /** 묶음 이름(화면 읽기). 기본 "날짜" */
  label?: string;
  /** 라벨을 위에 보이게(폼 안에서 시작·끝처럼 둘 이상 있을 때) */
  showLabel?: boolean;
  /** 폼 안에서 쓰는 낮은 모양(날짜 글자 17px) */
  compact?: boolean;
}

/** 주일 고르기: ◀ 11월 9일 주일 ▶ + "이번 주" / "오늘로". 출석·주보·설교·광고가 함께 쓴다. */
export function SundayStepper({
  value, thisSunday, onChange, earliest, latest, label = '날짜', showLabel = false, compact = false,
}: SundayStepperProps) {
  const labelId = useId();
  const away = weeksBetween(thisSunday, value);
  const canBack = earliest === undefined || value > earliest;
  const canFwd = latest === undefined || value < latest;
  const inRange = (id: string) => (earliest === undefined || id >= earliest) && (latest === undefined || id <= latest);
  return (
    <div className={[s.wrap, compact && s.compact].filter(Boolean).join(' ')} role="group"
      aria-labelledby={showLabel ? labelId : undefined} aria-label={showLabel ? undefined : label}>
      {showLabel && <span className={s.label} id={labelId}>{label}</span>}
      <div className={s.stepper}>
        <Button variant="secondary" className={s.step} aria-label="지난 주일" icon={<Icon name="chevronLeft" />}
          disabled={!canBack} onClick={() => onChange(shiftDateId(value, -7))} />
        <div className={s.when}>
          <p className={s.date} role="status">{formatMonthDay(value)} 주일</p>
          <div className={s.rel}>
            <span>{relativeWeek(away)}</span>
            {away !== 0 && inRange(thisSunday) && (
              <Button variant="ghost" size="sm" className={s.today} icon={<Icon name="calendar" size={18} />}
                onClick={() => onChange(thisSunday)}>
                오늘로
              </Button>
            )}
          </div>
        </div>
        <Button variant="secondary" className={s.step} aria-label="다음 주일" icon={<Icon name="chevronRight" />}
          disabled={!canFwd} onClick={() => onChange(shiftDateId(value, 7))} />
      </div>
    </div>
  );
}
