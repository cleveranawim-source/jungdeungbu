// 학생 앱이 한 곳에서 가져다 쓰는 세션 함수: 익명 로그인 → bindStudentSession(db, uid, token).
import { signInAnonymously, type Auth } from 'firebase/auth';

export { bindStudentSession } from './prayers';

/** Firebase 익명 로그인. 이미 로그인돼 있으면 그 uid를 그대로 돌려준다. */
export async function signInStudentAnonymously(auth: Auth): Promise<string> {
  if (auth.currentUser?.isAnonymous) return auth.currentUser.uid;
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
}
