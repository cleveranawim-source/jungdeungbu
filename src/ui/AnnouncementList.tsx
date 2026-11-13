import type { Announcement, WithId } from '../types';
import { formatMonthDay, isDateId } from '../lib/dates';
import s from './AnnouncementList.module.css';

/** 광고 줄 목록(카드 안). 제목 굵게, 내용은 줄바꿈 그대로. 학생 홈·주보 보기가 함께 쓴다. */
export function AnnouncementList({ items, dates = false }: { items: WithId<Announcement>[]; dates?: boolean }) {
  return (
    <ul className={s.list}>
      {items.map((a) => (
        <li key={a.id} className={[s.item, dates && s.dated].filter(Boolean).join(' ')}>
          {dates && isDateId(a.endDate) && <time className={s.date} dateTime={a.endDate}>
            <span className="sr-only">{formatMonthDay(a.endDate)}까지 안내해요</span>
            <span aria-hidden="true">{Number(a.endDate.slice(5, 7))}월<strong>{a.endDate.slice(8)}</strong><small>까지 안내</small></span>
          </time>}
          <div className={s.content}><h3 className={s.title}>{a.title}</h3>
          {a.body && <p className={s.body}>{a.body}</p>}</div>
        </li>
      ))}
    </ul>
  );
}
