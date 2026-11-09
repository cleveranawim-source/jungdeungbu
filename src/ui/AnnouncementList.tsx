import type { Announcement, WithId } from '../types';
import s from './AnnouncementList.module.css';

/** 광고 줄 목록(카드 안). 제목 굵게, 내용은 줄바꿈 그대로. 학생 홈·주보 보기가 함께 쓴다. */
export function AnnouncementList({ items }: { items: WithId<Announcement>[] }) {
  return (
    <ul className={s.list}>
      {items.map((a) => (
        <li key={a.id} className={s.item}>
          <h3 className={s.title}>{a.title}</h3>
          {a.body && <p className={s.body}>{a.body}</p>}
        </li>
      ))}
    </ul>
  );
}
