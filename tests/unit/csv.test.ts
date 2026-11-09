import { expect, test } from 'vitest';
import { attendanceCsv } from '../../src/lib/csv';
import type { ClassDoc, Student, WithId } from '../../src/types';

const cls = (id: string, name: string, order: number): WithId<ClassDoc> => ({ id, name, grade: 1, order });
const stu = (id: string, name: string, classId: string): WithId<Student> => ({
  id, name, classId, birthday: null, active: true, streak: 0, lastPresent: null,
});
const D = ['2026-11-08', '2026-11-15'];
const byDate = (m: Record<string, Record<string, boolean>>) =>
  new Map(Object.entries(m).map(([d, r]) => [d, new Map(Object.entries(r))]));

test('CSV 헤더·BOM·출석수', () => {
  const s = attendanceCsv([stu('a', '김하늘', 'c1')], [cls('c1', '1반', 0)],
    byDate({ '2026-11-08': { a: true }, '2026-11-15': { a: false } }), D);
  expect(s.startsWith('﻿반,이름,2026-11-08,2026-11-15,출석수')).toBe(true);
  expect(s.split('\n')[1]).toBe('1반,김하늘,O,,1');
});

test('이름에 쉼표·따옴표·줄바꿈이 있으면 따옴표로 감싼다', () => {
  const s = attendanceCsv(
    [stu('a', '김, 하늘', 'c1'), stu('b', '이"별"', 'c1'), stu('c', '박\n달', 'c1')],
    [cls('c1', '1반', 0)], byDate({}), D);
  expect(s).toContain('1반,"김, 하늘",,,0');
  expect(s).toContain('1반,"이""별""",,,0');
  expect(s).toContain('1반,"박\n달",,,0');
});

test('반 순서 → 이름순, 죽은 토큰·기록 없는 학생은 빈칸', () => {
  const s = attendanceCsv(
    [stu('a', '다', 'c2'), stu('b', '나', 'c1'), stu('c', '가', 'c1')],
    [cls('c2', '2반', 1), cls('c1', '1반', 0)],
    byDate({ '2026-11-08': { a: true, dead: true, c: true } }), D);
  const lines = s.split('\n');
  expect(lines.slice(1)).toEqual(['1반,가,O,,1', '1반,나,,,0', '2반,다,O,,1']);
});

test('present=false 와 기록 없음 모두 빈칸', () => {
  const s = attendanceCsv([stu('a', '가', 'c1')], [cls('c1', '1반', 0)],
    byDate({ '2026-11-08': { a: false } }), D);
  expect(s.split('\n')[1]).toBe('1반,가,,,0');
});
