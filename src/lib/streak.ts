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
