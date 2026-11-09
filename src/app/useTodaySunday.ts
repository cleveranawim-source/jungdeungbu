// "이번 주" 주일(yyyy-mm-dd). 화면이 열려 있는 동안은 고정이지만, 날이 바뀌거나
// 잠들었던 화면이 다시 보이면(휴대폰을 다시 켬) 다시 계산한다. 같은 값이면 다시 그리지 않는다.
import { useEffect, useState } from 'react';
import { nearestSunday, toDateId } from '../lib/dates';

/** 지금 시각의 "이번 주" 주일 ID. */
export function sundayIdAt(now: Date): string {
  return toDateId(nearestSunday(now));
}

/** 다음 날 0시(로컬)까지 남은 ms. 0시 정각을 살짝 넘긴 뒤 계산하도록 1초 더한다. */
export function msUntilNextDay(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime() + 1000;
}

export function useTodaySunday(): string {
  const [id, setId] = useState(() => sundayIdAt(new Date()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      setId(sundayIdAt(new Date()));
      clearTimeout(timer);
      timer = setTimeout(refresh, msUntilNextDay(new Date()));
    };
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    timer = setTimeout(refresh, msUntilNextDay(new Date()));
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return id;
}
