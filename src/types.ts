import type { Timestamp } from 'firebase/firestore';

export type Role = 'admin' | 'teacher';

export interface Teacher { email: string; name: string; role: Role; classIds: string[]; title?: string }
export interface Invite { name: string; role: Role; classIds: string[]; title?: string }
export interface ClassDoc { name: string; grade: number; order: number }
export interface Student { name: string; classId: string; birthday: string | null; active: boolean; streak: number; lastPresent: string | null; newcomer?: boolean }
export interface AttendanceDoc { date: string; present: boolean; by: string; at: Timestamp }
export interface OrderItem { type: string; title: string; detail: string; standing?: boolean }
export interface OpeningVerse { text: string; ref: string }
export interface ServerRole { role: string; name: string }
export interface Tally { present: number; total: number }
/** 공개 주보에 실리는 반 줄. 반 ID는 넣지 않는다(반 ID는 그 반 기도 제목을 여는 열쇠). */
export interface ClassCount extends Tally { name: string }
export interface AttendanceSummary { sunday: string; classes: ClassCount[]; students: Tally; teachers: Tally | null }
export interface Bulletin {
  date: string; order: OrderItem[]; hymns: string[]; scripture: string; sermonTitle: string; published: boolean; updatedBy: string; updatedAt: Timestamp;
  issue: string; leader: string; opening: OpeningVerse; nextServers: ServerRole[]; attendance: AttendanceSummary | null;
}
export interface Birthday { name: string; date: string /* mm-dd */ }
export interface BulletinMembers { newFriends: string[]; birthdays: Birthday[] }
export interface ChurchInfo {
  motto: { title: string; subtitle: string; verse: string; ref: string };
  etiquette: string[];
  place: { name: string; address: string; mapUrl: string };
  churchPhone: string;
}
export interface MemberInfo { servants: { role: string; names: string }[]; contacts: { label: string; phone: string }[] }
export interface Sermon { date: string; title: string; scripture: string; summary: string; body: string; questions: string[] }
export interface Announcement { title: string; body: string; startDate: string; endDate: string; pinned: boolean; createdAt: Timestamp }
export interface Prayer { authorUid: string; studentName: string; text: string; createdAt: Timestamp; classId?: string }
export interface StudentSession { token: string }
export interface BulletinTemplate { order: OrderItem[] }
export type WithId<T> = T & { id: string };

/** 종이 주보의 예배 순서 12줄. standing 은 서서 하는 순서(true 인 줄에만 둔다). */
export const DEFAULT_ORDER: OrderItem[] = [
  { type: '경배와 찬양', title: '', detail: '리조이스 찬양팀' },
  { type: '신앙고백', title: '사도신경', detail: '다함께', standing: true },
  { type: '영광찬송', title: '', detail: '다함께', standing: true },
  { type: '합심기도', title: '', detail: '다함께', standing: true },
  { type: '기도', title: '', detail: '', standing: true },
  { type: '봉헌', title: '', detail: '' },
  { type: '성경봉독', title: '', detail: '다함께' },
  { type: '설교', title: '', detail: '' },
  { type: '찬송', title: '', detail: '다함께', standing: true },
  { type: '축복기도', title: '', detail: '', standing: true },
  { type: '소식나눔', title: '', detail: '김형준 부장님' },
  { type: '축하나눔', title: '', detail: '학생임원' },
];

export const EMPTY_CHURCH_INFO: ChurchInfo = {
  motto: { title: '', subtitle: '', verse: '', ref: '' },
  etiquette: [],
  place: { name: '', address: '', mapUrl: '' },
  churchPhone: '',
};

export const EMPTY_BULLETIN_EXTRAS: Pick<Bulletin, 'issue' | 'leader' | 'opening' | 'nextServers' | 'attendance'> = {
  issue: '', leader: '', opening: { text: '', ref: '' }, nextServers: [], attendance: null,
};
