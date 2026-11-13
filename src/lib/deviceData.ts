// 공용 기기에서 선생님이 로그아웃할 때 이 기기에 남은 흔적을 지운다:
// 마지막으로 연 학생 링크(jdb:lastStudentToken), 편집 임시본(sessionStorage 의 jdb:draft:* — 주보 임시본에는
// 새 친구 이름·생일이 들어 있다), Firestore 오프라인 캐시.
// Firestore 를 직접 부르지 않고 지우는 일을 받아서 단위 시험할 수 있게 둔다(실제 연결은 lib/firebase.ts 의 clearLocalCache).
import { clearLastStudentToken, type KeyValueStorage } from './lastStudentToken';

/** 편집 화면(주보·설교)이 sessionStorage 에 적어 두는 임시본 키의 앞부분 */
export const DRAFT_STORE_PREFIX = 'jdb:draft:';

export type KeyListStorage = Pick<Storage, 'key' | 'removeItem'> & { readonly length: number };

function browserSession(): KeyListStorage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** sessionStorage 의 편집 임시본을 모두 지운다. 저장소가 막혀 있으면 조용히 넘어간다. */
export function clearEditorDrafts(session: KeyListStorage | null = browserSession()): void {
  try {
    if (!session) return;
    const keys: string[] = [];
    for (let i = 0; i < session.length; i++) {
      const k = session.key(i);
      if (k?.startsWith(DRAFT_STORE_PREFIX)) keys.push(k);
    }
    for (const k of keys) session.removeItem(k);
  } catch {
    // 무시
  }
}

export async function clearDeviceData(
  clearFirestoreCache: () => Promise<void>,
  storage?: KeyValueStorage | null,
  session?: KeyListStorage | null,
): Promise<void> {
  clearLastStudentToken(storage);
  clearEditorDrafts(session);
  try {
    await clearFirestoreCache();
  } catch {
    // 지우지 못해도(다른 탭이 열려 있음 등) 로그아웃은 이어 간다
  }
}
