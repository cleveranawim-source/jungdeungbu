import { expect, test } from 'vitest';
import { DEFAULT_TITLE, TITLE_PRESETS, vocative, withTitle } from '../../src/lib/korean';

test('받침 있으면 아', () => {
  expect(vocative('김하늘')).toBe('김하늘아');
  expect(vocative('최별')).toBe('최별아');
});
test('받침 없으면 야', () => {
  expect(vocative('이바다')).toBe('이바다야');
  expect(vocative('한빛나')).toBe('한빛나야');
});
test('한글이 아니면 야', () => {
  expect(vocative('Lee')).toBe('Lee야');
  expect(vocative('민준2')).toBe('민준2야');
});


test('호칭이 없거나 비면 선생님', () => {
  expect(withTitle('김하나')).toBe('김하나 선생님');
  expect(withTitle('김하나', '')).toBe('김하나 선생님');
  expect(withTitle('김하나', '   ')).toBe('김하나 선생님');
  expect(DEFAULT_TITLE).toBe('선생님');
});
test('호칭이 있으면 그 호칭', () => {
  expect(withTitle('이승열', '목사님')).toBe('이승열 목사님');
  expect(withTitle('박은혜', ' 부장 집사님 ')).toBe('박은혜 부장 집사님');
});
test('자주 쓰는 호칭 목록', () => {
  expect(TITLE_PRESETS).toEqual(['목사님', '전도사님', '선생님', '부장님']);
});
