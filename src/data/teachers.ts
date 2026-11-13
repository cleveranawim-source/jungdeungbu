import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  type Auth,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocFromCache,
  runTransaction,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { USING_EMULATOR } from '../lib/env';
import type { Invite, Teacher, WithId } from '../types';
import { isPermissionDenied } from './errors';

/** invites 문서 ID = 소문자 이메일 (규칙의 myEmail()과 같다). */
const inviteId = (email: string) => email.trim().toLowerCase();

export async function signInWithGoogle(auth: Auth): Promise<void> {
  await signInWithPopup(auth, new GoogleAuthProvider());
}

/** 에뮬레이터 전용: 팝업 없이 가짜 Google 계정으로 로그인한다. */
export async function signInAsEmulatorUser(auth: Auth, email: string, name: string): Promise<void> {
  if (!USING_EMULATOR) throw new Error('signInAsEmulatorUser는 에뮬레이터에서만 쓸 수 있습니다');
  await signInWithCredential(
    auth,
    GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true, name })),
  );
}

/** 공유 연결이 새 계정으로 바뀌기를 기다리는 횟수·간격(합쳐 최대 약 3초) */
const STALE_STREAM_TRIES = 20;
const STALE_STREAM_GAP_MS = 150;

/**
 * 로그인한 사용자의 교사 문서. 없으면 invites/{소문자 이메일}을 복사해 만든다.
 * 초대가 없으면(또는 읽을 권한이 없으면) null.
 */
export async function ensureTeacher(db: Firestore, user: { uid: string; email: string }): Promise<Teacher | null> {
  const ref = doc(db, 'teachers', user.uid);
  // persistentMultipleTabManager 에서는 이 탭의 getDoc·getDocs 가 primary 탭의 Listen 연결로 간다.
  // 다른 탭(학생 링크)이 primary 이면 그 탭의 Auth 가 새 계정을 알아챌 때까지(IndexedDB 폴링, 최대 약 0.8초,
  // 백그라운드 탭이면 더 길게) 그 연결은 옛 익명 토큰을 실어 보낸다. 그래서 본인 문서조차 permission-denied 가 난다.
  let staleStream = false;
  try {
    // 기존 교사는 평소 경로(서버, 오프라인이면 캐시)로 읽는다.
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data() as Teacher;
  } catch (e) {
    if (!isPermissionDenied(e)) throw e;
    staleStream = true;
  }
  // transaction 은 공유 연결이 아니라 이 탭의 현재 자격으로 직접 RPC 를 보내고, 동시 등록도 원자적으로 만든다.
  let result: Teacher | null;
  try {
    result = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(ref);
      if (snap.exists()) return snap.data() as Teacher;
      const email = inviteId(user.email);
      let invite: Invite;
      try {
        const inv = await transaction.get(doc(db, 'invites', email));
        if (!inv.exists()) return null;
        invite = inv.data() as Invite;
      } catch (e) {
        if (isPermissionDenied(e)) return null;
        throw e;
      }
      const teacher: Teacher = { email, name: invite.name, role: invite.role, classIds: invite.classIds };
      if (invite.title) teacher.title = invite.title;
      transaction.set(ref, teacher);
      return teacher;
    });
  } catch (e) {
    // Preserve the existing offline entry for a previously loaded teacher. Never
    // use the cache to hide a permission failure or register a new teacher offline.
    const code = (e as { code?: string }).code;
    if (code === 'unavailable' || code === 'deadline-exceeded') {
      const cached = await getDocFromCache(ref).catch(() => null);
      if (cached?.exists()) return cached.data() as Teacher;
    }
    throw e;
  }
  if (result && staleStream) {
    // 교사 확인은 끝났지만 첫 화면(출석의 listClasses 등)은 다시 공유 연결로 읽는다. 그 연결이 아직 익명이면
    // "권한이 없어요"가 뜨고 화면은 다시 불러오지 않는다. 그래서 같은 본인 문서 읽기가 통과할 때까지 기다린다.
    // 막무가내 재시도가 아니다: 바로 위 직접 RPC 가 이 사용자가 교사임을 이미 확인했으므로, 본인 문서가 막히는
    // 이유는 공유 연결에 옛 자격이 남아 있다는 것뿐이다. 그 밖의 오류(오프라인 등)면 곧바로 그만두고,
    // 시간 안에 바뀌지 않아도 교사 확인 결과는 그대로 돌려준다(화면의 "다시 불러오기"가 남는다).
    // 이 기다림은 권한을 넓히지 않는다 — 무엇을 읽을 수 있는지는 여전히 firestore.rules 가 정한다.
    for (let i = 0; i < STALE_STREAM_TRIES; i++) {
      try {
        await getDoc(ref);
        break;
      } catch (e) {
        if (!isPermissionDenied(e)) break;
      }
      await new Promise((r) => setTimeout(r, STALE_STREAM_GAP_MS));
    }
  }
  return result;
}

/**
 * uid 가 등록된 교사인지(teachers/{uid} 가 있는지). 규칙은 본인 문서 get 을 허락하고,
 * 막히면(permission-denied) 교사가 아니라고 본다. 연결 오류 등 다른 오류는 그대로 던진다.
 */
export async function isRegisteredTeacher(db: Firestore, uid: string): Promise<boolean> {
  try {
    return (await getDoc(doc(db, 'teachers', uid))).exists();
  } catch (e) {
    if (isPermissionDenied(e)) return false;
    throw e;
  }
}

export async function listTeachers(db: Firestore): Promise<WithId<Teacher>[]> {
  const snap = await getDocs(collection(db, 'teachers'));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Teacher) }));
}

/** id = 소문자 이메일 */
export async function listInvites(db: Firestore): Promise<WithId<Invite>[]> {
  const snap = await getDocs(collection(db, 'invites'));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Invite) }));
}

/** 호칭은 앞뒤 빈칸을 지우고, 비면 칸 자체를 두지 않는다(화면에서 "선생님"). */
function cleanInvite(invite: Invite): Invite {
  const { title, ...rest } = invite;
  const t = title?.trim();
  return t ? { ...rest, title: t } : rest;
}

export async function saveInvite(db: Firestore, email: string, invite: Invite): Promise<void> {
  await setDoc(doc(db, 'invites', inviteId(email)), cleanInvite(invite));
}

/**
 * 이미 로그인한 교사의 이름·호칭·역할·담당 반을 바꾼다(관리자).
 * 교사 문서와 초대를 한 배치로 같게 맞춘다 — 초대가 다르면 교사 문서를 지웠다 다시 만들 때 옛 값으로 돌아간다.
 */
export async function saveTeacherProfile(db: Firestore, uid: string, email: string, profile: Invite): Promise<void> {
  const invite = cleanInvite(profile);
  const batch = writeBatch(db);
  batch.update(doc(db, 'teachers', uid), { ...invite, title: invite.title ?? deleteField() });
  batch.set(doc(db, 'invites', inviteId(email)), invite);
  await batch.commit();
}

export async function deleteInvite(db: Firestore, email: string): Promise<void> {
  await deleteDoc(doc(db, 'invites', inviteId(email)));
}

export async function updateTeacher(db: Firestore, uid: string, patch: Partial<Teacher>): Promise<void> {
  await updateDoc(doc(db, 'teachers', uid), patch);
}

/** 교사 내보내기: teachers/{uid}와 invites/{email}을 한 배치로 지운다(초대가 남으면 다시 등록된다). */
export async function removeTeacher(db: Firestore, uid: string, email: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'teachers', uid));
  batch.delete(doc(db, 'invites', inviteId(email)));
  await batch.commit();
}
