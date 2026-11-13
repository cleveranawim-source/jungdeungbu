import { useEffect, useState } from 'react';
import { getBulletinMembers } from '../data/content';
import { getMemberInfo } from '../data/info';
import { db } from '../lib/firebase';
import type { BulletinMembers, MemberInfo } from '../types';

interface MemberData { bulletin: BulletinMembers | null; info: MemberInfo | null }

const NONE: MemberData = { bulletin: null, info: null };

/**
 * canRead 가 true 가 되면(또는 date 가 바뀌면) 잠긴 문서 둘(주보의 새 친구·생일, 섬기는 분·연락처)을 읽는다.
 * 실패·거절은 null 로 삼킨다(오류 화면 없음): 이 구역은 없어도 주보는 온전하다.
 */
export function useMemberData(date: string, canRead: boolean): MemberData {
  const [loaded, setLoaded] = useState<{ date: string; data: MemberData } | null>(null);

  useEffect(() => {
    if (!canRead) return;
    let live = true;
    Promise.all([getBulletinMembers(db, date), getMemberInfo(db)])
      .then(([bulletin, info]) => ({ bulletin, info }), () => NONE)
      .then((data) => { if (live) setLoaded({ date, data }); });
    // 날짜가 바뀌거나 화면을 떠나면 늦게 온 옛 결과는 버린다
    return () => { live = false; };
  }, [date, canRead]);

  // 다른 날짜의 결과나 읽을 수 없게 된 뒤의 값은 보여 주지 않는다
  return canRead && loaded?.date === date ? loaded.data : NONE;
}
