import type { ClassDoc, Student, WithId } from '../types';

export interface DateStat { date: string; present: number; total: number; rate: number | null }
export interface ClassStat { id: string; name: string; students: number; present: number; slots: number; rate: number | null }
export interface StudentStat { id: string; name: string; className: string; present: number; weeks: number }
export interface Stats { perDate: DateStat[]; perClass: ClassStat[]; perStudent: StudentStat[]; overall: number | null }

/** 0~100 정수(반올림). 분모가 0이면 null("-"로 보여 준다). */
export function percent(part: number, whole: number): number | null {
  return whole === 0 ? null : Math.round((part / whole) * 100);
}

/**
 * 출석 현황 계산(순수). 기준은 항상 활성 학생 목록이다 — byDate 에는 재발급·비활성으로 죽은 토큰도
 * 들어 있으므로 맵 크기는 쓰지 않고 학생마다 조회한다. 기록이 없으면 결석으로 센다.
 */
export function computeStats(
  students: WithId<Student>[],
  classes: WithId<ClassDoc>[],
  byDate: Map<string, Map<string, boolean>>,
  dates: string[],
): Stats {
  const ordered = [...classes].sort((a, b) => a.order - b.order);
  const classIndex = new Map(ordered.map((c, i) => [c.id, i]));
  const classOfStudent = new Map(students.map((st) => [st.id, st.classId]));
  const isHere = (d: string, id: string) => byDate.get(d)?.get(id) === true;

  const perDate = dates.map((date) => {
    const present = students.filter((st) => isHere(date, st.id)).length;
    return { date, present, total: students.length, rate: percent(present, students.length) };
  });

  const perStudent = students
    .map((st) => ({
      id: st.id,
      name: st.name,
      className: ordered.find((c) => c.id === st.classId)?.name ?? '반 없음',
      present: dates.filter((d) => isHere(d, st.id)).length,
      weeks: dates.length,
      idx: classIndex.get(st.classId) ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => a.idx - b.idx || a.name.localeCompare(b.name, 'ko'))
    .map(({ idx: _idx, ...rest }) => rest);

  const perClass = ordered.map((c) => {
    const mine = perStudent.filter((st) => classOfStudent.get(st.id) === c.id);
    const present = mine.reduce((n, st) => n + st.present, 0);
    const slots = mine.length * dates.length;
    return { id: c.id, name: c.name, students: mine.length, present, slots, rate: percent(present, slots) };
  });

  const present = perDate.reduce((n, d) => n + d.present, 0);
  return { perDate, perClass, perStudent, overall: percent(present, students.length * dates.length) };
}
