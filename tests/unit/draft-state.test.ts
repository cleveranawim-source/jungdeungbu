import { expect, test } from 'vitest';
import { afterSave, openDraft, type DraftState } from '../../src/admin/draftState';

interface F { k: string; title: string }
const comparable = (f: F) => f.title.trim();
const same = (a: F, b: F) => comparable(a) === comparable(b);
const isF = (x: unknown): x is F =>
  typeof x === 'object' && x !== null && typeof (x as F).k === 'string' && typeof (x as F).title === 'string';
const KEY = 'bulletin:2026-11-08';

const st = (base: F, value: F, recovered = false): DraftState<F> => ({ key: KEY, base, value, recovered });

test('afterSave: 저장 중에 더 고친 내용은 남고 계속 저장 안 한 상태', () => {
  const sent: F = { k: 'a', title: '보낸 제목' };
  // 보낸 뒤 더 고쳤다
  const prev = st({ k: 'a', title: '' }, { k: 'a', title: '보낸 제목 더 고침' });
  const next = afterSave(prev, KEY, sent, same)!;
  expect(next.base).toEqual(sent);
  expect(next.value.title).toBe('보낸 제목 더 고침');
  expect(same(next.value, next.base)).toBe(false);
});

test('afterSave: 더 고치지 않았으면 저장한 값으로, 저장 안 한 내용 없음', () => {
  const sent: F = { k: 'b', title: '보낸 제목' };
  const prev = st({ k: 'a', title: '' }, { k: 'a', title: '보낸 제목 ' }, true); // 끝 빈칸은 같은 내용
  const next = afterSave(prev, KEY, sent, same)!;
  expect(next.value).toEqual(sent);
  expect(next.base).toEqual(sent);
  expect(next.recovered).toBe(false);
});

test('afterSave: 그 사이 날짜가 바뀌었으면 아무것도 안 바꾼다', () => {
  const prev: DraftState<F> = { key: 'bulletin:2026-11-15', base: { k: 'x', title: '' }, value: { k: 'x', title: 'y' }, recovered: false };
  expect(afterSave(prev, KEY, { k: 'a', title: 'z' }, same)).toBe(prev);
  expect(afterSave(null, KEY, { k: 'a', title: 'z' }, same)).toBeNull();
});

test('openDraft: 저장값과 다른 복구본이면 복구', () => {
  const base = { k: 'a', title: '저장된' };
  const s = openDraft(null, KEY, base, { k: 'q', title: '쓰던 것' }, same, isF);
  expect(s).toEqual({ key: KEY, base, value: { k: 'q', title: '쓰던 것' }, recovered: true });
});

test('openDraft: 복구본이 없거나 저장값과 같으면 저장값', () => {
  const base = { k: 'a', title: '저장된' };
  expect(openDraft(null, KEY, base, null, same, isF)).toEqual({ key: KEY, base, value: base, recovered: false });
  expect(openDraft(null, KEY, base, { k: 'q', title: '저장된' }, same, isF).recovered).toBe(false);
});

test('openDraft: 모양이 깨진 복구본은 조용히 버린다', () => {
  const base = { k: 'a', title: '저장된' };
  for (const bad of [42, 'x', [], { title: 3 }, { k: 'a' }, { order: null }]) {
    expect(openDraft(null, KEY, base, bad, same, isF)).toEqual({ key: KEY, base, value: base, recovered: false });
  }
});

test('openDraft: 같은 날짜로 이미 열려 있으면 그대로', () => {
  const prev = st({ k: 'a', title: '' }, { k: 'a', title: '고치는 중' });
  expect(openDraft(prev, KEY, { k: 'z', title: '새로 불러온 값' }, null, same, isF)).toBe(prev);
});
