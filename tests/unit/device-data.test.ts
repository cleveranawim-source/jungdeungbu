import { expect, test } from 'vitest';
import { clearDeviceData } from '../../src/lib/deviceData';
import { getLastStudentToken, setLastStudentToken, type KeyValueStorage } from '../../src/lib/lastStudentToken';

function fakeStorage(): KeyValueStorage {
  const map = new Map<string, string>();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: (k) => { map.delete(k); } };
}

test('로그아웃 정리: 마지막 학생 링크를 지우고 Firestore 캐시 지우기를 부른다', async () => {
  const st = fakeStorage();
  setLastStudentToken('abcdefghijklmnopqrstuv', st);
  let cleared = 0;
  await clearDeviceData(async () => { cleared++; }, st);
  expect(getLastStudentToken(st)).toBeNull();
  expect(cleared).toBe(1);
});

test('Firestore 캐시를 못 지워도 던지지 않고, 학생 링크는 지워져 있다', async () => {
  const st = fakeStorage();
  setLastStudentToken('abcdefghijklmnopqrstuv', st);
  await expect(clearDeviceData(async () => { throw new Error('failed-precondition'); }, st)).resolves.toBeUndefined();
  expect(getLastStudentToken(st)).toBeNull();
});
