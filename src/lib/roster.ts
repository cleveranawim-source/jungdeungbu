export type RosterRow = { name: string; className: string; birthday: string | null };

/** 생일 칸 → 'MM-DD'. 빈 칸은 null, 형식이 틀리면 undefined. ('3-5', '03/05', '0305' 모두 '03-05') */
export function normalizeBirthday(raw: string): string | null | undefined {
  if (raw === '') return null;
  const m = /^(\d{1,2})[-/](\d{1,2})$/.exec(raw) ?? /^(\d{2})(\d{2})$/.exec(raw);
  if (!m) return undefined;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseRoster(
  text: string,
  classNames: string[],
): { rows: RosterRow[]; errors: { line: number; message: string }[] } {
  const rows: RosterRow[] = [];
  const errors: { line: number; message: string }[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    if (raw.trim() === '') return;
    const line = i + 1;
    const [name = '', className = '', birthday = ''] = raw.split(/[\t,]/).map((c) => c.trim());
    if (name === '') {
      errors.push({ line, message: `${line}줄: 이름이 없어요` });
    } else if (!classNames.includes(className)) {
      errors.push({ line, message: `${line}줄: 반 '${className}'을(를) 찾을 수 없어요` });
    } else if (classNames.indexOf(className) !== classNames.lastIndexOf(className)) {
      // 같은 이름의 반이 둘 이상이면 어느 반인지 짐작하지 않는다
      errors.push({ line, message: `${line}줄: '${className}' 이름의 반이 둘 이상 있어요. 반·교사에서 이름을 바꿔 주세요` });
    } else {
      const normalized = normalizeBirthday(birthday);
      if (normalized === undefined) {
        errors.push({ line, message: `${line}줄: 생일 형식이 맞지 않아요 (MM-DD)` });
      } else {
        rows.push({ name, className, birthday: normalized });
      }
    }
  });
  return { rows, errors };
}
