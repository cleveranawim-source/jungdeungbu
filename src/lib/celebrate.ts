// 홈의 생일 축하 / 나의 연속 출석 축하. 화면 없는 순수 함수라 단위 시험한다.
import type { Student } from '../types';
import { isBirthdayWeek } from './dates';
import { activeStreak } from './streak';

/** 홈: 생일이 주일 ±3일 안에 있을 때만 표시한다. */
export function birthdayCelebration(
  student: Pick<Student, 'name' | 'birthday'>,
  sundayId: string,
): string | null {
  return student.birthday && isBirthdayWeek(student.birthday, sundayId)
    ? `${student.name}, 생일을 축하해요`
    : null;
}

/**
 * 나: activeStreak(학생 나 탭·교사 화면과 같은 값)이 4의 배수이고 4 이상.
 * 마지막 출석이 이번 주일 7일 전보다 오래면 0이라 멈춘 기록으로 계속 축하하지 않는다.
 */
export function streakCelebration(
  student: Pick<Student, 'streak' | 'lastPresent'>,
  sundayId: string,
): string | null {
  const streak = activeStreak(student, sundayId);
  return streak >= 4 && streak % 4 === 0 ? `${streak}주째 함께 예배했어요` : null;
}

export interface EmphasisPart { text: string; strong: boolean }

/** 나의 축하 문구에서 "8주" 같은 주수만 강조 조각으로 나눈다. */
export function emphasisParts(text: string): EmphasisPart[] {
  return text
    .split(/(\d+주)/)
    .filter((t) => t !== '')
    .map((t) => ({ text: t, strong: /^\d+주$/.test(t) }));
}
