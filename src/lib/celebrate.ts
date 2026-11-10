// 학생 홈의 축하 문구(생일 주간 / 연속 출석 4·8·12…주). 화면 없는 순수 함수라 단위 시험한다.
import type { Student } from '../types';
import { isBirthdayWeek } from './dates';
import { vocative } from './korean';
import { activeStreak } from './streak';

export interface Celebration { kind: 'birthday' | 'streak'; text: string }

/**
 * - 생일: birthday 가 주일 ±3일 안 → "🎂 {이름}아/야, 생일 축하해!"
 * - 연속 출석: activeStreak(학생 나 탭·교사 화면과 같은 값)이 4의 배수이고 4 이상.
 *   마지막 출석이 이번 주일 7일 전보다 오래면 0 이라 몇 주 전에 멈춘 기록으로 계속 축하하지 않는다.
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
  const streak = activeStreak(student, sundayId);
  if (streak >= 4 && streak % 4 === 0) {
    out.push({ kind: 'streak', text: `🔥 ${streak}주 연속 출석! 꾸준함이 멋져` });
  }
  return out;
}

export interface EmphasisPart { text: string; strong: boolean }

/** 축하 문구에서 "8주" 같은 주수만 강조 조각으로 나눈다(화면에서 금색 글자로 쓴다). */
export function emphasisParts(text: string): EmphasisPart[] {
  return text
    .split(/(\d+주)/)
    .filter((t) => t !== '')
    .map((t) => ({ text: t, strong: /^\d+주$/.test(t) }));
}
