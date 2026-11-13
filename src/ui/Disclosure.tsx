import type { ReactNode } from 'react';
import { Icon } from './icons';
import s from './Disclosure.module.css';

/** 네이티브 펼침: Enter/Space, 확장 상태 안내, 열린 뒤의 탭 순서를 브라우저가 제공해요. */
export function Disclosure({ title, sub, level = 3, children, defaultOpen = false }: {
  title: string; sub?: string; level?: 2 | 3; children: ReactNode; defaultOpen?: boolean;
}) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <details className={s.disclosure} open={defaultOpen || undefined}>
      <summary className={s.summary}>
        <Heading className={s.title}>
          <span className={s.label}>{title}{sub && <span className={s.sub}>{sub}</span>}</span>
          <Icon name="chevronDown" size={18} />
        </Heading>
      </summary>
      <div className={s.body}>{children}</div>
    </details>
  );
}
