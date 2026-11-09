import { expect, test } from 'vitest';
import { normalizeBirthday, parseRoster } from '../../src/lib/roster';

const classes = ['1반', '2반'];
test('탭·쉼표·빈 줄·공백', () => {
  const { rows, errors } = parseRoster('김하늘\t1반\t03-05\n\n  이바다 , 2반 , 1207 \n', classes);
  expect(errors).toEqual([]);
  expect(rows).toEqual([{ name: '김하늘', className: '1반', birthday: '03-05' }, { name: '이바다', className: '2반', birthday: '12-07' }]);
});
test('생일 생략', () => expect(parseRoster('박별\t1반', classes).rows[0].birthday).toBeNull());
test('M/D 정규화', () => expect(parseRoster('박별\t1반\t3/5', classes).rows[0].birthday).toBe('03-05'));
test('없는 반', () => expect(parseRoster('박별\t3반', classes).errors[0]).toEqual({ line: 1, message: "1줄: 반 '3반'을(를) 찾을 수 없어요" }));
test('이름 없음', () => expect(parseRoster('\t1반', classes).errors[0].message).toBe('1줄: 이름이 없어요'));
test('생일 형식 오류는 행 제외', () => {
  const { rows, errors } = parseRoster('박별\t1반\t13-45\n박별\t1반\t3월5일', classes);
  expect(rows).toEqual([]);
  expect(errors).toEqual([
    { line: 1, message: '1줄: 생일 형식이 맞지 않아요 (MM-DD)' },
    { line: 2, message: '2줄: 생일 형식이 맞지 않아요 (MM-DD)' },
  ]);
});

test('normalizeBirthday: 한 칸 생일(학생 추가 폼)', () => {
  expect(normalizeBirthday('3-5')).toBe('03-05');
  expect(normalizeBirthday('0305')).toBe('03-05');
  expect(normalizeBirthday('')).toBeNull();
  expect(normalizeBirthday('13-01')).toBeUndefined();
  expect(normalizeBirthday('삼월')).toBeUndefined();
});
