import { expect, test } from 'vitest';
import { emphasisParts } from '../../src/lib/celebrate';

test('연속 출석 주수만 강조 조각으로 나눈다', () => {
  expect(emphasisParts('8주째 함께 예배했어요')).toEqual([
    { text: '8주', strong: true },
    { text: '째 함께 예배했어요', strong: false },
  ]);
});

test('숫자가 없으면 한 조각 그대로', () => {
  expect(emphasisParts('김하늘, 생일을 축하해요')).toEqual([{ text: '김하늘, 생일을 축하해요', strong: false }]);
});

test('두 자리 주수도 한 조각', () => {
  expect(emphasisParts('12주째 함께 예배했어요')[0]).toEqual({ text: '12주', strong: true });
});
