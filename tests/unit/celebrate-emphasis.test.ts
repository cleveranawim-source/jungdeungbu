import { expect, test } from 'vitest';
import { emphasisParts } from '../../src/lib/celebrate';

test('연속 출석 주수만 강조 조각으로 나눈다', () => {
  expect(emphasisParts('🔥 8주 연속 출석! 꾸준함이 멋져')).toEqual([
    { text: '🔥 ', strong: false },
    { text: '8주', strong: true },
    { text: ' 연속 출석! 꾸준함이 멋져', strong: false },
  ]);
});

test('숫자가 없으면 한 조각 그대로', () => {
  expect(emphasisParts('🎂 김하늘아, 생일 축하해!')).toEqual([{ text: '🎂 김하늘아, 생일 축하해!', strong: false }]);
});

test('두 자리 주수도 한 조각', () => {
  expect(emphasisParts('🔥 12주 연속 출석! 꾸준함이 멋져')[1]).toEqual({ text: '12주', strong: true });
});
