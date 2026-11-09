import { collection, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { newToken } from '../lib/token';
import type { ClassDoc, WithId } from '../types';

/** 교사만(list 규칙). order 오름차순. */
export async function listClasses(db: Firestore): Promise<WithId<ClassDoc>[]> {
  const snap = await getDocs(query(collection(db, 'classes'), orderBy('order')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ClassDoc) }));
}

/** 반 ID를 아는 누구나(학생 화면의 반 이름). 없으면 null. */
export async function getClass(db: Firestore, id: string): Promise<ClassDoc | null> {
  const snap = await getDoc(doc(db, 'classes', id));
  return snap.exists() ? (snap.data() as ClassDoc) : null;
}

/** 관리자. 반 ID는 추측 불가능한 22자 난수. */
export async function createClass(db: Firestore, data: ClassDoc): Promise<string> {
  const id = newToken();
  await setDoc(doc(db, 'classes', id), data);
  return id;
}

export async function updateClass(db: Firestore, id: string, patch: Partial<ClassDoc>): Promise<void> {
  await updateDoc(doc(db, 'classes', id), patch);
}
