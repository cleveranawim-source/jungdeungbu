import type { ClassDoc, Student, WithId } from '../types';

/** 쉼표·따옴표·줄바꿈이 든 값은 따옴표로 감싸고 안의 따옴표는 두 번 쓴다. */
export function csvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * 출석 CSV. 헤더 `반,이름,{날짜…},출석수`, 앞에 UTF-8 BOM(엑셀이 한글을 깨지 않게).
 * students 는 활성 학생만 넘긴다 — byDate 에 있는 죽은 토큰(재발급·비활성)은 행이 없으므로 저절로 빠진다.
 * 행은 반 순서 → 이름순. 출석이면 O, 아니면(결석·기록 없음) 빈칸.
 */
export function attendanceCsv(
  students: WithId<Student>[],
  classes: WithId<ClassDoc>[],
  byDate: Map<string, Map<string, boolean>>,
  dates: string[],
): string {
  const classOf = new Map(classes.map((c) => [c.id, c]));
  const rank = (st: WithId<Student>) => classOf.get(st.classId)?.order ?? Number.MAX_SAFE_INTEGER;
  const rows = [...students].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'ko'));
  const lines = [['반', '이름', ...dates, '출석수'].map(csvCell).join(',')];
  for (const st of rows) {
    const marks = dates.map((d) => (byDate.get(d)?.get(st.id) === true ? 'O' : ''));
    const count = marks.filter(Boolean).length;
    lines.push([classOf.get(st.classId)?.name ?? '', st.name, ...marks, String(count)].map(csvCell).join(','));
  }
  return `﻿${lines.join('\n')}`;
}
