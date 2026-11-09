import { expect, test } from 'vitest';
import { formatAgo, formatBirthday, formatMonthDay, shiftDateId, sundaysBetween, weeksBetween } from '../../src/lib/dates';

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

test('shiftDateId: 달·해를 넘긴다', () => {
  expect(shiftDateId('2026-11-29', 7)).toBe('2026-12-06');
  expect(shiftDateId('2026-12-27', 7)).toBe('2027-01-03');
  expect(shiftDateId('2026-03-01', -7)).toBe('2026-02-22');
});
test('weeksBetween: 주 수, 앞이면 음수(서머타임 없는 로컬 날짜 기준 반올림)', () => {
  expect(weeksBetween('2026-11-08', '2026-12-06')).toBe(4);
  expect(weeksBetween('2026-11-08', '2026-11-01')).toBe(-1);
  expect(weeksBetween('2026-11-08', '2026-11-08')).toBe(0);
});
test('formatAgo: 방금·분·시간·일, 일주일 넘으면 날짜', () => {
  const now = new Date(2026, 10, 9, 12, 0, 0).getTime();
  expect(formatAgo(now - 20_000, now)).toBe('방금');
  expect(formatAgo(now + 5_000, now)).toBe('방금'); // 서버 시각이 살짝 앞서도
  expect(formatAgo(now - 3 * 60_000, now)).toBe('3분 전');
  expect(formatAgo(now - 59 * 60_000, now)).toBe('59분 전');
  expect(formatAgo(now - 2 * 3600_000, now)).toBe('2시간 전');
  expect(formatAgo(now - 4 * 86400_000, now)).toBe('4일 전');
  expect(formatAgo(new Date(2026, 10, 1, 9).getTime(), now)).toBe('11월 1일');
});
