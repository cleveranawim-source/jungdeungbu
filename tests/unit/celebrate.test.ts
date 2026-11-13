import { expect, test } from 'vitest';
import { birthdayCelebration, streakCelebration } from '../../src/lib/celebrate';

const base = { name: '김하늘', birthday: null as string | null, streak: 0, lastPresent: null as string | null };
const SUN = '2026-11-15';

test('해당 없으면 홈 생일·나 연속 출석 모두 없어요', () => {
  expect(birthdayCelebration(base, SUN)).toBeNull();
  expect(streakCelebration(base, SUN)).toBeNull();
});
test('홈 생일 주간: 이름 + 축하', () => {
  expect(birthdayCelebration({ ...base, birthday: '11-13' }, SUN)).toBe('김하늘, 생일을 축하해요');
  expect(birthdayCelebration({ ...base, name: '이바다', birthday: '11-18' }, SUN)).toBe('이바다, 생일을 축하해요');
  expect(birthdayCelebration({ ...base, birthday: '11-19' }, SUN)).toBeNull();
});
test('홈 생일은 주일 앞뒤 3일까지, 4일 차이는 제외해요', () => {
  for (const birthday of ['11-12', '11-18']) {
    expect(birthdayCelebration({ ...base, birthday }, SUN)).toBe('김하늘, 생일을 축하해요');
  }
  for (const birthday of ['11-11', '11-19']) {
    expect(birthdayCelebration({ ...base, birthday }, SUN)).toBeNull();
  }
});
test('나 연속 출석: 4의 배수이고 4 이상', () => {
  const at = (streak: number) => streakCelebration({ ...base, streak, lastPresent: SUN }, SUN);
  expect(at(4)).toBe('4주째 함께 예배했어요');
  expect(at(8)).toBe('8주째 함께 예배했어요');
  expect(at(12)).toBe('12주째 함께 예배했어요');
  expect(at(0)).toBeNull();
  expect(at(3)).toBeNull();
  expect(at(5)).toBeNull();
});
test('연속 출석은 최근 출석(이번 주일 또는 그 전 7일 안)일 때만', () => {
  expect(streakCelebration({ ...base, streak: 8, lastPresent: '2026-11-08' }, SUN)).toBe('8주째 함께 예배했어요');
  expect(streakCelebration({ ...base, streak: 8, lastPresent: '2026-10-25' }, SUN)).toBeNull();
});
test('두 조건을 만족해도 홈 생일과 나 연속 출석을 각각 요청해요', () => {
  const student = { ...base, birthday: '11-15', streak: 4, lastPresent: SUN };
  expect(birthdayCelebration(student, SUN)).toBe('김하늘, 생일을 축하해요');
  expect(streakCelebration(student, SUN)).toBe('4주째 함께 예배했어요');
});
test('연속 출석 축하는 activeStreak와 같은 기준(학생·교사 화면이 같은 값)', () => {
  const at = (lastPresent: string) => streakCelebration({ ...base, streak: 4, lastPresent }, SUN);
  expect(at(SUN)).toBe('4주째 함께 예배했어요');          // 이번 주일 출석
  expect(at('2026-11-08')).toBe('4주째 함께 예배했어요'); // 지난 주일까지, 이번 주일은 아직 기록 없음
  expect(at('2026-11-01')).toBeNull();                    // 두 주일 전 → 끊김
  expect(at('2026-11-22')).toBe('4주째 함께 예배했어요'); // 미래 출석의 기존 표시 기준도 유지
});
