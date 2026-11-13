// 편집 폼의 순수한 도움 함수(React·Firebase 없이 시험한다). editorUtils 가 그대로 다시 내보낸다.

/** 화면용 줄 key(움직여도 입력칸이 따라가게). sessionStorage 에서 되살린 줄과 겹치지 않게 무작위 */
export const newKey = (): string => Math.random().toString(36).slice(2, 10);

// ---------- sessionStorage 복구본 모양 검사 ----------

export const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isStr = (x: unknown): x is string => typeof x === 'string';
/** 모든 칸이 글자인 객체 */
export const hasStrings = (x: unknown, keys: readonly string[]): boolean => isObj(x) && keys.every((k) => isStr(x[k]));
/** 줄 목록: 배열이고 줄마다 key(k)와 글자 칸들 */
export const isRows = (x: unknown, keys: readonly string[]): boolean =>
  Array.isArray(x) && x.every((r) => hasStrings(r, ['k', ...keys]));
