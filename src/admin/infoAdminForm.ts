import { parseLines, safeHttpUrl } from '../lib/bulletin';
import type { ChurchInfo, MemberInfo } from '../types';
import { fromPairs, toPairs, type Pair } from './PairRows';

export const MAP_ERROR = 'https:// 로 시작하는 주소를 붙여 넣어 주세요';

// 화면용 폼(줄 목록은 key 를 붙인 Pair, 에티켓은 한 줄에 하나인 긴 글)
export interface Form {
  title: string;
  subtitle: string;
  verse: string;
  ref: string;
  servants: Pair[];
  etiquette: string;
  placeName: string;
  address: string;
  mapUrl: string;
  churchPhone: string;
  contacts: Pair[];
}

// ---------- 폼 ↔ 저장값 ----------

export function fromSaved(church: ChurchInfo, members: MemberInfo | null): Form {
  return {
    title: church.motto.title,
    subtitle: church.motto.subtitle,
    verse: church.motto.verse,
    ref: church.motto.ref,
    servants: toPairs(
      members?.servants ?? [],
      (x) => x.role,
      (x) => x.names,
    ),
    etiquette: church.etiquette.join('\n'),
    placeName: church.place.name,
    address: church.place.address,
    mapUrl: church.place.mapUrl,
    churchPhone: church.churchPhone,
    contacts: toPairs(
      members?.contacts ?? [],
      (x) => x.label,
      (x) => x.phone,
    ),
  };
}

/**
 * 폼 → 저장할 두 문서. settings/info(공개)에는 표어·에티켓·장소·교회 전화만,
 * 사람 이름·개인 번호는 memberInfo/main 에만 나뉘어 담긴다.
 */
export function readForm(f: Form): {
  church: ChurchInfo;
  members: MemberInfo;
  mapInvalid: boolean;
} {
  const mapUrl = f.mapUrl.trim();
  return {
    church: {
      motto: {
        title: f.title.trim(),
        subtitle: f.subtitle.trim(),
        verse: f.verse.trim(),
        ref: f.ref.trim(),
      },
      etiquette: parseLines(f.etiquette),
      place: { name: f.placeName.trim(), address: f.address.trim(), mapUrl },
      churchPhone: f.churchPhone.trim(),
    },
    members: {
      servants: fromPairs(f.servants).map((p) => ({ role: p.a, names: p.b })),
      contacts: fromPairs(f.contacts).map((p) => ({ label: p.a, phone: p.b })),
    },
    mapInvalid: mapUrl !== '' && safeHttpUrl(mapUrl) === null,
  };
}

/** 저장할 모양으로 다듬은 값(바뀐 것이 있는지 비교용) */
export const snapshot = (f: Form): string => {
  const { church, members } = readForm(f);
  return JSON.stringify({ church, members });
};
