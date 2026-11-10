/** 부르는 말(호격 조사): 마지막 글자가 받침 있는 한글이면 "아", 그 밖(받침 없는 한글·한글 아님)은 "야". */
export function vocative(name: string): string {
  const last = name.trim().slice(-1);
  const code = last.charCodeAt(0);
  const hangul = code >= 0xac00 && code <= 0xd7a3;
  return `${name.trim()}${hangul && (code - 0xac00) % 28 !== 0 ? '아' : '야'}`;
}

/** 호칭이 없을 때 붙는 기본 호칭. */
export const DEFAULT_TITLE = '선생님';
/** 관리 화면에서 눌러 고르는 자주 쓰는 호칭. 그 밖의 호칭은 직접 적는다(10자 이하). */
export const TITLE_PRESETS: readonly string[] = ['목사님', '전도사님', '선생님', '부장님'];
/** 호칭 최대 길이(firestore.rules 의 validTitle 과 같다). */
export const TITLE_MAX = 10;

/** "이승열 목사님"처럼 이름 뒤에 호칭을 붙인다. 호칭이 없거나 비면 "선생님". */
export function withTitle(name: string, title?: string | null): string {
  return `${name} ${title?.trim() || DEFAULT_TITLE}`;
}
