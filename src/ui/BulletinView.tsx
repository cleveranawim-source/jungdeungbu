import type { Announcement, Bulletin, Sermon, WithId } from '../types';
import { formatMonthDay } from '../lib/dates';
import { AnnouncementList } from './AnnouncementList';
import { Card } from './Card';
import s from './BulletinView.module.css';

export interface BulletinViewProps {
  bulletin: Bulletin;
  sermon: Sermon | null;
  announcements: WithId<Announcement>[];
  /**
   * 설교 상세로 가는 주소(브리프 props 에 더한 선택 값). 설교가 있고 이 값이 있으면 설교 제목이 링크가 된다.
   * 학생은 `studentHref(token, 'sermon', date)`, 링크할 화면이 없는 쪽(교사)은 비워 둔다.
   */
  sermonHref?: string;
}

/**
 * 주보 한 장: 예배 순서 → 찬양 → 말씀(본문·설교 제목) → 광고.
 * 종이 주보처럼 한 카드 안에 구역을 나누고, 예배 순서는 "기도 ········ 박은혜 선생님" 점선 이음으로 보여 준다.
 * 비어 있는 구역은 그리지 않는다. 학생 주보 탭과 교사 주보 탭이 함께 쓴다.
 */
export function BulletinView({ bulletin, sermon, announcements, sermonHref }: BulletinViewProps) {
  const sermonTitle = bulletin.sermonTitle || sermon?.title || '';
  const order = bulletin.order.filter((o) => o.type || o.title || o.detail);
  const hymns = bulletin.hymns.filter(Boolean);
  return (
    <Card as="article" className={s.paper}>
      <header className={s.head}>
        <h2 className={s.date}>{formatMonthDay(bulletin.date)} 주일</h2>
        <p className={s.kind}>중등부 예배</p>
      </header>

      {order.length > 0 && (
        <section className={s.section} aria-labelledby={`${bulletin.date}-order`}>
          <h3 className={s.heading} id={`${bulletin.date}-order`}>예배 순서</h3>
          <ol className={s.order}>
            {order.map((o, i) => (
              <li key={i} className={s.step}>
                <span className={s.type}>{o.type}</span>
                {(o.title || o.detail) && (
                  <>
                    <span className={s.leader} aria-hidden="true" />
                    <span className={s.what}>
                      {o.title && <span className={s.stepTitle}>{o.title}</span>}
                      {o.detail && <span className={s.detail}>{o.detail}</span>}
                    </span>
                  </>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {hymns.length > 0 && (
        <section className={s.section} aria-labelledby={`${bulletin.date}-hymns`}>
          <h3 className={s.heading} id={`${bulletin.date}-hymns`}>찬양</h3>
          <ul className={s.hymns}>
            {hymns.map((h, i) => <li key={i}>{h}</li>)}
          </ul>
        </section>
      )}

      {(bulletin.scripture || sermonTitle) && (
        <section className={s.section} aria-labelledby={`${bulletin.date}-word`}>
          <h3 className={s.heading} id={`${bulletin.date}-word`}>말씀</h3>
          <dl className={s.word}>
            {bulletin.scripture && (
              <div><dt>본문</dt><dd>{bulletin.scripture}</dd></div>
            )}
            {sermonTitle && (
              <div>
                <dt>설교</dt>
                <dd>
                  {sermon && sermonHref
                    ? <a className={s.sermonLink} href={sermonHref}>{sermonTitle}</a>
                    : sermonTitle}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {announcements.length > 0 && (
        <section className={s.section} aria-labelledby={`${bulletin.date}-news`}>
          <h3 className={s.heading} id={`${bulletin.date}-news`}>광고</h3>
          <AnnouncementList items={announcements} />
        </section>
      )}
    </Card>
  );
}
