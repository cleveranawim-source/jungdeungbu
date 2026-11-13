import { useCallback } from 'react';
import { studentHref } from '../app/router';
import { useLoader } from '../app/useLoader';
import { activeAnnouncements, getBulletin } from '../data/content';
import { getChurchInfo } from '../data/info';
import { safeHttpUrl, telHref } from '../lib/bulletin';
import { formatMonthDay } from '../lib/dates';
import { db } from '../lib/firebase';
import { LinkButton } from '../ui/Button';
import { CelebrationBanner } from '../ui/CelebrationBanner';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/icons';
import { IllustratedCover } from '../ui/IllustratedCover';
import { LoadError } from '../ui/LoadError';
import { Loading } from '../ui/Loading';
import { NewsSection } from '../ui/NewsSection';
import type { StudentTabProps } from './types';
import s from './HomeTab.module.css';

export function HomeTab({ student, token, sundayId }: StudentTabProps) {
  const { data, error, reload } = useLoader(useCallback(async () => {
    const [bulletin, announcements] = await Promise.all([getBulletin(db, sundayId), activeAnnouncements(db, sundayId)]);
    return { bulletin: bulletin?.published ? bulletin : null, announcements };
  }, [sundayId]));
  const church = useLoader(useCallback(() => getChurchInfo(db), []));
  const banner = <CelebrationBanner student={student} sundayId={sundayId} />;
  if (data === undefined) return <>{banner}{error ? <LoadError error={error} onRetry={reload} audience="student" /> : <Loading />}</>;
  const { bulletin, announcements } = data;
  const place = church.data?.place;
  const mapUrl = place ? safeHttpUrl(place.mapUrl) : null;
  const phone = church.data?.churchPhone;
  const phoneHref = phone ? telHref(phone) : null;
  const hasPlace = Boolean(place?.name || place?.address || mapUrl || phone);
  return (
    <div className={s.layout}>
      <div className={s.primary}>
        {bulletin ? (
          <IllustratedCover title={church.data?.motto.title || '함께 드리는 예배'} subtitle={church.data?.motto.subtitle}>
            <p className={s.date}>{formatMonthDay(sundayId)} 주일 <span>{bulletin.issue}</span></p>
            <h3 className={s.title}>{bulletin.sermonTitle || '이번 주 주보'}</h3>
            {bulletin.scripture && <p className={s.scripture}>{bulletin.scripture}</p>}
            <a className={s.action} href={studentHref(token, 'bulletin')}><span>이번 주 주보 보기</span><Icon name="chevronRight" size={20} /></a>
          </IllustratedCover>
        ) : <EmptyState icon="bulletin" title="이번 주 주보가 아직 없어요">{formatMonthDay(sundayId)} 주보가 올라오면 여기서 바로 볼 수 있어요.</EmptyState>}
        <nav className={s.quickLinks} aria-label="함께 나누기">
          <a href={studentHref(token, 'sermon')}><Icon name="sermon" size={20} />말씀 살펴보기</a>
          <a href={studentHref(token, 'prayer')}><Icon name="prayer" size={20} />기도 나누기</a>
        </nav>
        {hasPlace && <section className={s.meeting} aria-labelledby="home-meeting">
          <h2 id="home-meeting">주일에 여기서 만나요</h2>
          {place?.name && <p className={s.placeName}>{place.name}</p>}
          {place?.address && <p className={s.address}>{place.address}</p>}
          <div className={s.placeLinks}>
            {mapUrl && <LinkButton href={mapUrl} variant="secondary" size="sm" target="_blank" rel="noopener noreferrer">지도 보기</LinkButton>}
            {phone && (phoneHref ? <a className={s.tel} href={phoneHref}>{phone}</a> : <span>{phone}</span>)}
          </div>
        </section>}
        {banner}
      </div>
      {announcements.length > 0 && <NewsSection items={announcements} />}
    </div>
  );
}
