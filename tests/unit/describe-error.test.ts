import { expect, test } from 'vitest';
import { describeError } from '../../src/app/Toast';

test('permission-denied', () =>
  expect(describeError({ code: 'permission-denied', message: 'x' })).toBe('권한이 없어요. 담당 반이 맞는지 확인해 주세요'));
test('firestore/ 접두어도 같은 뜻', () =>
  expect(describeError({ code: 'firestore/unavailable' })).toBe('연결이 끊겼어요. 연결을 확인한 뒤 다시 시도해 주세요'));
test('unavailable', () => expect(describeError({ code: 'unavailable' })).toBe('연결이 끊겼어요. 연결을 확인한 뒤 다시 시도해 주세요'));
test('그 외는 message', () => expect(describeError(new Error('뭔가 잘못'))).toBe('뭔가 잘못'));
test('message 없으면 기본 문구', () => expect(describeError(42)).toBe('문제가 생겼어요. 잠시 뒤 다시 해 주세요'));
test('학생에게는 권한 오류를 링크 다시 열기로 안내', () =>
  expect(describeError({ code: 'permission-denied' }, 'student')).toBe('링크를 다시 열어 주세요. 계속 안 되면 선생님께 말해 주세요'));
test('학생에게도 연결 오류는 같은 문구', () =>
  expect(describeError({ code: 'unavailable' }, 'student')).toBe('연결이 끊겼어요. 연결을 확인한 뒤 다시 시도해 주세요'));

test('읽기 오류는 재시도 안내와 저장 안내를 구분해요', () => {
  for (const code of ['unavailable', 'firestore/unavailable']) {
    expect(describeError({ code }, 'student', 'read')).toBe('연결이 끊겼어요. 연결을 확인한 뒤 다시 불러와 주세요');
    expect(describeError({ code }, 'teacher', 'read')).toBe('연결이 끊겼어요. 연결을 확인한 뒤 다시 불러와 주세요');
  }
  expect(describeError({ code: 'permission-denied' }, 'student', 'read')).toBe('링크를 다시 열어 주세요. 계속 안 되면 선생님께 말해 주세요');
});
