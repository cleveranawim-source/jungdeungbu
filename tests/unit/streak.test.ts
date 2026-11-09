import { expect, test } from 'vitest';
import { activeStreak, computeStreak } from '../../src/lib/streak';

const r = (date: string, present = true) => ({ date, present });
test('3주 연속', () => expect(computeStreak([r('2026-11-01'), r('2026-11-08'), r('2026-11-15')], '2026-11-15')).toEqual({ streak: 3, lastPresent: '2026-11-15' }));
test('중간 결석 문서(present:false)는 끊김', () => expect(computeStreak([r('2026-11-01'), r('2026-11-08', false), r('2026-11-15')], '2026-11-15').streak).toBe(1));
test('이번 주 미출석이면 0, lastPresent는 유지', () => expect(computeStreak([r('2026-11-08')], '2026-11-15')).toEqual({ streak: 0, lastPresent: '2026-11-08' }));
test('기록 없음', () => expect(computeStreak([], '2026-11-15')).toEqual({ streak: 0, lastPresent: null }));
test('순서 뒤섞여도 같다', () => expect(computeStreak([r('2026-11-15'), r('2026-11-01'), r('2026-11-08')], '2026-11-15').streak).toBe(3));

test('activeStreak: 마지막 출석이 이번 주일이나 그 전 7일 안이면 그대로', () => {
  const st = (streak: number, lastPresent: string | null) => ({ streak, lastPresent });
  expect(activeStreak(st(3, '2026-11-15'), '2026-11-15')).toBe(3);
  expect(activeStreak(st(3, '2026-11-08'), '2026-11-15')).toBe(3); // 이번 주는 아직 안 찍음
  expect(activeStreak(st(3, '2026-11-01'), '2026-11-15')).toBe(0); // 지난주에 빠짐 → 끊김
  expect(activeStreak(st(0, null), '2026-11-15')).toBe(0);
  expect(activeStreak(st(2, '2026-11-22'), '2026-11-15')).toBe(2); // 다음 주일을 미리 찍음
});

test('activeStreak 경계: 이번 주일 / 지난 주일(이번 주 기록 없음) / 두 주일 전', () => {
  const st = (lastPresent: string) => ({ streak: 4, lastPresent });
  expect(activeStreak(st('2026-11-15'), '2026-11-15')).toBe(4);
  expect(activeStreak(st('2026-11-08'), '2026-11-15')).toBe(4); // 7일 전까지 포함
  expect(activeStreak(st('2026-11-07'), '2026-11-15')).toBe(0); // 8일 전(주일 아님이지만 경계 확인)
  expect(activeStreak(st('2026-11-01'), '2026-11-15')).toBe(0);
});
