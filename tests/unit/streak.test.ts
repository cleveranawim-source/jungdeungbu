import { expect, test } from 'vitest';
import { computeStreak } from '../../src/lib/streak';

const r = (date: string, present = true) => ({ date, present });
test('3주 연속', () => expect(computeStreak([r('2026-11-01'), r('2026-11-08'), r('2026-11-15')], '2026-11-15')).toEqual({ streak: 3, lastPresent: '2026-11-15' }));
test('중간 결석 문서(present:false)는 끊김', () => expect(computeStreak([r('2026-11-01'), r('2026-11-08', false), r('2026-11-15')], '2026-11-15').streak).toBe(1));
test('이번 주 미출석이면 0, lastPresent는 유지', () => expect(computeStreak([r('2026-11-08')], '2026-11-15')).toEqual({ streak: 0, lastPresent: '2026-11-08' }));
test('기록 없음', () => expect(computeStreak([], '2026-11-15')).toEqual({ streak: 0, lastPresent: null }));
test('순서 뒤섞여도 같다', () => expect(computeStreak([r('2026-11-15'), r('2026-11-01'), r('2026-11-08')], '2026-11-15').streak).toBe(3));
