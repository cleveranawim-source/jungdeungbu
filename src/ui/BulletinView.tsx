import type { ReactNode } from 'react';
import type { Announcement, BulletinContent, BulletinMembers, Sermon, WithId } from '../types';
import { displayOrder } from '../lib/bulletin';
import { formatBirthday, formatMonthDay } from '../lib/dates';
import { Disclosure } from './Disclosure';
import { IllustratedCover } from './IllustratedCover';
import { NewsSection } from './NewsSection';
import { SectionJump } from './SectionJump';
import s from './BulletinView.module.css';

export interface BulletinViewProps {
  bulletin: BulletinContent;
  sermon: Sermon | null;
  announcements: WithId<Announcement>[];
  /** members가 null이면 새 친구·생일 구역을 그리지 않아요. */
  members: BulletinMembers | null;
  /** 설교 문서와 주소가 모두 있을 때만 제목을 연결해요. 학생은 말씀 상세, 교사는 생략해요. */
  sermonHref?: string;
  coverLabel?: string;
  coverDescription?: string;
  information?: ReactNode;
}

export function BulletinView({
  bulletin,
  sermon,
  announcements,
  members,
  sermonHref,
  information,
  coverLabel,
  coverDescription,
}: BulletinViewProps) {
  const id = (name: string) => `${bulletin.date}-${name}`;
  const sermonTitle = bulletin.sermonTitle || sermon?.title || '';
  const { rows, showsScripture, showsSermon } = displayOrder(
    bulletin.order ?? [],
    bulletin.scripture,
    sermonTitle,
  );
  const hymns = (bulletin.hymns ?? []).filter(Boolean);
  const hasStanding = rows.some((r) => r.standing);
  const opening = bulletin.opening;
  const hasOpening = Boolean(opening?.text || opening?.ref);
  const showScripture = !showsScripture && Boolean(bulletin.scripture);
  const showSermon = !showsSermon && Boolean(sermonTitle);
  const servers = (bulletin.nextServers ?? []).filter((x) => x.role || x.name);
  const att = bulletin.attendance;
  const newFriends = (members?.newFriends ?? []).filter(Boolean);
  const birthdays = (members?.birthdays ?? []).filter(
    (b) => b && b.name && typeof b.date === 'string' && b.date,
  );
  const hasOrder = rows.length > 0 || bulletin.leader || hasOpening;
  const hasProgram = hasOrder || hymns.length > 0 || showScripture || showSermon;
  const hasNews = announcements.length > 0 || servers.length > 0;
  const sermonText = (title: string) =>
    sermon && sermonHref ? (
      <a className={s.sermonLink} href={sermonHref}>
        {title}
      </a>
    ) : (
      title
    );
  return (
    <>
      <div className={s.layout} data-reading-columns={information ? 'double' : 'single'}>
        <div className={s.main}>
          <IllustratedCover
            title={
              <>
                {formatMonthDay(bulletin.date)} <br />
                주일예배
              </>
            }
            subtitle={coverDescription}
          >
            <p className={s.coverMeta}>
              {coverLabel && <span>{coverLabel}</span>}
              {bulletin.issue && <span>{bulletin.issue}</span>}
            </p>
          </IllustratedCover>
          <SectionJump
            items={[
              ...(hasProgram ? [{ label: '예배 순서', id: id('program') }] : []),
              ...(hasNews ? [{ label: '이번 주 소식', id: id('news') }] : []),
              ...(information ? [{ label: '중등부 안내', id: 'church-info' }] : []),
            ]}
          />
          {hasProgram && (
            <section
              className={s.paper}
              id={id('program')}
              tabIndex={-1}
              aria-labelledby={id('order')}
            >
              <div className={s.worshipHead}>
                <h2 className={s.heading} id={id('order')}>
                  예배 순서
                </h2>
                {bulletin.leader && <p className={s.leaderName}>인도: {bulletin.leader}</p>}
              </div>
              {hasOpening && (
                <blockquote className={s.opening}>
                  {opening.text && <p>{opening.text}</p>}
                  {opening.ref && <cite>{opening.ref}</cite>}
                </blockquote>
              )}
              {rows.length > 0 && (
                <table className={s.order} aria-label="예배 순서">
                  <colgroup>
                    <col className={s.typeCol} />
                    <col className={s.titleCol} />
                    <col className={s.personCol} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col">순서</th>
                      <th scope="col">내용</th>
                      <th scope="col">맡은 사람</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <th scope="row">
                          {r.standing && (
                            <>
                              <span className={s.star} aria-hidden="true">
                                *{' '}
                              </span>
                              <span className="sr-only">일어서서 </span>
                            </>
                          )}
                          {r.type}
                        </th>
                        <td>{r.from === 'sermon' ? sermonText(r.title) : r.title}</td>
                        <td className={s.who}>{r.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {hasStanding && <p className={s.note}>* 표가 있는 순서에는 함께 일어서요.</p>}
              {hymns.length > 0 && (
                <section className={s.extra} aria-labelledby={id('hymns')}>
                  <h3 id={id('hymns')}>찬양</h3>
                  <ul className={s.hymns}>
                    {hymns.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </section>
              )}
              {(showScripture || showSermon) && (
                <section className={s.extra} aria-labelledby={id('word')}>
                  <h3 id={id('word')}>말씀</h3>
                  <dl className={s.pairs}>
                    {showScripture && (
                      <div>
                        <dt>본문</dt>
                        <dd>{bulletin.scripture}</dd>
                      </div>
                    )}
                    {showSermon && (
                      <div>
                        <dt>설교</dt>
                        <dd>{sermonText(sermonTitle)}</dd>
                      </div>
                    )}
                  </dl>
                </section>
              )}
            </section>
          )}
          {hasNews && (
            <NewsSection items={announcements} id={id('news')}>
              {servers.length > 0 && (
                <Disclosure title="다음 주 예배위원" sub="미리 준비해요">
                  <dl className={s.pairs}>
                    {servers.map((x, i) => (
                      <div key={i}>
                        <dt>{x.role}</dt>
                        <dd>{x.name}</dd>
                      </div>
                    ))}
                  </dl>
                </Disclosure>
              )}
            </NewsSection>
          )}
          {/* 구성원 문서를 못 읽었거나 준비 중이면 이 구역 전체가 없어요. */}
          {(newFriends.length > 0 || birthdays.length > 0) && (
            <section className={s.community} aria-labelledby={id('community')}>
              <h2 className={s.heading} id={id('community')}>
                함께 나누는 소식
              </h2>
              {newFriends.length > 0 && (
                <section className={s.communityPart} aria-labelledby={id('new')}>
                  <h3 id={id('new')}>새 친구</h3>
                  <p>우리 중등부에 온 걸 환영해요!</p>
                  <ul className={s.names}>
                    {newFriends.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </section>
              )}
              {birthdays.length > 0 && (
                <section className={s.communityPart} aria-labelledby={id('birthdays')}>
                  <h3 id={id('birthdays')}>이번 달 생일</h3>
                  <ul className={s.birthdays}>
                    {birthdays.map((b, i) => (
                      <li key={i}>
                        <span>{b.name}</span>
                        <span>{formatBirthday(b.date)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </section>
          )}
          {/* 공개 출석에는 반 이름과 숫자만 있어요. 반 ID와 학생 이름 목록은 싣지 않아요. */}
          {att && att.students.total > 0 && (
            <section className={s.attendance} aria-labelledby={id('attendance')}>
              <h2 className={s.heading} id={id('attendance')}>
                지난 주 함께한 인원
              </h2>
              <p className={s.note}>{formatMonthDay(att.sunday)} 주일</p>
              <div className={s.counts}>
                <p>
                  학생 <strong>{att.students.present}</strong> / {att.students.total}명
                </p>
                {att.teachers && (
                  <p>
                    교사 <strong>{att.teachers.present}</strong> / {att.teachers.total}명
                  </p>
                )}
              </div>
              {(att.classes ?? []).length > 0 && (
                <Disclosure title="반별 인원 보기">
                  <table className={s.classCounts} aria-label="반별 출석">
                    <thead>
                      <tr>
                        <th scope="col">반</th>
                        <th scope="col">함께한 인원</th>
                        <th scope="col">전체 인원</th>
                      </tr>
                    </thead>
                    <tbody>
                      {att.classes.map((c, i) => (
                        <tr key={i}>
                          <th scope="row">{c.name}</th>
                          <td>{c.present}명</td>
                          <td>{c.total}명</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Disclosure>
              )}
            </section>
          )}
        </div>
        {information && <aside className={s.aside}>{information}</aside>}
      </div>
    </>
  );
}
