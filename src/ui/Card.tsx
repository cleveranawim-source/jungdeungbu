import type { ReactNode } from 'react';
import s from './Card.module.css';

export type CardTone = 'default' | 'accent' | 'quiet';

export interface CardProps {
  /** 카드 제목(h2). 화면 제목(h1)은 Screen 이 맡는다. */
  title?: ReactNode;
  /** default = 흰 면 / accent = 귤빛 면(축하·이번 주 핵심) / quiet = 점선(빈 상태·개발용) */
  tone?: CardTone;
  as?: 'section' | 'article' | 'div' | 'li';
  className?: string;
  children?: ReactNode;
}

export function Card({ title, tone = 'default', as: Tag = 'section', className, children }: CardProps) {
  return (
    <Tag className={[s.card, tone !== 'default' && s[tone], className].filter(Boolean).join(' ')}>
      {title && <h2 className={s.title}>{title}</h2>}
      <div className={s.body}>{children}</div>
    </Tag>
  );
}
