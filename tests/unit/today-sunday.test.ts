import { expect, test } from 'vitest';
import { msUntilNextDay, sundayIdAt } from '../../src/app/useTodaySunday';

test('sundayIdAt: 토요일 밤은 다음 날, 월요일 아침은 지난 주일', () => {
  expect(sundayIdAt(new Date(2026, 10, 14, 23, 59))).toBe('2026-11-15');
  expect(sundayIdAt(new Date(2026, 10, 15, 0, 0))).toBe('2026-11-15');
  expect(sundayIdAt(new Date(2026, 10, 16, 7, 30))).toBe('2026-11-15');
  expect(sundayIdAt(new Date(2026, 10, 21, 0, 0, 1))).toBe('2026-11-22');
});

test('msUntilNextDay: 다음 날 0시 + 1초', () => {
  expect(msUntilNextDay(new Date(2026, 10, 14, 23, 59, 0))).toBe(61_000);
  expect(msUntilNextDay(new Date(2026, 10, 14, 0, 0, 0))).toBe(24 * 3600_000 + 1000);
});

test('msUntilNextDay 뒤의 시각은 다음 날이다(월말·연말 포함)', () => {
  for (const now of [new Date(2026, 10, 30, 12), new Date(2026, 11, 31, 23, 59, 59)]) {
    const later = new Date(now.getTime() + msUntilNextDay(now));
    expect(later.getDate()).not.toBe(now.getDate());
    expect(later.getHours()).toBe(0);
  }
});
