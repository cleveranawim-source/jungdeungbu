import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Firestore,
  type QuerySnapshot,
} from 'firebase/firestore';
import type { Prayer, WithId } from '../types';

/** Firestore `in` 질의 한 번에 넣을 수 있는 값 수. */
const IN_LIMIT = 30;

const toPrayers = (snap: QuerySnapshot): WithId<Prayer>[] =>
  snap.docs.map((d) => ({ id: d.id, ...(d.data({ serverTimestamps: 'estimate' }) as Prayer) }));

const newestFirst = (a: Prayer, b: Prayer) => b.createdAt.toMillis() - a.createdAt.toMillis();

/**
 * 학생 기기(익명 로그인 uid)를 링크 토큰에 묶는다: studentSessions/{uid} = { token }.
 * 기도 제목을 올리기 전에 한 번. 같은 기기에서 다른 링크를 열면 덮어쓴다. 토큰이 비활성이면 거부.
 */
export async function bindStudentSession(db: Firestore, uid: string, token: string): Promise<void> {
  await setDoc(doc(db, 'studentSessions', uid), { token });
}

/**
 * 학생 기도 제목 올리기(uid = 익명 로그인 uid, 세션이 묶여 있어야 한다). 토큰은 저장하지 않는다.
 * - class: classes/{classId}/prayers 에 { authorUid, studentName, text, createdAt } — 같은 반 공개
 * - teachers: prayers 에 { authorUid, studentName, classId, text, createdAt } — 교사만 읽는다
 * studentName·classId는 세션이 가리키는 학생 문서와 같아야 규칙을 통과한다.
 */
export async function addPrayer(
  db: Firestore,
  uid: string,
  p: { studentName: string; classId: string; text: string; visibility: 'class' | 'teachers' },
): Promise<void> {
  const base = { authorUid: uid, studentName: p.studentName, text: p.text, createdAt: serverTimestamp() };
  if (p.visibility === 'class') {
    await addDoc(collection(db, 'classes', p.classId, 'prayers'), base);
  } else {
    await addDoc(collection(db, 'prayers'), { ...base, classId: p.classId });
  }
}

/** 반 ID를 아는 누구나. 최신순 최대 50개. */
export async function listClassPrayers(db: Firestore, classId: string): Promise<WithId<Prayer>[]> {
  const snap = await getDocs(
    query(collection(db, 'classes', classId, 'prayers'), orderBy('createdAt', 'desc'), limit(50)),
  );
  return toPrayers(snap);
}

/**
 * 교사만. "선생님만" 기도 중 classIds 반의 것, 최신순. classIds가 비면 질의 없이 [].
 * 30개씩 나눠 묻고 합친다. (복합 색인 prayers: classId ↑, createdAt ↓)
 */
export async function listTeacherPrayers(db: Firestore, classIds: string[]): Promise<WithId<Prayer>[]> {
  if (classIds.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < classIds.length; i += IN_LIMIT) chunks.push(classIds.slice(i, i + IN_LIMIT));
  const snaps = await Promise.all(
    chunks.map((ids) =>
      getDocs(query(collection(db, 'prayers'), where('classId', 'in', ids), orderBy('createdAt', 'desc'))),
    ),
  );
  return snaps.flatMap(toPrayers).sort(newestFirst);
}

/** 교사, 또는 글쓴이 본인(같은 익명 uid). */
export async function deleteClassPrayer(db: Firestore, classId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'classes', classId, 'prayers', id));
}

/** 교사만. */
export async function deleteTeacherPrayer(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, 'prayers', id));
}
