// 학생 기기의 익명 세션: 학생 문서가 열리면 뒤에서 조용히 익명 로그인 → studentSessions/{uid} 에 토큰을 묶는다.
// 읽기 화면은 이걸 기다리지 않는다. 기도 제목 올리기만 'ready' 를 필요로 한다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { bindStudentSession, signInStudentAnonymously } from '../data/session';
import { auth, db } from '../lib/firebase';

/**
 * - pending: 로그인·묶는 중. SESSION_TIMEOUT_MS 안에 끝나지 않으면 failed 로 넘어간다
 * - ready: 올리기 가능
 * - failed: 익명 로그인 또는 묶기 실패(또는 시간 초과) → 올리기를 누르면 안내 후 retry.
 *   시간 초과 뒤에 묶기가 늦게라도 서버에 닿으면(오프라인 쓰기가 연결 뒤 전송) 그때 ready 가 된다
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

/** 오프라인·느린 연결에서 pending 이 끝없이 이어지지 않게: 이 시간이 지나면 failed(다시 시도 가능) */
export const SESSION_TIMEOUT_MS = 8000;

export function useStudentSession(token: string, enabled: boolean): StudentSession {
  const [state, setState] = useState<SessionState>('pending');
  const [uid, setUid] = useState<string | null>(null);
  const seq = useRef(0);

  const run = useCallback(async (): Promise<boolean> => {
    const my = ++seq.current;
    const live = () => my === seq.current;
    setState('pending');
    const timer = setTimeout(() => {
      if (live()) setState((st) => (st === 'pending' ? 'failed' : st));
    }, SESSION_TIMEOUT_MS);
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
    } finally {
      clearTimeout(timer);
    }
  }, [token]);

  useEffect(() => {
    if (enabled) void run();
    return () => { seq.current++; };
  }, [enabled, run]);

  return { state, uid, retry: run };
}
