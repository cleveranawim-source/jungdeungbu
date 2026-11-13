import type { IconName } from '../ui/icons';

export type AdminSectionKey = 'bulletin' | 'sermon' | 'announcements' | 'info' | 'roster' | 'classes' | 'attendance';

export interface AdminSection {
  key: AdminSectionKey;
  label: string;
  /** 메뉴 줄의 설명(무엇을 하는 곳인지) */
  desc: string;
  icon: IconName;
}

/** 관리 메뉴(브리프 순서). `#/t/admin/{key}` */
export const ADMIN_SECTIONS: readonly AdminSection[] = [
  { key: 'bulletin', label: '주보 작성', desc: '예배 순서와 소식을 담아 주보를 게시해요', icon: 'bulletin' },
  { key: 'sermon', label: '설교 작성', desc: '말씀 요약과 나눔 질문을 올려요', icon: 'sermon' },
  { key: 'announcements', label: '광고', desc: '기간을 정해 학생 홈에 띄워요', icon: 'megaphone' },
  { key: 'info', label: '중등부 안내', desc: '표어·섬기는 분들·연락처를 고쳐요', icon: 'info' },
  { key: 'roster', label: '학생 명단', desc: '학생을 등록하고 링크를 보내요', icon: 'list' },
  { key: 'classes', label: '반·교사', desc: '반을 만들고 선생님을 초대해요', icon: 'class' },
  { key: 'attendance', label: '출석 현황', desc: '주일마다 반별 출석을 봐요', icon: 'chart' },
];

export function findAdminSection(sub: string | undefined): AdminSection | undefined {
  return ADMIN_SECTIONS.find((x) => x.key === sub);
}

interface AdminMenuGroup {
  title: string;
  description: string;
  keys: readonly AdminSectionKey[];
}

export const ADMIN_MENU_GROUPS: readonly AdminMenuGroup[] = [
  {
    title: '이번 주 준비',
    description: '예배의 순서와 말씀, 나눌 소식을 준비해요.',
    keys: ['bulletin', 'sermon', 'announcements'],
  },
  {
    title: '학생과 반',
    description: '학생을 맞이하고, 함께한 시간을 살펴요.',
    keys: ['roster', 'classes', 'attendance'],
  },
  { title: '상시 안내', description: '모든 주보에 함께 실리는 안내를 가꿔요.', keys: ['info'] },
];
