// 학생 홈의 축하 문구(생일 주간 / 연속 출석 4·8·12…주). 화면 없는 순수 함수라 단위 시험한다.
import type { Student } from '../types';
import { addDays, isBirthdayWeek, toDateId } from './dates';
import { vocative } from './korean';

export interface Celebration { kind: 'birthday' | 'streak'; text: string }

/**
 * - 생일: birthday 가 주일 ±3일 안 → "🎂 {이름}아/야, 생일 축하해!"
 * - 연속 출석: streak 이 4의 배수이고 4 이상, 그리고 마지막 출석이 이번 주일이거나 그 전 7일 안
 *   (streak 은 다음 출석 기록 때 다시 계산되므로, 몇 주 전에 멈춘 기록으로 계속 축하하지 않게).
 * 둘 다면 생일 먼저.
 */
export function celebrations(
  student: Pick<Student, 'name' | 'birthday' | 'streak' | 'lastPresent'>,
  sundayId: string,
): Celebration[] {
  const out: Celebration[] = [];
  if (student.birthday && isBirthdayWeek(student.birthday, sundayId)) {
    out.push({ kind: 'birthday', text: `🎂 ${vocative(student.name)}, 생일 축하해!` });
  }
  const [y, m, d] = sundayId.split('-').map(Number);
  const weekAgo = toDateId(addDays(new Date(y, m - 1, d), -7));
  const recent = student.lastPresent !== null && student.lastPresent >= weekAgo && student.lastPresent <= sundayId;
  if (student.streak >= 4 && student.streak % 4 === 0 && recent) {
    out.push({ kind: 'streak', text: `🔥 ${student.streak}주 연속 출석! 꾸준함이 멋져` });
  }
  return out;
}
