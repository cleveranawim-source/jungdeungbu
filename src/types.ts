import type { Timestamp } from 'firebase/firestore';

export type Role = 'admin' | 'teacher';

export interface Teacher { email: string; name: string; role: Role; classIds: string[] }
export interface Invite { name: string; role: Role; classIds: string[] }
export interface ClassDoc { name: string; grade: number; order: number }
export interface Student { name: string; classId: string; birthday: string | null; active: boolean; streak: number; lastPresent: string | null }
export interface AttendanceDoc { date: string; present: boolean; by: string; at: Timestamp }
export interface OrderItem { type: string; title: string; detail: string }
export interface Bulletin { date: string; order: OrderItem[]; hymns: string[]; scripture: string; sermonTitle: string; published: boolean; updatedBy: string; updatedAt: Timestamp }
export interface Sermon { date: string; title: string; scripture: string; summary: string; body: string; questions: string[] }
export interface Announcement { title: string; body: string; startDate: string; endDate: string; pinned: boolean; createdAt: Timestamp }
export interface Prayer { studentToken: string; studentName: string; text: string; hidden: boolean; createdAt: Timestamp; classId?: string }
export interface BulletinTemplate { order: OrderItem[] }
export type WithId<T> = T & { id: string };

export const DEFAULT_ORDER: OrderItem[] = ['묵도', '찬양', '기도', '성경 봉독', '설교', '헌금', '광고', '주기도문'].map(
  (type) => ({ type, title: '', detail: '' }),
);
