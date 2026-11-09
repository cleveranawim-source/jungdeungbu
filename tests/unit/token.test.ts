import { expect, test } from 'vitest';
import { isToken, newToken } from '../../src/lib/token';

test('newToken 형식', () => { const t = newToken(); expect(t).toHaveLength(22); expect(isToken(t)).toBe(true); });
test('newToken 중복 없음(1000개)', () => expect(new Set(Array.from({length:1000}, newToken)).size).toBe(1000));
test('isToken 거부', () => { expect(isToken('abc')).toBe(false); expect(isToken('a'.repeat(22)+'=')).toBe(false); expect(isToken(null)).toBe(false); });
