import { useCallback } from 'react';
import { studentHref } from '../app/router';
import { useLoader } from '../app/useLoader';
import { activeAnnouncements, getBulletin, getSermon, listBulletins } from '../data/content';
import { formatMonthDay, isDateId } from '../lib/dates';
import { db } from '../lib/firebase';
import { BulletinView } from '../ui/BulletinView';
import { LinkButton } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/icons';
import { LoadError } from '../ui/LoadError';
import { Loading } from '../ui/Loading';
import type { StudentTabProps } from './types';
import s from './BulletinTab.module.css';

/** 주보: 이번 주(또는 주소의 날짜) 주보 한 장 + 지난 주보 날짜 목록. */
export function BulletinTab({ token, sundayId, sub }: StudentTabProps) {
  const date = sub && isDateId(sub) ? sub : sundayId;
  const isThisWeek = date === sundayId;

  const one = useLoader(useCallback(async () => {
    const [bulletin, sermon, announcements] = await Promise.all([
      getBulletin(db, date), getSermon(db, date), activeAnnouncements(db, date),
    ]);
    return { bulletin: bulletin?.published ? bulletin : null, sermon, announcements };
  }, [date]));
  // 지난 주보 목록은 따로: 실패해도 이번 주보는 보인다
  const past = useLoader(useCallback(() => listBulletins(db), []));

  let main;
  if (one.data === undefined) {
    main = one.error ? <LoadError error={one.error} onRetry={one.reload} /> : <Loading />;
  } else if (one.data.bulletin) {
    main = (
      <BulletinView
        bulletin={one.data.bulletin}
        sermon={one.data.sermon}
        announcements={one.data.announcements}
        sermonHref={one.data.sermon ? studentHref(token, 'sermon', date) : undefined}
      />
    );
  } else {
    main = isThisWeek ? (
      <EmptyState icon="bulletin" title="이번 주 주보가 아직 없어요">
        주보가 올라오면 여기서 볼 수 있어요. 아래에서 지난 주보를 볼 수도 있어요.
      </EmptyState>
    ) : (
      <EmptyState icon="bulletin" title={`${formatMonthDay(date)} 주보가 없어요`}>
        아래 목록에서 다른 날짜를 골라 보세요.
      </EmptyState>
    );
  }

  // 지난 주보: 이번 주일까지(미리 올린 다음 주 것은 빼고), 지금 보는 날짜는 빼고
  const pastList = (past.data ?? []).filter((b) => b.date <= sundayId && b.date !== date && b.date !== sundayId);

  return (
    <>
      {!isThisWeek && (
        <div className={s.back}>
          <LinkButton href={studentHref(token, 'bulletin')} variant="ghost" size="sm" icon={<Icon name="back" size={18} />}>
            이번 주 주보
          </LinkButton>
        </div>
      )}
      {main}
      {past.data === undefined ? (past.error ? <LoadError error={past.error} onRetry={past.reload} /> : null) : pastList.length > 0 && (
        <Card title="지난 주보">
          <ul className={s.list}>
            {pastList.map((b) => (
              <li key={b.date}>
                <a className={s.row} href={studentHref(token, 'bulletin', b.date)}>
                  <span className={s.rowText}>
                    <span className={s.rowDate}>{formatMonthDay(b.date)}</span>
                    {b.sermonTitle && <span className={s.rowMeta}>{b.sermonTitle}</span>}
                  </span>
                  <Icon name="chevronRight" size={20} />
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
