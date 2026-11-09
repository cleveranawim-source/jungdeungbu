// 교사 로그인 상태와 역할. Firebase 익명 사용자(학생 기기)는 교사 기준으로 '로그인 안 함'이다.
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ensureTeacher, signInAsEmulatorUser, signInWithGoogle } from '../data/teachers';
import { auth, clearLocalCache, db } from '../lib/firebase';
import type { Teacher } from '../types';
import { teacherHref } from './router';
import { describeError } from './Toast';

export type AuthStatus = 'loading' | 'signedOut' | 'notInvited' | 'ready';

export interface AuthUser { uid: string; email: string; name: string }

export interface AuthRole {
  status: AuthStatus;
  user: AuthUser | null;
  teacher: Teacher | null;
  /**
   * 교사 확인(ensureTeacher)이 오류로 끝났을 때의 안내 문장(describeError). 이때 status 는 'signedOut'.
   * 브리프 모양에 더한 필드다. 오류가 아니면 null.
   */
  error: string | null;
  signIn(): Promise<void>;
  signInEmu(email: string, name: string): Promise<void>;
  signOut(): Promise<void>;
}

type State = Pick<AuthRole, 'status' | 'user' | 'teacher' | 'error'>;

const SIGNED_OUT: State = { status: 'signedOut', user: null, teacher: null, error: null };

export function useAuthRole(): AuthRole {
  const [state, setState] = useState<State>({ status: 'loading', user: null, teacher: null, error: null });
  // 로그아웃 중(캐시 지우고 새로 불러오기 전): 로그인 화면이 잠깐 떴다가 새로 불러오며 깜빡이지 않게 화면을 그대로 둔다
  const leaving = useRef(false);

  useEffect(() => {
    let seq = 0; // 늦게 끝난 이전 사용자의 확인 결과가 덮어쓰지 않게
    const unsub = onAuthStateChanged(auth, (u: User | null) => {
      if (leaving.current) return;
      const my = ++seq;
      if (!u || u.isAnonymous) { setState(SIGNED_OUT); return; }
      const user: AuthUser = { uid: u.uid, email: u.email ?? '', name: u.displayName ?? '' };
      if (!user.email) { setState({ status: 'notInvited', user, teacher: null, error: null }); return; }
      setState({ status: 'loading', user, teacher: null, error: null });
      ensureTeacher(db, user).then(
        (teacher) => {
          if (my === seq) setState({ status: teacher ? 'ready' : 'notInvited', user, teacher, error: null });
        },
        (e: unknown) => {
          if (my === seq) setState({ status: 'signedOut', user, teacher: null, error: describeError(e) });
        },
      );
    });
    return () => { seq++; unsub(); };
  }, []);

  const signIn = useCallback(() => signInWithGoogle(auth), []);
  const signInEmu = useCallback((email: string, name: string) => signInAsEmulatorUser(auth, email, name), []);
  // 로그아웃 → 이 기기의 Firestore 캐시 지우기 → 교사 로그인 화면으로 새로 불러오기(지운 db 는 다시 쓸 수 없다).
  // 해시만 바꾸면 새로 불러오지 않으므로 주소를 바꾼 뒤 reload 한다.
  const signOut = useCallback(async () => {
    leaving.current = true;
    try {
      await fbSignOut(auth);
    } catch (e) {
      leaving.current = false;
      throw e;
    }
    await clearLocalCache();
    history.replaceState(null, '', teacherHref());
    location.reload();
  }, []);

  return { ...state, signIn, signInEmu, signOut };
}
