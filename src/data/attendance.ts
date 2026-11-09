import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { computeStreak } from '../lib/streak';
import type { AttendanceDoc } from '../types';

/**
 * 출석 토글(그 반 교사 또는 관리자). 그 학생 출석 기록 전체를 읽어 새 상태를 반영하고,
 * 출석 문서 { date, present, by: uid, at: serverTimestamp() }와 학생 문서 { streak, lastPresent }를 한 배치로 쓴다.
 *
 * streak 기준일은 dateId가 아니라 "기록된 가장 늦은 주일"이다(dateId 포함). 그래서 지난 날짜를 고쳐도
 * 현재 streak이 그 날짜 기준으로 바뀌지 않고, 어느 순서로 토글해도 최종 기록이 같으면 같은 값이 된다.
 */
export async function setAttendance(
  db: Firestore,
  uid: string,
  token: string,
  dateId: string,
  present: boolean,
): Promise<{ streak: number; lastPresent: string | null }> {
  const byDate = new Map<string, boolean>();
  for (const r of await listStudentAttendance(db, token)) byDate.set(r.date, r.present);
  byDate.set(dateId, present);

  const records = [...byDate].map(([date, p]) => ({ date, present: p }));
  const asOf = records.reduce((max, r) => (r.date > max ? r.date : max), dateId);
  const { streak, lastPresent } = computeStreak(records, asOf);

  const batch = writeBatch(db);
  batch.set(doc(db, 'students', token, 'attendance', dateId), {
    date: dateId,
    present,
    by: uid,
    at: serverTimestamp(),
  });
  batch.update(doc(db, 'students', token), { streak, lastPresent });
  await batch.commit();
  return { streak, lastPresent };
}

/** 토큰을 아는 사람(활성 학생) 또는 교사. 날짜 오름차순. */
export async function listStudentAttendance(db: Firestore, token: string): Promise<AttendanceDoc[]> {
  const snap = await getDocs(collection(db, 'students', token, 'attendance'));
  return snap.docs
    .map((d) => d.data({ serverTimestamps: 'estimate' }) as AttendanceDoc)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** 교사만. 그 주일의 전체 출석: 토큰 → present. 기록이 없는 학생은 맵에 없다. */
export async function listAttendanceByDate(db: Firestore, dateId: string): Promise<Map<string, boolean>> {
  const snap = await getDocs(query(collectionGroup(db, 'attendance'), where('date', '==', dateId)));
  const map = new Map<string, boolean>();
  for (const d of snap.docs) {
    const token = d.ref.parent.parent!.id;
    map.set(token, (d.data() as AttendanceDoc).present);
  }
  return map;
}
