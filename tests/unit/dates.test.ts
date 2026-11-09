import { expect, test } from 'vitest';
import { isBirthdayWeek, isDateId, nearestSunday, semesterStart, toDateId, weekContains } from '../../src/lib/dates';

test('토요일 23:59는 다음 날 주일', () => expect(toDateId(nearestSunday(new Date(2026,10,14,23,59)))).toBe('2026-11-15'));
test('일요일은 당일', () => expect(toDateId(nearestSunday(new Date(2026,10,15,10)))).toBe('2026-11-15'));
test('수요일은 지난 주일', () => expect(toDateId(nearestSunday(new Date(2026,10,18)))).toBe('2026-11-15'));
test('isDateId', () => { expect(isDateId('2026-11-15')).toBe(true); expect(isDateId('2026-1-5')).toBe(false); });
test('weekContains 양끝 포함', () => expect(weekContains('2026-11-15','2026-11-15','2026-11-15')).toBe(true));
test('생일 주간: 12-31 생일, 주일 01-03', () => expect(isBirthdayWeek('12-31','2027-01-03')).toBe(true));
test('생일 주간 아님', () => expect(isBirthdayWeek('03-10','2026-11-15')).toBe(false));
test('semesterStart 1월은 전년도 9월', () => expect(semesterStart('2027-01-10')).toBe('2026-09-01'));
