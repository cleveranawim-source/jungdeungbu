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

function fakeSession(entries: Record<string, string>): Pick<Storage, 'key' | 'removeItem'> & { readonly length: number; keys(): string[] } {
  const map = new Map(Object.entries(entries));
  return {
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => { map.delete(k); },
    keys: () => [...map.keys()],
  };
}

test('로그아웃 정리: 편집 임시본(jdb:draft:*)을 sessionStorage 에서 지우고 다른 키는 둔다', async () => {
  // 주보 임시본에는 새 친구 이름·생일이 들어 있다
  const session = fakeSession({
    'jdb:draft:bulletin:2026-11-15': '{"newFriends":"새봄"}',
    'jdb:draft:sermon:2026-11-15': '{}',
    'other:key': 'keep',
  });
  await clearDeviceData(async () => {}, fakeStorage(), session);
  expect(session.keys()).toEqual(['other:key']);
});
