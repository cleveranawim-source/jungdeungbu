import { useCallback } from 'react';
import { studentHref } from '../app/router';
import { useLoader } from '../app/useLoader';
import { activeAnnouncements, getBulletin } from '../data/content';
import { formatMonthDay } from '../lib/dates';
import { db } from '../lib/firebase';
import { AnnouncementList } from '../ui/AnnouncementList';
import { LinkButton } from '../ui/Button';
import { Card } from '../ui/Card';
import { CelebrationBanner } from '../ui/CelebrationBanner';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/icons';
import { LoadError } from '../ui/LoadError';
import { Loading } from '../ui/Loading';
import type { StudentTabProps } from './types';
import s from './HomeTab.module.css';

/** 홈: 이번 주 주보 요약(흰 카드 + 남색 버튼) → 축하 → 이번 주 광고. */
export function HomeTab({ student, token, sundayId }: StudentTabProps) {
  const { data, error, reload } = useLoader(useCallback(async () => {
    const [bulletin, announcements] = await Promise.all([getBulletin(db, sundayId), activeAnnouncements(db, sundayId)]);
    // 임시저장(published:false) 주보는 학생에게 없는 것과 같다
    return { bulletin: bulletin?.published ? bulletin : null, announcements };
  }, [sundayId]));

  const banner = <CelebrationBanner student={student} sundayId={sundayId} />;
  if (data === undefined) {
    return (
      <>
        {banner}
        {error ? <LoadError error={error} onRetry={reload} audience="student" /> : <Loading />}
      </>
    );
  }

  const { bulletin, announcements } = data;
  return (
    <>
      {bulletin ? (
        <Card as="section" className={s.week}>
          <p className={s.date}>
            <Icon name="calendar" size={18} />
            {formatMonthDay(sundayId)} 주일
          </p>
          <h2 className={s.title}>{bulletin.sermonTitle || '이번 주 주보'}</h2>
          {bulletin.scripture && <p className={s.scripture}>{bulletin.scripture}</p>}
          <div className={s.actions}>
            <LinkButton href={studentHref(token, 'bulletin')} block icon={<Icon name="bulletin" size={18} />}>
              주보 보기
            </LinkButton>
          </div>
        </Card>
      ) : (
        <EmptyState icon="bulletin" title="이번 주 주보가 아직 없어요">
          {formatMonthDay(sundayId)} 주보가 올라오면 여기서 바로 볼 수 있어요.
        </EmptyState>
      )}

      {banner}

      {announcements.length > 0 && (
        <Card title="이번 주 광고">
          <AnnouncementList items={announcements} />
        </Card>
      )}
    </>
  );
}
