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
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { weekContains } from '../lib/dates';
import { isPermissionDenied } from './errors';
import {
  DEFAULT_ORDER,
  EMPTY_BULLETIN_EXTRAS,
  type Announcement,
  type AttendanceSummary,
  type Bulletin,
  type BulletinMembers,
  type BulletinTemplate,
  type Sermon,
  type Tally,
  type WithId,
} from '../types';

const TEMPLATE_PATH = 'settings/bulletinTemplate';

// ---------- 주보 (문서 ID = 주일 날짜) ----------

/**
 * 공개 주보에 실을 출석 요약. 반 줄은 이름·인원만 골라 담는다 — 반 ID(그 반 기도 제목을 여는 열쇠)나
 * 다른 칸이 섞여 와도 버린다. 반 줄이 하나도 없으면 싣지 않는다(학생 0/0 금지).
 */
export function publicAttendance(a: AttendanceSummary | null | undefined): AttendanceSummary | null {
  if (!a || !Array.isArray(a.classes) || a.classes.length === 0) return null;
  const tally = (t: Tally): Tally => ({ present: t.present, total: t.total });
  return {
    sunday: a.sunday,
    classes: a.classes.map((c) => ({ name: c.name, present: c.present, total: c.total })),
    students: tally(a.students),
    teachers: a.teachers ? tally(a.teachers) : null,
  };
}

/**
 * 새 칸이 생기기 전에 저장된 옛 주보도 깨지지 않게, 없는 칸을 빈 값으로 채운다(공유 객체를 건드리지 않게 복사).
 * 출석의 반 줄에 옛·손으로 넣은 반 ID가 있으면 여기서 버린다(폼으로 들어가 다시 저장되지 않게).
 */
export function normalizeBulletin(raw: Partial<Bulletin> & Pick<Bulletin, 'date'>): Bulletin {
  const e = EMPTY_BULLETIN_EXTRAS;
  return {
    order: [],
    hymns: [],
    scripture: '',
    sermonTitle: '',
    published: false,
    updatedBy: '',
    updatedAt: undefined as unknown as Bulletin['updatedAt'],
    ...raw,
    issue: raw.issue ?? e.issue,
    leader: raw.leader ?? e.leader,
    opening: raw.opening ?? { ...e.opening },
    nextServers: raw.nextServers ?? [],
    attendance: raw.attendance ? publicAttendance(raw.attendance) : e.attendance,
  };
}

const readBulletin = (d: { data: (o: { serverTimestamps: 'estimate' }) => unknown }) =>
  normalizeBulletin(d.data({ serverTimestamps: 'estimate' }) as Bulletin);

/** 없는 주보, 그리고 교사가 아닌 사람에게 임시저장 주보(규칙이 permission-denied)는 null. */
export async function getBulletin(db: Firestore, dateId: string): Promise<Bulletin | null> {
  try {
    const snap = await getDoc(doc(db, 'bulletins', dateId));
    return snap.exists() ? readBulletin(snap) : null;
  } catch (e) {
    if (isPermissionDenied(e)) return null;
    throw e;
  }
}

/**
 * 시험·시드 전용(src 에는 부르는 곳이 없다). **주보 편집 화면에서 쓰지 말 것**: published:false 로 부르면
 * 이미 게시된 주보가 내려간다. 편집 화면의 초안 저장·게시는 src/data/bulletinDrafts.ts 를 쓴다.
 *
 * 관리자. 임시저장(published:false)과 게시 모두 이 함수.
 * 이름·생일이 든 members 는 잠긴 하위 문서(bulletins/{date}/members/main)라 주보와 한 배치로 쓴다 — 하나만 쓰이는 일이 없게.
 */
export async function saveBulletin(
  db: Firestore,
  uid: string,
  b: Omit<Bulletin, 'updatedBy' | 'updatedAt'>,
  members: BulletinMembers,
): Promise<void> {
  const batch = writeBatch(db);
  // 출석은 이름·인원만 다시 골라 담는다: 어느 화면에서 부르든 반 ID가 공개 문서에 실리지 않게.
  batch.set(doc(db, 'bulletins', b.date), {
    ...b, attendance: publicAttendance(b.attendance), updatedBy: uid, updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'bulletins', b.date, 'members', 'main'), members);
  await batch.commit();
}

/** 이름·생일 문서. 없거나 볼 권한이 없으면(로그인 없음, 임시저장 주보의 학생) null. */
export async function getBulletinMembers(db: Firestore, dateId: string): Promise<BulletinMembers | null> {
  try {
    const snap = await getDoc(doc(db, 'bulletins', dateId, 'members', 'main'));
    return snap.exists() ? (snap.data() as BulletinMembers) : null;
  } catch (e) {
    if (isPermissionDenied(e)) return null;
    throw e;
  }
}

/** 게시된 주보만, 날짜 내림차순. (복합 색인 bulletins: published ↑, date ↓) */
export async function listBulletins(db: Firestore, max = 20): Promise<Bulletin[]> {
  const snap = await getDocs(
    query(collection(db, 'bulletins'), where('published', '==', true), orderBy('date', 'desc'), limit(max)),
  );
  return snap.docs.map(readBulletin);
}

/** 관리자용: 임시저장 포함 전부, 날짜 내림차순. */
export async function listAllBulletins(db: Firestore): Promise<Bulletin[]> {
  const snap = await getDocs(query(collection(db, 'bulletins'), orderBy('date', 'desc')));
  return snap.docs.map(readBulletin);
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
