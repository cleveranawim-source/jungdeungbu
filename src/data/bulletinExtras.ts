import type { Firestore } from 'firebase/firestore';
import { birthdaysInMonth, isFirstAttendance, summarizeAttendance } from '../lib/bulletin';
import { shiftDateId } from '../lib/dates';
import type { AttendanceSummary, BulletinMembers } from '../types';
import { listAttendanceByDate, listStudentAttendance } from './attendance';
import { listClasses } from './classes';
import { listStudents } from './students';

/** 주보 날짜 앞으로 이 주 수까지 거슬러 올라가며 출석 기록이 있는 주일을 찾는다. */
export const LOOKBACK_WEEKS = 8;

/**
 * 교사만. 에디터가 새 주보를 열 때 채울 값: 가장 최근 출석 주일의 반별 인원, 새 친구 이름, 이번 달 생일.
 * 출석은 주보 날짜 당일·이후는 보지 않는다. 기록이 없으면 attendance 는 null, 새 친구는 빈 목록.
 */
export async function loadBulletinExtras(
  db: Firestore,
  dateId: string,
): Promise<{ attendance: AttendanceSummary | null; members: BulletinMembers }> {
  // listStudents 는 활성 학생만 준다 — 죽은 토큰의 출석 기록은 집계에서 자연히 빠진다.
  const [students, classes] = await Promise.all([listStudents(db), listClasses(db)]);
  const birthdays = birthdaysInMonth(students, dateId);

  // 주일 수가 적고 대개 첫 번에 끝나므로 차례로 부른다.
  let attendance: AttendanceSummary | null = null;
  let present = new Map<string, boolean>();
  for (let n = 1; n <= LOOKBACK_WEEKS && attendance === null; n++) {
    const sunday = shiftDateId(dateId, -7 * n);
    present = await listAttendanceByDate(db, sunday);
    attendance = summarizeAttendance(sunday, students, classes, present);
  }
  if (attendance === null) return { attendance: null, members: { newFriends: [], birthdays } };

  const sunday = attendance.sunday;
  const candidates = students.filter((s) => s.newcomer === true && present.get(s.id) === true);
  const firsts = await Promise.all(
    candidates.map(async (s) => (isFirstAttendance(await listStudentAttendance(db, s.id), sunday) ? s.name : null)),
  );
  const newFriends = firsts.filter((n): n is string => n !== null).sort((a, b) => a.localeCompare(b, 'ko'));
  return { attendance, members: { newFriends, birthdays } };
}
