import { expect, test } from 'vitest';
import { parseRoster } from '../../src/lib/roster';

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
