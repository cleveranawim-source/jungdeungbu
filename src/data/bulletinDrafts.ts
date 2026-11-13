import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch, type Firestore } from 'firebase/firestore';
import { normalizeBulletin, publicAttendance } from './content';
import type {
  Bulletin,
  BulletinContent,
  BulletinDraft,
  BulletinForEdit,
  BulletinMembers,
} from '../types';

// 저장 약속: "초안 저장"은 학생이 보는 주보(bulletins)를 건드리지 않고, "게시"가 게시본을 바꾸며,
// "게시 내리기"는 따로 있다. 초안은 관리자만 읽는 bulletinDrafts/{날짜}.

const EMPTY_MEMBERS = (): BulletinMembers => ({ newFriends: [], birthdays: [] });

/** 게시 상태·저장자·저장 시각을 떼고, 출석은 이름·인원만 남긴다(반 ID는 초안에도 싣지 않는다). */
function toContent(b: Partial<Bulletin> & Pick<Bulletin, 'date'>): BulletinContent {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { published, updatedBy, updatedAt, ...content } = normalizeBulletin(b);
  return { ...content, attendance: publicAttendance(content.attendance) };
}

const readMembers = (data: unknown): BulletinMembers => {
  const m = (data ?? {}) as Partial<BulletinMembers>;
  return { newFriends: m.newFriends ?? [], birthdays: m.birthdays ?? [] };
};

const estimate = { serverTimestamps: 'estimate' } as const;

/** 관리자. 편집기를 열 때 읽는다 — 초안이 있으면 초안, 없으면 게시본(또는 예전 임시저장 문서). 아무것도 쓰지 않는다. */
export async function loadBulletinForEdit(db: Firestore, dateId: string): Promise<BulletinForEdit> {
  const [draftSnap, bulletinSnap] = await Promise.all([
    getDoc(doc(db, 'bulletinDrafts', dateId)),
    getDoc(doc(db, 'bulletins', dateId)),
  ]);
  const bulletin = bulletinSnap.exists() ? (bulletinSnap.data(estimate) as Bulletin) : null;
  const isPublished = bulletin?.published === true;
  const publishedAt = isPublished ? (bulletin!.updatedAt ?? null) : null;

  if (draftSnap.exists()) {
    const d = draftSnap.data(estimate) as BulletinDraft;
    return {
      status: isPublished ? 'published-with-draft' : 'draft',
      content: toContent({ ...d.bulletin, date: dateId }),
      members: readMembers(d.members),
      draftSavedAt: d.updatedAt ?? null,
      publishedAt,
    };
  }
  if (!bulletin) {
    return { status: 'new', content: null, members: EMPTY_MEMBERS(), draftSavedAt: null, publishedAt: null };
  }
  const membersSnap = await getDoc(doc(db, 'bulletins', dateId, 'members', 'main'));
  return {
    status: isPublished ? 'published' : 'draft',
    content: toContent({ ...bulletin, date: dateId }),
    members: readMembers(membersSnap.exists() ? membersSnap.data() : null),
    draftSavedAt: null,
    publishedAt,
  };
}

/** 관리자. bulletinDrafts/{날짜} 한 문서만 쓴다 — 게시본과 그 members 는 그대로. */
export async function saveBulletinDraft(
  db: Firestore,
  uid: string,
  content: BulletinContent,
  members: BulletinMembers,
): Promise<void> {
  await setDoc(doc(db, 'bulletinDrafts', content.date), {
    date: content.date,
    bulletin: { ...content, attendance: publicAttendance(content.attendance) },
    members,
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  });
}

/** 관리자. 한 배치: 게시본 교체 + members 교체 + 초안 삭제 — 일부만 반영되는 일이 없게. */
export async function publishBulletin(
  db: Firestore,
  uid: string,
  content: BulletinContent,
  members: BulletinMembers,
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, 'bulletins', content.date), {
    ...content,
    attendance: publicAttendance(content.attendance),
    published: true,
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'bulletins', content.date, 'members', 'main'), members);
  batch.delete(doc(db, 'bulletinDrafts', content.date));
  await batch.commit();
}

/** 관리자. 게시본의 published 만 false 로 — 내용과 members 는 남는다(규칙상 학생은 둘 다 못 읽게 된다). */
export async function unpublishBulletin(db: Firestore, uid: string, dateId: string): Promise<void> {
  await updateDoc(doc(db, 'bulletins', dateId), { published: false, updatedBy: uid, updatedAt: serverTimestamp() });
}

/** 관리자. 초안 문서만 지운다 — 편집기는 게시본으로 돌아간다. */
export async function discardBulletinDraft(db: Firestore, dateId: string): Promise<void> {
  await deleteDoc(doc(db, 'bulletinDrafts', dateId));
}
