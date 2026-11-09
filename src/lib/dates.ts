const DATE_ID_RE = /^\d{4}-\d{2}-\d{2}$/;

const pad = (n: number) => String(n).padStart(2, '0');

function fromDateId(id: string): Date {
  const [y, m, d] = id.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toDateId(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isDateId(s: string): boolean {
  return DATE_ID_RE.test(s);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** 일 → 당일, 토 → 다음 날, 월~금 → 지난 일요일 (로컬 시간, 0시). */
export function nearestSunday(now: Date): Date {
  const day = now.getDay();
  const offset = day === 6 ? 1 : -day;
  return addDays(now, offset);
}

export function weekContains(dateId: string, startDate: string, endDate: string): boolean {
  return dateId >= startDate && dateId <= endDate;
}

/** birthday: MM-DD. 주일 ±3일(양끝 포함) 안이면 true. */
export function isBirthdayWeek(birthday: string, sundayId: string): boolean {
  const sunday = fromDateId(sundayId);
  const [m, d] = birthday.split('-').map(Number);
  const from = addDays(sunday, -3).getTime();
  const to = addDays(sunday, 3).getTime();
  return [-1, 0, 1].some((dy) => {
    const t = new Date(sunday.getFullYear() + dy, m - 1, d).getTime();
    return t >= from && t <= to;
  });
}

/** 3~8월 → 그 해 03-01, 9~12월 → 그 해 09-01, 1·2월 → 전년도 09-01. */
export function semesterStart(sundayId: string): string {
  const [y, m] = sundayId.split('-').map(Number);
  if (m >= 3 && m <= 8) return `${y}-03-01`;
  return `${m >= 9 ? y : y - 1}-09-01`;
}

/** "2026-11-08" → "11월 8일" */
export function formatMonthDay(dateId: string): string {
  const [, m, d] = dateId.split('-').map(Number);
  return `${m}월 ${d}일`;
}

/** 생일 "03-05" → "3월 5일" */
export function formatBirthday(mmdd: string): string {
  const [m, d] = mmdd.split('-').map(Number);
  return `${m}월 ${d}일`;
}

/** from 이후 첫 주일부터 to 까지의 주일 날짜(양끝 포함, 오름차순). */
export function sundaysBetween(from: string, to: string): string[] {
  const start = fromDateId(from);
  let cur = addDays(start, (7 - start.getDay()) % 7);
  const out: string[] = [];
  for (let id = toDateId(cur); id <= to; cur = addDays(cur, 7), id = toDateId(cur)) out.push(id);
  return out;
}
