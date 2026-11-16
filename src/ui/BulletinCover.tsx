import type { ReactNode } from 'react';
import { SundayPath } from './SundayPath';
import s from './BulletinCover.module.css';

/** 길 모양은 장식. 제목·날짜·행동은 실제 글자로 유지해요. */
export function BulletinCover({
  title,
  subtitle,
  children,
  titleAs = 'h2',
  compact = false,
  quiet = false,
}: {
  title: ReactNode;
  subtitle?: string;
  children: ReactNode;
  titleAs?: 'h2' | 'p';
  compact?: boolean;
  quiet?: boolean;
}) {
  const Title = titleAs;
  return (
    <section className={[s.cover, compact && s.compact, quiet && s.quiet].filter(Boolean).join(' ')}>
      <div className={s.art}>
        {!quiet && <SundayPath />}
        <div className={s.copy}>
          <Title className={s.title}>{title}</Title>
          {subtitle && <p className={s.subtitle}>{subtitle}</p>}
        </div>
      </div>
      <div className={s.foot}>{children}</div>
    </section>
  );
}
