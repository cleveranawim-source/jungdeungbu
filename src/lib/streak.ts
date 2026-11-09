import { addDays, toDateId } from './dates';

export function computeStreak(
  records: { date: string; present: boolean }[],
  asOf: string,
): { streak: number; lastPresent: string | null } {
  const present = new Set(records.filter((r) => r.present).map((r) => r.date));
  let lastPresent: string | null = null;
  for (const date of present) if (lastPresent === null || date > lastPresent) lastPresent = date;

  const [y, m, d] = asOf.split('-').map(Number);
  let cursor = new Date(y, m - 1, d);
  let streak = 0;
  while (present.has(toDateId(cursor))) {
    streak++;
    cursor = addDays(cursor, -7);
  }
  return { streak, lastPresent };
}

/**
 * 화면에 보일 연속 출석. 학생 문서의 streak 은 그 학생의 마지막 기록 날짜 기준이라,
 * 안 온 주일(기록 없음)이 지나도 그대로 남는다. 마지막 출석이 이번 주일이거나 그 전 7일 안일 때만
 * 이어지는 중으로 보고, 아니면 0(지난 주일을 빠졌으니 끊김).
 */
export function activeStreak(student: { streak: number; lastPresent: string | null }, sundayId: string): number {
  if (student.lastPresent === null) return 0;
  const [y, m, d] = sundayId.split('-').map(Number);
  const weekAgo = toDateId(addDays(new Date(y, m - 1, d), -7));
  return student.lastPresent >= weekAgo ? student.streak : 0;
}
