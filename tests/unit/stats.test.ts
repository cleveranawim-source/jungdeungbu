import { expect, test } from 'vitest';
import { computeStats, percent } from '../../src/admin/stats';
import type { ClassDoc, Student, WithId } from '../../src/types';

const cls = (id: string, name: string, order: number): WithId<ClassDoc> => ({ id, name, grade: 1, order });
const stu = (id: string, name: string, classId: string): WithId<Student> => ({
  id, name, classId, birthday: null, active: true, streak: 0, lastPresent: null,
});
const D = ['2026-11-08', '2026-11-15'];
const classes = [cls('c2', '2반', 1), cls('c1', '1반', 0)];
const students = [stu('a', '가', 'c1'), stu('b', '나', 'c1'), stu('c', '다', 'c2')];
const byDate = new Map([
  ['2026-11-08', new Map([['a', true], ['b', false], ['dead', true], ['dead2', true]])],
  ['2026-11-15', new Map([['a', true], ['c', true]])],
]);

test('percent: 반올림, 분모 0은 null', () => {
  expect(percent(1, 3)).toBe(33);
  expect(percent(0, 0)).toBeNull();
});

test('날짜별: 죽은 토큰은 세지 않는다', () => {
  const s = computeStats(students, classes, byDate, D);
  expect(s.perDate).toEqual([
    { date: '2026-11-08', present: 1, total: 3, rate: 33 },
    { date: '2026-11-15', present: 2, total: 3, rate: 67 },
  ]);
  expect(s.overall).toBe(50);
});

test('반별 평균과 학생별(반 순서 → 이름순)', () => {
  const s = computeStats(students, classes, byDate, D);
  expect(s.perClass.map((c) => [c.name, c.students, c.rate])).toEqual([['1반', 2, 50], ['2반', 1, 50]]);
  expect(s.perStudent.map((x) => [x.className, x.name, x.present])).toEqual([
    ['1반', '가', 2], ['1반', '나', 0], ['2반', '다', 1],
  ]);
});

test('학생·기간이 비면 null', () => {
  const s = computeStats([], classes, new Map(), D);
  expect(s.overall).toBeNull();
  expect(s.perClass[0].rate).toBeNull();
});
