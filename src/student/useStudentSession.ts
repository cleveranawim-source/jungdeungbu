// 학생 기기의 익명 세션: 학생 문서가 열리면 뒤에서 조용히 익명 로그인 → studentSessions/{uid} 에 토큰을 묶는다.
// 읽기 화면은 이걸 기다리지 않는다. 기도 제목 올리기만 'ready' 를 필요로 한다.
// 이 기기의 익명 uid 가 이미 다른 학생 링크에 묶여 있으면(형제가 휴대폰을 같이 씀) 새 익명 uid 로 바꾼다(studentUidFor).
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { bindStudentSession, studentUidFor } from '../data/session';
import { ensureTeacher } from '../data/teachers';
import { auth, db } from '../lib/firebase';

/**
 * - pending: 로그인·묶는 중. SESSION_TIMEOUT_MS 안에 끝나지 않으면 failed 로 넘어간다
 * - ready: 올리기 가능
 * - failed: 익명 로그인 또는 묶기 실패(또는 시간 초과) → 올리기를 누르면 안내 후 retry.
 *   시간 초과 뒤에 묶기가 늦게라도 서버에 닿으면(오프라인 쓰기가 연결 뒤 전송) 그때 ready 가 된다
 * - teacher: 이 기기는 Google 로그인한 **등록된** 선생님 계정(teachers/{uid} 있음). 익명 로그인하면
 *   선생님이 로그아웃되므로 하지 않는다. Google 로그인은 했지만 교사가 아니면(초대 없는 계정)
 *   그 계정을 로그아웃하고 학생처럼 익명 세션으로 간다.
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
    setUid(null);
    const timer = setTimeout(() => {
      if (live()) setState((st) => (st === 'pending' ? 'failed' : st));
    }, SESSION_TIMEOUT_MS);
    try {
      await auth.authStateReady();
      if (!live()) return false;
      const cur = auth.currentUser;
      if (cur && !cur.isAnonymous) {
        // A different tab may have just signed in with an invite and not created
        // teachers/{uid} yet. Checking existence alone would log that teacher out.
        if (cur.email && await ensureTeacher(db, { uid: cur.uid, email: cur.email })) {
          if (live()) { setUid(null); setState('teacher'); }
          return false;
        }
        if (!live()) return false;
        // 초대 없는 Google 계정: 이 기기에 남겨 둘 이유가 없다. 로그아웃하고 익명으로
        if (auth.currentUser?.uid === cur.uid) await signOut(auth);
      }
      if (!live()) return false;
      // uid 는 이 링크의 것으로 정해진 뒤에만 내보낸다(앞 학생 uid 로 잠깐이라도 "내 글"이 보이지 않게)
      const id = await studentUidFor(auth, db, token);
      if (!live() || auth.currentUser?.uid !== id || !auth.currentUser.isAnonymous) return false;
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
    if (!enabled) return;
    let initial = true;
    let previousTeacher: string | null = null;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const teacher = user && !user.isAnonymous ? user.uid : null;
      // Ignore our own anonymous sign-in notification; rerunning it would race
      // the session binding. Teacher transitions, including another tab, must run.
      if (initial || teacher !== previousTeacher) void run();
      initial = false;
      previousTeacher = teacher;
    });
    return () => { seq.current++; unsubscribe(); };
  }, [enabled, run]);

  return { state, uid, retry: run };
}
