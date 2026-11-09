import { expect, test } from 'vitest';
import { formatBirthday, formatMonthDay, sundaysBetween } from '../../src/lib/dates';

test('formatMonthDay: 앞의 0 없이', () => {
  expect(formatMonthDay('2026-11-08')).toBe('11월 8일');
  expect(formatMonthDay('2027-01-03')).toBe('1월 3일');
});
test('formatBirthday: MM-DD', () => expect(formatBirthday('03-05')).toBe('3월 5일'));
test('sundaysBetween: from 다음 첫 주일부터 to 까지(양끝 포함)', () => {
  expect(sundaysBetween('2026-09-01', '2026-09-27')).toEqual(['2026-09-06', '2026-09-13', '2026-09-20', '2026-09-27']);
  expect(sundaysBetween('2026-11-08', '2026-11-08')).toEqual(['2026-11-08']);
  expect(sundaysBetween('2026-11-09', '2026-11-08')).toEqual([]);
});
test('sundaysBetween: 한 학기(9월~이듬해 2월)는 26주 안팎', () => {
  const xs = sundaysBetween('2026-09-01', '2027-02-28');
  expect(xs[0]).toBe('2026-09-06');
  expect(xs.at(-1)).toBe('2027-02-28');
  expect(xs.length).toBe(26);
});
