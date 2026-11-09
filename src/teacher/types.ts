import type { Teacher } from '../types';

/** TeacherApp 이 출석·우리 반·기도·주보 탭에 넘기는 값. 탭은 자기 데이터를 useLoader 로 스스로 불러온다. */
export interface TeacherTabProps {
  uid: string;
  teacher: Teacher;
  /** 이번 주일(yyyy-mm-dd). 화면이 열려 있는 동안 고정 */
  thisSunday: string;
  /** 탭 안의 화면(우리 반: 학생 토큰, 주보: 날짜) */
  sub?: string;
}
