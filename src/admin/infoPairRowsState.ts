import type { Pair } from './PairRows';

/** fromPairs와 같은 저장값으로 다듬되 화면 key를 남겨 저장 중의 추가 편집도 구분한다. */
export const savedPairRows = (rows: Pair[]): Pair[] =>
  rows.map((row) => ({ ...row, a: row.a.trim(), b: row.b.trim() })).filter((row) => row.a || row.b);

export function pairRowStatus(row: Pair, saved: Pair[]): '새 줄' | '저장 전' | null {
  const original = saved.find((item) => item.k === row.k);
  if (!original) return row.a.trim() || row.b.trim() ? '저장 전' : '새 줄';
  return row.a.trim() !== original.a.trim() || row.b.trim() !== original.b.trim() ? '저장 전' : null;
}
