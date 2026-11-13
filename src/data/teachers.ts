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

/**
 * 로그인한 사용자의 교사 문서. 없으면 invites/{소문자 이메일}을 복사해 만든다.
 * 초대가 없으면(또는 읽을 권한이 없으면) null.
 */
export async function ensureTeacher(db: Firestore, user: { uid: string; email: string }): Promise<Teacher | null> {
  const ref = doc(db, 'teachers', user.uid);
  try {
    // getDoc uses the primary tab's shared watch stream, which can still carry the
    // previous anonymous token just after another tab logs in. A transaction uses
    // this tab's current credentials directly and makes concurrent registration atomic.
    return await runTransaction(db, async (transaction) => {
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
