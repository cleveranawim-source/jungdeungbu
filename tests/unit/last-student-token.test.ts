import { expect, test } from 'vitest';
import {
  clearLastStudentToken,
  getLastStudentToken,
  LAST_STUDENT_TOKEN_KEY,
  setLastStudentToken,
  type KeyValueStorage,
} from '../../src/lib/lastStudentToken';

const TOKEN = 'abcdefghijklmnopqrstuv'; // 22자
const OTHER = 'ABCDEFGHIJKLMNOPQRSTUV';

function fakeStorage(): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
    removeItem: (k) => { map.delete(k); },
  };
}

const broken: KeyValueStorage = {
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('QuotaExceededError'); },
  removeItem: () => { throw new Error('SecurityError'); },
};

test('저장 → 읽기 → 지우기', () => {
  const st = fakeStorage();
  expect(getLastStudentToken(st)).toBeNull();
  setLastStudentToken(TOKEN, st);
  expect(st.map.get(LAST_STUDENT_TOKEN_KEY)).toBe(TOKEN);
  expect(getLastStudentToken(st)).toBe(TOKEN);
  clearLastStudentToken(st);
  expect(getLastStudentToken(st)).toBeNull();
});

test('형식이 틀린 값은 저장하지 않고, 저장돼 있어도 null', () => {
  const st = fakeStorage();
  setLastStudentToken('short', st);
  expect(st.map.size).toBe(0);
  st.map.set(LAST_STUDENT_TOKEN_KEY, '../../evil');
  expect(getLastStudentToken(st)).toBeNull();
});

test('onlyIf: 저장된 값이 그 토큰일 때만 지운다', () => {
  const st = fakeStorage();
  setLastStudentToken(TOKEN, st);
  clearLastStudentToken(st, OTHER);
  expect(getLastStudentToken(st)).toBe(TOKEN);
  clearLastStudentToken(st, TOKEN);
  expect(getLastStudentToken(st)).toBeNull();
});

test('저장소가 막혀 있거나 없어도 던지지 않는다', () => {
  expect(() => setLastStudentToken(TOKEN, broken)).not.toThrow();
  expect(getLastStudentToken(broken)).toBeNull();
  expect(() => clearLastStudentToken(broken)).not.toThrow();
  expect(getLastStudentToken(null)).toBeNull();
});
