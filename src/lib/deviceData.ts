// 공용 기기에서 선생님이 로그아웃할 때 이 기기에 남은 흔적을 지운다:
// 마지막으로 연 학생 링크(jdb:lastStudentToken)와 Firestore 오프라인 캐시.
// Firestore 를 직접 부르지 않고 지우는 일을 받아서 단위 시험할 수 있게 둔다(실제 연결은 lib/firebase.ts 의 clearLocalCache).
import { clearLastStudentToken, type KeyValueStorage } from './lastStudentToken';

export async function clearDeviceData(
  clearFirestoreCache: () => Promise<void>,
  storage?: KeyValueStorage | null,
): Promise<void> {
  clearLastStudentToken(storage);
  try {
    await clearFirestoreCache();
  } catch {
    // 지우지 못해도(다른 탭이 열려 있음 등) 로그아웃은 이어 간다
  }
}
