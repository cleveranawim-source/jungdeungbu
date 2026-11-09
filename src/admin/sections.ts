import type { IconName } from '../ui/icons';

export type AdminSectionKey = 'bulletin' | 'sermon' | 'announcements' | 'roster' | 'classes' | 'attendance';

export interface AdminSection {
  key: AdminSectionKey;
  label: string;
  /** 메뉴 줄의 설명(무엇을 하는 곳인지) */
  desc: string;
  icon: IconName;
  /** 아직 만들지 않은 화면은 "준비 중" */
  ready: boolean;
}

/** 관리 메뉴(브리프 순서). `#/t/admin/{key}` */
export const ADMIN_SECTIONS: readonly AdminSection[] = [
  { key: 'bulletin', label: '주보 작성', desc: '예배 순서와 찬송을 채워요', icon: 'bulletin', ready: true },
  { key: 'sermon', label: '설교 작성', desc: '말씀 요약과 나눔 질문을 올려요', icon: 'sermon', ready: true },
  { key: 'announcements', label: '광고', desc: '기간을 정해 학생 홈에 띄워요', icon: 'megaphone', ready: false },
  { key: 'roster', label: '학생 명단', desc: '학생을 등록하고 링크를 보내요', icon: 'list', ready: true },
  { key: 'classes', label: '반·교사', desc: '반을 만들고 선생님을 초대해요', icon: 'class', ready: true },
  { key: 'attendance', label: '출석 현황', desc: '주일마다 반별 출석을 봐요', icon: 'chart', ready: false },
];

export function findAdminSection(sub: string | undefined): AdminSection | undefined {
  return ADMIN_SECTIONS.find((x) => x.key === sub);
}
