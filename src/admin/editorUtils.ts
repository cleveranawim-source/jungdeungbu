import { useEffect, useState } from 'react';

export { hasStrings, isObj, isRows, newKey } from './formShape';

/** "n분 전" 이 흘러가게 30초마다 바뀌는 지금 시각 */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}
