// 교사 로그인 상태와 역할. Firebase 익명 사용자(학생 기기)는 교사 기준으로 '로그인 안 함'이다.
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ensureTeacher, signInAsEmulatorUser, signInWithGoogle } from '../data/teachers';
import { auth, clearLocalCache, db, flushPendingWrites } from '../lib/firebase';
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
  /**
   * 로그아웃. 먼저 서버에 닿지 않은 쓰기(출석)를 SIGN_OUT_FLUSH_MS 동안 기다리고, 그래도 남아 있으면
   * 로그아웃하지 않고 'unsynced' 를 돌려준다(캐시를 지우면 그 출석을 잃는다). `force` 면 기다리지 않고 지운다.
   * 로그아웃하면 화면을 새로 불러오므로 그 경우엔 끝나지 않는다고 보면 된다.
   */
  signOut(force?: boolean): Promise<'unsynced' | void>;
  /** 관리 화면에서 내 이름·호칭을 바꾼 뒤 교사 문서를 다시 읽어 화면 위 이름 줄에 바로 반영한다. */
  refreshTeacher(): Promise<void>;
}

/** 로그아웃 전에 대기 중인 쓰기를 기다리는 시간 */
export const SIGN_OUT_FLUSH_MS = 4000;

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
  // 로그아웃 → (대기 중인 쓰기 확인) → 이 기기의 Firestore 캐시 지우기 → 교사 로그인 화면으로 새로 불러오기(지운 db 는 다시 쓸 수 없다).
  // 해시만 바꾸면 새로 불러오지 않으므로 주소를 바꾼 뒤 reload 한다.
  const signOut = useCallback(async (force = false): Promise<'unsynced' | void> => {
    if (!force && (await flushPendingWrites(SIGN_OUT_FLUSH_MS)) === 'timeout') return 'unsynced';
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

  const refreshTeacher = useCallback(async () => {
    const u = auth.currentUser;
    if (!u || u.isAnonymous || !u.email) return;
    const teacher = await ensureTeacher(db, { uid: u.uid, email: u.email });
    setState((s) => (s.user?.uid === u.uid && teacher ? { ...s, teacher } : s));
  }, []);

  return { ...state, signIn, signInEmu, signOut, refreshTeacher };
}
