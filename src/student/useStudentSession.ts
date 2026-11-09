// 학생 기기의 익명 세션: 학생 문서가 열리면 뒤에서 조용히 익명 로그인 → studentSessions/{uid} 에 토큰을 묶는다.
// 읽기 화면은 이걸 기다리지 않는다. 기도 제목 올리기만 'ready' 를 필요로 한다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { bindStudentSession, signInStudentAnonymously } from '../data/session';
import { auth, db } from '../lib/firebase';

/**
 * - pending: 로그인·묶는 중(또는 오프라인이라 묶기가 서버에 닿기를 기다리는 중)
 * - ready: 올리기 가능
 * - failed: 익명 로그인 또는 묶기 실패 → 올리기를 누르면 안내 후 retry
 * - teacher: 이 기기는 Google 로그인한 선생님 계정. 익명 로그인하면 선생님이 로그아웃되므로 하지 않는다
 */
export type SessionState = 'pending' | 'ready' | 'failed' | 'teacher';

export interface StudentSession {
  state: SessionState;
  /** 익명 uid(내 글 판정). 로그인까지 됐으면 묶기가 실패해도 있다. 선생님 기기면 null */
  uid: string | null;
  /** 다시 시도. 끝나면 ready 인지 돌려준다 */
  retry(): Promise<boolean>;
}

export function useStudentSession(token: string, enabled: boolean): StudentSession {
  const [state, setState] = useState<SessionState>('pending');
  const [uid, setUid] = useState<string | null>(null);
  const seq = useRef(0);

  const run = useCallback(async (): Promise<boolean> => {
    const my = ++seq.current;
    const live = () => my === seq.current;
    setState('pending');
    try {
      await auth.authStateReady();
      const cur = auth.currentUser;
      if (cur && !cur.isAnonymous) {
        if (live()) { setUid(null); setState('teacher'); }
        return false;
      }
      const id = await signInStudentAnonymously(auth);
      if (!live()) return false;
      setUid(id);
      await bindStudentSession(db, id, token);
      if (live()) setState('ready');
      return live();
    } catch {
      if (live()) setState('failed');
      return false;
    }
  }, [token]);

  useEffect(() => {
    if (enabled) void run();
    return () => { seq.current++; };
  }, [enabled, run]);

  return { state, uid, retry: run };
}
