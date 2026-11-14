import { expect, test } from 'vitest';
import { fromPairs, type Pair } from '../../src/admin/PairRows';
import { pairRowStatus, savedPairRows } from '../../src/admin/infoPairRowsState';

test('저장 기준은 기존 fromPairs와 같은 값이며 빈 줄만 빼고 UI key는 유지한다', () => {
  const rows: Pair[] = [
    { k: 'a', a: ' 교사 ', b: ' 고하람\n문새봄 ' },
    { k: 'b', a: ' 담당 ', b: ' ' },
    { k: 'c', a: '', b: ' 010-0000-0000 ' },
    { k: 'd', a: ' ', b: '\n' },
  ];
  const saved = savedPairRows(rows);
  expect(saved.map(({ a, b }) => ({ a, b }))).toEqual(fromPairs(rows));
  expect(saved.map((row) => row.k)).toEqual(['a', 'b', 'c']);
  expect(rows[0].a).toBe(' 교사 '); // 원래 편집값은 건드리지 않는다
});

test('저장 전 표시는 실제 저장값의 변경·되돌리기·새 줄을 구분한다', () => {
  const original = { k: 'a', a: '담당', b: '고하람' };
  const saved = [original, { k: 'b', a: '교사', b: '문새봄' }];
  expect(pairRowStatus({ ...original, b: '서가온' }, saved)).toBe('저장 전');
  expect(pairRowStatus({ ...original, b: ' 고하람 ' }, saved)).toBeNull();
  expect(pairRowStatus({ ...original, a: '', b: '' }, saved)).toBe('저장 전');
  expect(pairRowStatus({ k: 'new', a: '', b: '' }, saved)).toBe('새 줄');
  expect(pairRowStatus({ k: 'new', a: '', b: '고하람' }, saved)).toBe('저장 전');
  expect(pairRowStatus(saved[1], saved.slice(1))).toBeNull(); // 앞줄 삭제로 비교가 어긋나지 않는다
});

test('저장 중에 더 고친 행은 제출한 값과 비교해 저장 전으로 남는다', () => {
  const submitted = [{ k: 'a', a: '담당', b: '고하람' }];
  const saved = savedPairRows(submitted);
  expect(pairRowStatus({ ...submitted[0], b: '문새봄' }, saved)).toBe('저장 전');
  expect(pairRowStatus({ k: 'new', a: '교사', b: '서가온' }, saved)).toBe('저장 전');
});
