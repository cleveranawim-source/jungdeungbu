import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import { EMPTY_CHURCH_INFO, type ChurchInfo, type MemberInfo } from '../types';
import { isPermissionDenied } from './errors';

// 이름·전화번호가 든 memberInfo 는 settings 와 따로 잠가 둔다(settings 는 누구나 읽는다).
const CHURCH_PATH = 'settings/info';
const MEMBER_PATH = 'memberInfo/main';

/** 공개 안내. 문서가 없거나 칸이 빠져 있어도 빈 값으로 메워 돌려준다. */
export async function getChurchInfo(db: Firestore): Promise<ChurchInfo> {
  const snap = await getDoc(doc(db, CHURCH_PATH));
  const raw = (snap.exists() ? snap.data() : {}) as Partial<ChurchInfo>;
  const e = EMPTY_CHURCH_INFO;
  return {
    motto: { ...e.motto, ...raw.motto },
    etiquette: raw.etiquette ?? [...e.etiquette],
    place: { ...e.place, ...raw.place },
    churchPhone: raw.churchPhone ?? e.churchPhone,
  };
}

/** 관리자. */
export async function saveChurchInfo(db: Firestore, info: ChurchInfo): Promise<void> {
  await setDoc(doc(db, CHURCH_PATH), info);
}

/** 섬기는 분·연락처. 없거나 볼 권한이 없으면(로그인 없음) null. */
export async function getMemberInfo(db: Firestore): Promise<MemberInfo | null> {
  try {
    const snap = await getDoc(doc(db, MEMBER_PATH));
    return snap.exists() ? (snap.data() as MemberInfo) : null;
  } catch (e) {
    if (isPermissionDenied(e)) return null;
    throw e;
  }
}

/** 관리자. */
export async function saveMemberInfo(db: Firestore, info: MemberInfo): Promise<void> {
  await setDoc(doc(db, MEMBER_PATH), info);
}
