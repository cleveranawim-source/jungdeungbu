import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { weekContains } from '../lib/dates';
import { DEFAULT_ORDER, type Announcement, type Bulletin, type BulletinTemplate, type Sermon, type WithId } from '../types';

const TEMPLATE_PATH = 'settings/bulletinTemplate';

// ---------- 주보 (문서 ID = 주일 날짜) ----------

export async function getBulletin(db: Firestore, dateId: string): Promise<Bulletin | null> {
  const snap = await getDoc(doc(db, 'bulletins', dateId));
  return snap.exists() ? (snap.data({ serverTimestamps: 'estimate' }) as Bulletin) : null;
}

/** 관리자. 임시저장(published:false)과 게시 모두 이 함수. */
export async function saveBulletin(
  db: Firestore,
  uid: string,
  b: Omit<Bulletin, 'updatedBy' | 'updatedAt'>,
): Promise<void> {
  await setDoc(doc(db, 'bulletins', b.date), { ...b, updatedBy: uid, updatedAt: serverTimestamp() });
}

/** 게시된 주보만, 날짜 내림차순. (복합 색인 bulletins: published ↑, date ↓) */
export async function listBulletins(db: Firestore, max = 20): Promise<Bulletin[]> {
  const snap = await getDocs(
    query(collection(db, 'bulletins'), where('published', '==', true), orderBy('date', 'desc'), limit(max)),
  );
  return snap.docs.map((d) => d.data({ serverTimestamps: 'estimate' }) as Bulletin);
}

/** 관리자용: 임시저장 포함 전부, 날짜 내림차순. */
export async function listAllBulletins(db: Firestore): Promise<Bulletin[]> {
  const snap = await getDocs(query(collection(db, 'bulletins'), orderBy('date', 'desc')));
  return snap.docs.map((d) => d.data({ serverTimestamps: 'estimate' }) as Bulletin);
}

// ---------- 설교 (문서 ID = 주일 날짜) ----------

export async function getSermon(db: Firestore, dateId: string): Promise<Sermon | null> {
  const snap = await getDoc(doc(db, 'sermons', dateId));
  return snap.exists() ? (snap.data() as Sermon) : null;
}

export async function saveSermon(db: Firestore, s: Sermon): Promise<void> {
  await setDoc(doc(db, 'sermons', s.date), s);
}

export async function listSermons(db: Firestore, max = 20): Promise<Sermon[]> {
  const snap = await getDocs(query(collection(db, 'sermons'), orderBy('date', 'desc'), limit(max)));
  return snap.docs.map((d) => d.data() as Sermon);
}

// ---------- 광고 ----------

const byPinnedThenStart = (a: Announcement, b: Announcement) =>
  Number(b.pinned) - Number(a.pinned) || (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0);

/** 전체 광고, 시작일 내림차순. */
export async function listAnnouncements(db: Firestore): Promise<WithId<Announcement>[]> {
  const snap = await getDocs(query(collection(db, 'announcements'), orderBy('startDate', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data({ serverTimestamps: 'estimate' }) as Announcement) }));
}

/** dateId(주일)가 [startDate, endDate] 안에 드는 광고. 고정(pinned) 먼저, 그다음 시작일 내림차순. */
export async function activeAnnouncements(db: Firestore, dateId: string): Promise<WithId<Announcement>[]> {
  const snap = await getDocs(query(collection(db, 'announcements'), where('endDate', '>=', dateId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data({ serverTimestamps: 'estimate' }) as Announcement) }))
    .filter((a) => weekContains(dateId, a.startDate, a.endDate))
    .sort(byPinnedThenStart);
}

/** 관리자. id가 null이면 새로 만들고(createdAt = 서버 시각) 아니면 덮어쓴다(createdAt 유지). id를 돌려준다. */
export async function saveAnnouncement(
  db: Firestore,
  id: string | null,
  a: Omit<Announcement, 'createdAt'>,
): Promise<string> {
  if (id === null) {
    const ref = await addDoc(collection(db, 'announcements'), { ...a, createdAt: serverTimestamp() });
    return ref.id;
  }
  await setDoc(doc(db, 'announcements', id), a, { merge: true });
  return id;
}

export async function deleteAnnouncement(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, 'announcements', id));
}

// ---------- 주보 기본 템플릿 (settings/bulletinTemplate) ----------

export async function getTemplate(db: Firestore): Promise<BulletinTemplate> {
  const snap = await getDoc(doc(db, TEMPLATE_PATH));
  if (snap.exists()) return snap.data() as BulletinTemplate;
  return { order: DEFAULT_ORDER.map((item) => ({ ...item })) };
}

export async function saveTemplate(db: Firestore, t: BulletinTemplate): Promise<void> {
  await setDoc(doc(db, TEMPLATE_PATH), t);
}
