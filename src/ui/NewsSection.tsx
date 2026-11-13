import { useId, type ReactNode } from 'react';
import type { Announcement, WithId } from '../types';
import { AnnouncementList } from './AnnouncementList';
import s from './NewsSection.module.css';

export function NewsSection({ items, title = '이번 주 소식', id, children }: {
  items: WithId<Announcement>[]; title?: string; id?: string; children?: ReactNode;
}) {
  const headingId = useId();
  return (
    <section id={id} tabIndex={id ? -1 : undefined} className={s.section} aria-labelledby={headingId}>
      <h2 className={s.heading} id={headingId}>{title}</h2>
      <div className={s.body}>
        {items.length > 0 && <AnnouncementList items={items} dates />}
        {children}
      </div>
    </section>
  );
}
