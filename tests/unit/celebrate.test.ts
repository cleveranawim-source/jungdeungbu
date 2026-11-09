import { expect, test } from 'vitest';
import { celebrations } from '../../src/lib/celebrate';

const base = { name: '김하늘', birthday: null as string | null, streak: 0, lastPresent: null as string | null };
const SUN = '2026-11-15';

test('아무것도 없으면 빈 목록', () => expect(celebrations(base, SUN)).toEqual([]));
test('생일 주간: 부르는 말 + 축하', () => {
  expect(celebrations({ ...base, birthday: '11-13' }, SUN)).toEqual([{ kind: 'birthday', text: '🎂 김하늘아, 생일 축하해!' }]);
  expect(celebrations({ ...base, name: '이바다', birthday: '11-18' }, SUN)[0].text).toBe('🎂 이바다야, 생일 축하해!');
  expect(celebrations({ ...base, birthday: '11-19' }, SUN)).toEqual([]);
});
test('연속 출석: 4의 배수이고 4 이상', () => {
  const at = (streak: number) => celebrations({ ...base, streak, lastPresent: SUN }, SUN);
  expect(at(4)).toEqual([{ kind: 'streak', text: '🔥 4주 연속 출석! 꾸준함이 멋져' }]);
  expect(at(12)[0].text).toBe('🔥 12주 연속 출석! 꾸준함이 멋져');
  expect(at(0)).toEqual([]);
  expect(at(3)).toEqual([]);
  expect(at(5)).toEqual([]);
});
test('연속 출석은 최근 출석(이번 주일 또는 그 전 7일 안)일 때만', () => {
  // 토요일에 열면 이번 주일 = 내일, 마지막 출석 = 6일 전 → 아직 축하
  expect(celebrations({ ...base, streak: 8, lastPresent: '2026-11-08' }, SUN)).toHaveLength(1);
  // 몇 주 전에 멈춘 기록은 축하하지 않는다
  expect(celebrations({ ...base, streak: 8, lastPresent: '2026-10-25' }, SUN)).toEqual([]);
});
test('둘 다면 생일 먼저, 둘 다', () => {
  const xs = celebrations({ ...base, birthday: '11-15', streak: 4, lastPresent: SUN }, SUN);
  expect(xs.map((x) => x.kind)).toEqual(['birthday', 'streak']);
});
test('연속 출석 축하는 activeStreak 와 같은 기준(학생·교사 화면이 같은 값)', () => {
  const at = (lastPresent: string) => celebrations({ ...base, streak: 4, lastPresent }, SUN);
  expect(at(SUN)).toHaveLength(1);            // 이번 주일 출석
  expect(at('2026-11-08')).toHaveLength(1);   // 지난 주일까지, 이번 주일은 아직 기록 없음
  expect(at('2026-11-01')).toEqual([]);       // 두 주일 전 → 끊김
  expect(at('2026-11-22')).toHaveLength(1);   // 다음 주일을 미리 찍음(교사 화면도 그대로 보여 줌)
});
