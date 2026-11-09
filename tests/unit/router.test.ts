import { expect, test } from 'vitest';
import { parseHash, studentHref, teacherHref } from '../../src/app/router';

const T = 'AbCdEfGhIjKlMnOpQrSt_-'; // 22자 base64url

test('학생 경로', () => expect(parseHash('#/s/' + T + '/me')).toEqual({ kind: 'student', token: T, tab: 'me' }));
test('탭 생략은 home', () => {
  expect(parseHash('#/s/' + T)).toEqual({ kind: 'student', token: T, tab: 'home' });
  expect(parseHash('#/s/' + T + '/')).toEqual({ kind: 'student', token: T, tab: 'home' });
});
test('모르는 학생 탭은 home', () => expect(parseHash('#/s/' + T + '/nope')).toEqual({ kind: 'student', token: T, tab: 'home' }));
test('토큰 형식 틀리면 invalid', () => {
  expect(parseHash('#/s/abc').kind).toBe('invalid');
  expect(parseHash('#/s').kind).toBe('invalid');
  expect(parseHash('#/s/').kind).toBe('invalid');
  expect(parseHash('#/s/' + T + '=').kind).toBe('invalid');
});
test('교사 경로 기본 탭 attendance', () => {
  expect(parseHash('#/t')).toEqual({ kind: 'teacher', tab: 'attendance' });
  expect(parseHash('#/t/')).toEqual({ kind: 'teacher', tab: 'attendance' });
});
test('교사 탭', () => expect(parseHash('#/t/admin')).toEqual({ kind: 'teacher', tab: 'admin' }));
test('교사 탭 안의 화면', () => {
  expect(parseHash('#/t/admin/roster')).toEqual({ kind: 'teacher', tab: 'admin', sub: 'roster' });
  expect(parseHash('#/t/admin/')).toEqual({ kind: 'teacher', tab: 'admin' });
  expect('sub' in parseHash('#/t/admin')).toBe(false);
});
test('빈 해시는 landing', () => {
  expect(parseHash('')).toEqual({ kind: 'landing' });
  expect(parseHash('#')).toEqual({ kind: 'landing' });
  expect(parseHash('#/')).toEqual({ kind: 'landing' });
});
test('모르는 경로는 landing', () => expect(parseHash('#/x/y')).toEqual({ kind: 'landing' }));
test('studentHref', () => {
  expect(studentHref(T)).toBe('#/s/' + T);
  expect(studentHref(T, 'home')).toBe('#/s/' + T);
  expect(studentHref(T, 'prayer')).toBe('#/s/' + T + '/prayer');
  expect(parseHash(studentHref(T, 'sermon'))).toEqual({ kind: 'student', token: T, tab: 'sermon' });
});
test('teacherHref', () => {
  expect(teacherHref()).toBe('#/t');
  expect(teacherHref('prayer')).toBe('#/t/prayer');
  expect(teacherHref('admin', 'classes')).toBe('#/t/admin/classes');
  expect(parseHash(teacherHref('admin', 'roster'))).toEqual({ kind: 'teacher', tab: 'admin', sub: 'roster' });
});
test('학생 탭 안의 화면(지난 주보·설교 날짜)', () => {
  expect(parseHash('#/s/' + T + '/sermon/2026-11-08')).toEqual({ kind: 'student', token: T, tab: 'sermon', sub: '2026-11-08' });
  expect(parseHash('#/s/' + T + '/bulletin/')).toEqual({ kind: 'student', token: T, tab: 'bulletin' });
  expect('sub' in parseHash('#/s/' + T + '/me')).toBe(false);
  // 모르는 탭이면 sub 도 버리고 home
  expect(parseHash('#/s/' + T + '/nope/2026-11-08')).toEqual({ kind: 'student', token: T, tab: 'home' });
});
test('studentHref sub', () => {
  expect(studentHref(T, 'sermon', '2026-11-08')).toBe('#/s/' + T + '/sermon/2026-11-08');
  expect(parseHash(studentHref(T, 'bulletin', '2026-11-01'))).toEqual({ kind: 'student', token: T, tab: 'bulletin', sub: '2026-11-01' });
});
