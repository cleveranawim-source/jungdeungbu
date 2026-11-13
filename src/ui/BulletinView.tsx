import type { ReactNode } from 'react';
import type { Announcement, Bulletin, BulletinMembers, Sermon, WithId } from '../types';
import { displayOrder } from '../lib/bulletin';
import { formatMonthDay } from '../lib/dates';
import { AnnouncementList } from './AnnouncementList';
import { Card } from './Card';
import s from './BulletinView.module.css';

export interface BulletinViewProps {
  bulletin: Bulletin;
  sermon: Sermon | null;
  announcements: WithId<Announcement>[];
  /** 잠긴 문서(새 친구·생일). 못 읽었거나 아직이면 null → 새 친구·생일 구역을 그리지 않는다 */
  members: BulletinMembers | null;
  /**
   * 설교 상세로 가는 주소(브리프 props 에 더한 선택 값). 설교가 있고 이 값이 있으면 설교 제목이 링크가 된다.
   * 학생은 `studentHref(token, 'sermon', date)`, 링크할 화면이 없는 쪽(교사)은 비워 둔다.
   */
  sermonHref?: string;
}

/** "2026-11-08" → "11.8", 생일 "11-20" → "11.20" */
function dotDate(dateId: string): string {
  const [m, d] = dateId.split('-').slice(-2).map(Number);
  return `${m}.${d}`;
}

/** 순서·출석·생일처럼 같은 모양의 구역 하나(h3 + 내용). */
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className={s.section} aria-labelledby={id}>
      <h3 className={s.heading} id={id}>{title}</h3>
      {children}
    </section>
  );
}

/**
 * 주보 한 장(종이 주보와 같은 차례): 머리 → 주일예배(인도·여는 말씀·세 칸 순서표) → 찬양 → 말씀 → 광고
 * → 다음 주 예배위원 → 지난 주 출석 → 새 친구 → 이번 달 생일.
 * 비어 있는 구역은 그리지 않는다. 학생 주보 탭과 교사 주보 탭이 함께 쓴다.
 */
export function BulletinView({ bulletin, sermon, announcements, members, sermonHref }: BulletinViewProps) {
  const id = (name: string) => `${bulletin.date}-${name}`;
  const sermonTitle = bulletin.sermonTitle || sermon?.title || '';
  const { rows, showsScripture, showsSermon } = displayOrder(bulletin.order, bulletin.scripture, sermonTitle);
  const hymns = bulletin.hymns.filter(Boolean);
  const hasStanding = rows.some((r) => r.standing);
  const opening = bulletin.opening;
  const hasOpening = Boolean(opening.text || opening.ref);
  const showScripture = !showsScripture && Boolean(bulletin.scripture);
  const showSermon = !showsSermon && Boolean(sermonTitle);
  const servers = bulletin.nextServers.filter((x) => x.role || x.name);
  const att = bulletin.attendance;
  // 잠긴 문서는 다듬지 않고 저장된 그대로 오므로 빠진 칸은 빈 목록으로 본다
  const newFriends = (members?.newFriends ?? []).filter(Boolean);
  const birthdays = (members?.birthdays ?? []).filter((b) => b && b.name && typeof b.date === 'string' && b.date);

  const sermonText = (title: string) => (sermon && sermonHref
    ? <a className={s.sermonLink} href={sermonHref}>{title}</a>
    : title);

  return (
    <Card as="article" className={s.paper}>
      <header className={s.head}>
        <h2 className={s.date}>{formatMonthDay(bulletin.date)} 주일</h2>
        {bulletin.issue && <p className={s.issue}>{bulletin.issue}</p>}
        <p className={s.kind}>중등부 예배</p>
      </header>

      {(rows.length > 0 || bulletin.leader || hasOpening) && (
        <section className={s.section} aria-labelledby={id('order')}>
          <div className={s.worshipHead}>
            <h3 className={s.heading} id={id('order')}>주일예배</h3>
            {bulletin.leader && <p className={s.leaderName}>인도: {bulletin.leader}</p>}
          </div>
          {hasOpening && (
            <p className={s.opening}>
              {opening.text}{opening.ref && (opening.text ? ` (${opening.ref})` : opening.ref)}
            </p>
          )}
          {rows.length > 0 && (
            <ol className={s.order} aria-label="예배 순서">
              {rows.map((r, i) => (
                <li key={i} className={s.step}>
                  <span className={s.type}>
                    {r.standing && <><span className={s.star} aria-hidden="true">*</span><span className="sr-only">일어서서 </span></>}
                    {r.type}
                  </span>
                  {r.title && <span className={s.what}>{r.from === 'sermon' ? sermonText(r.title) : r.title}</span>}
                  {r.detail && <span className={s.who}>{r.detail}</span>}
                </li>
              ))}
            </ol>
          )}
          {hasStanding && <p className={s.note}>*표는 일어서서</p>}
        </section>
      )}

      {hymns.length > 0 && (
        <Section id={id('hymns')} title="찬양">
          <ul className={s.hymns}>
            {hymns.map((h, i) => <li key={i}>{h}</li>)}
          </ul>
        </Section>
      )}

      {(showScripture || showSermon) && (
        <Section id={id('word')} title="말씀">
          <dl className={s.word}>
            {showScripture && <div><dt>본문</dt><dd>{bulletin.scripture}</dd></div>}
            {showSermon && <div><dt>설교</dt><dd>{sermonText(sermonTitle)}</dd></div>}
          </dl>
        </Section>
      )}

      {announcements.length > 0 && (
        <Section id={id('news')} title="광고">
          <AnnouncementList items={announcements} />
        </Section>
      )}

      {servers.length > 0 && (
        <Section id={id('servers')} title="다음 주 예배위원">
          <dl className={s.pairs}>
            {servers.map((x, i) => <div key={i}><dt>{x.role}</dt><dd>{x.name}</dd></div>)}
          </dl>
        </Section>
      )}

      {att && (
        <Section id={id('attendance')} title="지난 주 출석">
          <div className={s.counts}>
            <p className={s.sunday}>{dotDate(att.sunday)} 주일</p>
            <p className={s.total}>
              <span>학생 {att.students.present}/{att.students.total}</span>
              {att.teachers && <span>교사 {att.teachers.present}/{att.teachers.total}</span>}
            </p>
            {att.classes.length > 0 && (
              <ul className={s.chips} aria-label="반별 출석">
                {att.classes.map((c) => (
                  <li key={c.classId} className={s.chip}>
                    <span className={s.chipName}>{c.name}</span> <span>{c.present}/{c.total}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>
      )}

      {newFriends.length > 0 && (
        <Section id={id('new')} title="새 친구">
          <ul className={s.names}>
            {newFriends.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </Section>
      )}

      {birthdays.length > 0 && (
        <Section id={id('birthdays')} title="이번 달 생일">
          <ul className={s.names}>
            {birthdays.map((b, i) => (
              <li key={i}><span className={s.birthDate}>{dotDate(b.date)}</span> {b.name}</li>
            ))}
          </ul>
        </Section>
      )}
    </Card>
  );
}
