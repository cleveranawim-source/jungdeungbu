// 학생 앱이 한 곳에서 가져다 쓰는 세션 함수: studentUidFor(auth, db, token) → bindStudentSession(db, uid, token).
import { signInAnonymously, signOut, type Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { getStudentSession } from './prayers';

export { bindStudentSession, getStudentSession } from './prayers';

/**
 * 이 링크(token)로 쓸 익명 uid.
 * 형제가 휴대폰 하나를 같이 쓰면 익명 uid 도 하나라서, 다음 학생이 앞 학생의 글을 "내 글"로 보고 지울 수 있다.
 * 그래서 지금 익명 uid 가 다른 링크에 묶여 있으면 로그아웃하고 새 익명 uid 를 받는다.
 * 묶인 적이 없거나 같은 링크면 지금 uid 그대로. (선생님 계정 기기는 부르는 쪽이 먼저 걸러 낸다.)
 */
export async function studentUidFor(auth: Auth, db: Firestore, token: string): Promise<string> {
  const cur = auth.currentUser;
  if (cur?.isAnonymous) {
    const session = await getStudentSession(db, cur.uid);
    if (session === null || session.token === token) return cur.uid;
    await signOut(auth);
  }
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}
