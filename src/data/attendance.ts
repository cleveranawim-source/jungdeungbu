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
 *
 * 반환: 다시 계산해 저장한 { streak, lastPresent }. 단 출석 기록을 오프라인 캐시에서 읽었으면
 * (metadata.fromCache) 기록이 일부뿐일 수 있으므로 **출석 문서만 쓰고 학생 문서는 건드리지 않으며 null**을 돌려준다
 * — 화면은 기존 streak을 그대로 보여 주면 된다(다음 온라인 토글 때 전체 기록으로 다시 계산된다).
 * 오프라인에서는 쓰기가 서버에 닿을 때까지 이 Promise가 끝나지 않으므로, 화면은 결과를 기다리며 막지 말 것.
 */
export async function setAttendance(
  db: Firestore,
  uid: string,
  token: string,
  dateId: string,
  present: boolean,
): Promise<{ streak: number; lastPresent: string | null } | null> {
  const snap = await getDocs(collection(db, 'students', token, 'attendance'));

  const batch = writeBatch(db);
  batch.set(doc(db, 'students', token, 'attendance', dateId), {
    date: dateId,
    present,
    by: uid,
    at: serverTimestamp(),
  });

  if (snap.metadata.fromCache) {
    await batch.commit();
    return null;
  }

  const byDate = new Map<string, boolean>();
  for (const d of snap.docs) {
    const r = d.data() as AttendanceDoc;
    byDate.set(r.date, r.present);
  }
  byDate.set(dateId, present);
  const records = [...byDate].map(([date, p]) => ({ date, present: p }));
  const asOf = records.reduce((max, r) => (r.date > max ? r.date : max), dateId);
  const { streak, lastPresent } = computeStreak(records, asOf);

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

/**
 * 교사만. 그 주일의 출석 기록: 토큰 → present. 기록이 없는 학생은 맵에 없다.
 * 주의: 재발급·비활성으로 죽은 옛 토큰의 기록도 함께 나온다(옛 문서의 출석은 지우지 않으므로).
 * 호출하는 쪽은 반드시 listStudents(활성만)의 학생 목록을 기준으로 이 맵을 조회해야 하며,
 * map.size를 출석 인원으로 쓰면 안 된다.
 */
export async function listAttendanceByDate(db: Firestore, dateId: string): Promise<Map<string, boolean>> {
  const snap = await getDocs(query(collectionGroup(db, 'attendance'), where('date', '==', dateId)));
  const map = new Map<string, boolean>();
  for (const d of snap.docs) {
    const token = d.ref.parent.parent!.id;
    map.set(token, (d.data() as AttendanceDoc).present);
  }
  return map;
}
