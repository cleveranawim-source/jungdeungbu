import { useCallback, useEffect, useRef, useState } from 'react';

export interface Loaded<T> {
  /** 마지막으로 성공한 값. 다시 불러오는 동안에도 그대로 둔다(목록이 깜빡이지 않게). */
  data: T | undefined;
  /** 마지막 불러오기의 오류(describeError 로 보여 준다). 성공하면 null. */
  error: unknown;
  loading: boolean;
  reload(): Promise<void>;
}

/** 화면이 열릴 때 한 번 불러오고, 쓰기 뒤에는 reload(). `load` 는 useCallback 으로 고정해서 넘긴다. */
export function useLoader<T>(load: () => Promise<T>): Loaded<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    try {
      const v = await load();
      if (my === seq.current) { setData(v); setError(null); }
    } catch (e) {
      if (my === seq.current) setError(e);
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void reload();
    return () => { seq.current++; };
  }, [reload]);

  return { data, error, loading, reload };
}
