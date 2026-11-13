import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
  type Firestore,
  type QueryConstraint,
} from 'firebase/firestore';
import { newToken } from '../lib/token';
import type { AttendanceDoc, Student, WithId } from '../types';
import { isPermissionDenied } from './errors';

/** 한 배치 500 쓰기 한도보다 조금 작게. */
export const BATCH_LIMIT = 490;

type NewStudent = { name: string; classId: string; birthday: string | null; newcomer?: boolean };

const studentRef = (db: Firestore, token: string) => doc(db, 'students', token);

const freshStudent = (data: NewStudent): Student => ({
  name: data.name,
  classId: data.classId,
  birthday: data.birthday,
  active: true,
  streak: 0,
  lastPresent: null,
  ...(data.newcomer === true ? { newcomer: true } : {}),
});

/**
 * 학생 문서. 없는 토큰이나 비활성 토큰이면 null — 교사가 아니면 규칙상 둘 다 permission-denied라
 * 구분하지 않는다(교사에게는 비활성 문서도 그대로 돌려준다). 그 밖의 오류는 그대로 던진다.
 */
export async function getStudent(db: Firestore, token: string): Promise<Student | null> {
  try {
    const snap = await getDoc(studentRef(db, token));
    return snap.exists() ? (snap.data() as Student) : null;
  } catch (e) {
    if (isPermissionDenied(e)) return null;
    throw e;
  }
}

/** 교사만. 활성 학생, classId를 주면 그 반만. 이름순. */
export async function listStudents(db: Firestore, classId?: string): Promise<WithId<Student>[]> {
  const constraints: QueryConstraint[] = [where('active', '==', true)];
  if (classId !== undefined) constraints.push(where('classId', '==', classId));
  const snap = await getDocs(query(collection(db, 'students'), ...constraints));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Student) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

/** 관리자. 새 토큰(= 학생 링크)을 돌려준다. */
export async function createStudent(db: Firestore, data: NewStudent): Promise<string> {
  const token = newToken();
  await setDoc(studentRef(db, token), freshStudent(data));
  return token;
}

export async function updateStudent(db: Firestore, token: string, patch: Partial<Student>): Promise<void> {
  await updateDoc(studentRef(db, token), patch);
}

export async function deactivateStudent(db: Firestore, token: string): Promise<void> {
  await updateDoc(studentRef(db, token), { active: false });
}

/**
 * 관리자. 링크 재발급: 새 토큰 문서(같은 이름·반·생일·새 친구 표시·streak·lastPresent, active:true)와
 * 출석 기록 복사본(원래 by·at 유지)을 만들고, 옛 문서를 active:false로. 새 토큰을 돌려준다.
 * 보통 한 배치. 출석이 BATCH_LIMIT건을 넘으면 여러 배치로 나누되 옛 문서 비활성은 마지막 배치에 둔다
 * (중간에 실패해도 옛 링크가 살아 있어 다시 시도할 수 있다).
 */
export async function reissueToken(db: Firestore, token: string): Promise<string> {
  const oldSnap = await getDoc(studentRef(db, token));
  if (!oldSnap.exists()) throw new Error(`학생 ${token}을(를) 찾을 수 없습니다`);
  const old = oldSnap.data() as Student;
  const attendance = await getDocs(collection(db, 'students', token, 'attendance'));

  const next = newToken();
  const writes: ((b: ReturnType<typeof writeBatch>) => void)[] = [];
  const nextStudent: Student = {
    name: old.name,
    classId: old.classId,
    birthday: old.birthday,
    active: true,
    streak: old.streak,
    lastPresent: old.lastPresent,
    ...(old.newcomer === true ? { newcomer: true } : {}),
  };
  writes.push((b) => b.set(studentRef(db, next), nextStudent));
  for (const d of attendance.docs) {
    const a = d.data({ serverTimestamps: 'estimate' }) as AttendanceDoc;
    const copy: AttendanceDoc = { date: a.date, present: a.present, by: a.by, at: a.at };
    const ref: DocumentReference = doc(db, 'students', next, 'attendance', d.id);
    writes.push((b) => b.set(ref, copy));
  }
  writes.push((b) => b.update(studentRef(db, token), { active: false }));

  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const w of writes.slice(i, i + BATCH_LIMIT)) w(batch);
    await batch.commit();
  }
  return next;
}

/** 관리자. 일괄 등록. rows 순서대로 새 토큰을 돌려준다. */
export async function bulkCreateStudents(db: Firestore, rows: NewStudent[]): Promise<string[]> {
  const tokens = rows.map(() => newToken());
  for (let i = 0; i < rows.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    rows.slice(i, i + BATCH_LIMIT).forEach((row, j) => batch.set(studentRef(db, tokens[i + j]), freshStudent(row)));
    await batch.commit();
  }
  return tokens;
}
