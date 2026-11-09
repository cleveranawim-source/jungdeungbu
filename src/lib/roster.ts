export type RosterRow = { name: string; className: string; birthday: string | null };

function normalizeBirthday(raw: string): string | null {
  if (raw === '') return null;
  const m = /^(\d{1,2})[-/](\d{1,2})$/.exec(raw) ?? /^(\d{2})(\d{2})$/.exec(raw);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
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
    } else {
      rows.push({ name, className, birthday: normalizeBirthday(birthday) });
    }
  });
  return { rows, errors };
}
