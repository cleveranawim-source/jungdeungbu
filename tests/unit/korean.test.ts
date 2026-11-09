import { expect, test } from 'vitest';
import { vocative } from '../../src/lib/korean';

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
