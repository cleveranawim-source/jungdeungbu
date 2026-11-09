/** 부르는 말(호격 조사): 마지막 글자가 받침 있는 한글이면 "아", 그 밖(받침 없는 한글·한글 아님)은 "야". */
export function vocative(name: string): string {
  const last = name.trim().slice(-1);
  const code = last.charCodeAt(0);
  const hangul = code >= 0xac00 && code <= 0xd7a3;
  return `${name.trim()}${hangul && (code - 0xac00) % 28 !== 0 ? '아' : '야'}`;
}
