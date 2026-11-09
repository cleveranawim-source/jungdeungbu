// 이 기기에서 마지막으로 연 학생 링크의 토큰. 홈 화면에 추가한 앱은 start_url(`./`)로 열려 링크의 해시를 잃으므로
// 랜딩이 이 값으로 "내 화면 열기"를 보여 준다(저절로 옮겨 가지는 않는다: 선생님이 휴대폰을 같이 쓸 수 있다).
// 저장소가 막혀 있으면(사파리 개인 정보 보호 등) 조용히 아무것도 하지 않는다.
import { isToken } from './token';

export const LAST_STUDENT_TOKEN_KEY = 'jdb:lastStudentToken';

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** 저장된 토큰. 없거나 형식이 틀리면 null. */
export function getLastStudentToken(storage: KeyValueStorage | null = browserStorage()): string | null {
  try {
    const v = storage?.getItem(LAST_STUDENT_TOKEN_KEY) ?? null;
    return isToken(v) ? v : null;
  } catch {
    return null;
  }
}

export function setLastStudentToken(token: string, storage: KeyValueStorage | null = browserStorage()): void {
  if (!isToken(token)) return;
  try {
    storage?.setItem(LAST_STUDENT_TOKEN_KEY, token);
  } catch {
    // 저장 못 해도 앱은 그대로 돈다
  }
}

/** 지운다. `onlyIf` 를 주면 저장된 값이 그 토큰일 때만(닫힌 옛 링크를 치울 때). */
export function clearLastStudentToken(storage: KeyValueStorage | null = browserStorage(), onlyIf?: string): void {
  try {
    if (onlyIf !== undefined && storage?.getItem(LAST_STUDENT_TOKEN_KEY) !== onlyIf) return;
    storage?.removeItem(LAST_STUDENT_TOKEN_KEY);
  } catch {
    // 무시
  }
}
