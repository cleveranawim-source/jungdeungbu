import type { Student } from '../types';
import type { SessionState } from './useStudentSession';

/** StudentApp 이 모든 탭에 넘기는 값. 탭은 자기 데이터를 useLoader 로 스스로 불러온다. */
export interface StudentTabProps {
  student: Student;
  token: string;
  classId: string;
  /** 이번 주일(yyyy-mm-dd) */
  sundayId: string;
  /** 탭 안의 화면(주보·말씀 탭의 날짜) */
  sub?: string;
  /** 익명 uid(내 글 판정). 선생님 기기거나 아직 로그인 전이면 null */
  myUid: string | null;
  sessionState: SessionState;
  retrySession(): Promise<boolean>;
}
