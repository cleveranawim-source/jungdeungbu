import { useCallback } from 'react';
import { studentHref } from '../app/router';
import { useLoader } from '../app/useLoader';
import { activeAnnouncements, getBulletin } from '../data/content';
import { getChurchInfo } from '../data/info';
import { formatMonthDay } from '../lib/dates';
import { db } from '../lib/firebase';
import { CelebrationBanner } from '../ui/CelebrationBanner';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/icons';
import { IllustratedCover } from '../ui/IllustratedCover';
import { LoadError } from '../ui/LoadError';
import { Loading } from '../ui/Loading';
import { PlaceInfo } from '../ui/PlaceInfo';
import { NewsSection } from '../ui/NewsSection';
import type { StudentTabProps } from './types';
import s from './HomeTab.module.css';

export function HomeTab({ student, token, sundayId }: StudentTabProps) {
  const { data, error, reload } = useLoader(
    useCallback(async () => {
      const [bulletin, announcements, church] = await Promise.all([
        getBulletin(db, sundayId),
        activeAnnouncements(db, sundayId),
        getChurchInfo(db).catch(() => null),
      ]);
      // 미게시 주보는 학생에게 없는 것과 같아요. 공개 안내 실패는 홈을 막지 않아요.
      return { bulletin: bulletin?.published ? bulletin : null, announcements, church };
    }, [sundayId]),
  );
  const banner = <CelebrationBanner student={student} sundayId={sundayId} />;
  if (data === undefined)
    return (
      <>
        {banner}
        {error ? <LoadError error={error} onRetry={reload} audience="student" /> : <Loading />}
      </>
    );
  const { bulletin, announcements, church } = data;
  return (
    <div className={s.layout} data-reading-columns={announcements.length ? 'double' : 'single'}>
      <div className={s.primary}>
        {bulletin ? (
          <IllustratedCover
            titleAs="p"
            title={church?.motto.title || '함께 드리는 예배'}
            subtitle={church?.motto.subtitle}
          >
            <p className={s.date}>
              {formatMonthDay(sundayId)} 주일 <span>{bulletin.issue}</span>
            </p>
            <h2 className={s.title}>{bulletin.sermonTitle || '이번 주 주보'}</h2>
            {bulletin.scripture && <p className={s.scripture}>{bulletin.scripture}</p>}
            <a className={s.action} href={studentHref(token, 'bulletin')}>
              <span>이번 주 주보 보기</span>
              <Icon name="chevronRight" size={20} />
            </a>
          </IllustratedCover>
        ) : (
          <EmptyState icon="bulletin" title="이번 주 주보가 아직 없어요">
            {formatMonthDay(sundayId)} 주보가 올라오면 여기서 바로 볼 수 있어요.
          </EmptyState>
        )}
        <nav className={s.quickLinks} aria-label="함께 나누기">
          <a href={studentHref(token, 'sermon')}>
            <Icon name="sermon" size={20} />
            말씀 살펴보기
          </a>
          <a href={studentHref(token, 'prayer')}>
            <Icon name="prayer" size={20} />
            기도 나누기
          </a>
        </nav>
        {church && (
          <PlaceInfo info={church} title="주일에 여기서 만나요" level={2} className={s.meeting} />
        )}
        {banner}
      </div>
      {announcements.length > 0 && <NewsSection items={announcements} />}
    </div>
  );
}
