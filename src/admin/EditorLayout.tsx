import type { ReactNode } from 'react';
import { Disclosure } from '../ui/Disclosure';
import s from './EditorLayout.module.css';
export interface EditorSectionLink {
  id: string;
  title: string;
  summary?: string;
}
export function focusEditorSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView({
    block: 'start',
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
}
export function EditorLayout({
  sections,
  children,
  preview,
}: {
  sections: EditorSectionLink[];
  children: ReactNode;
  preview?: ReactNode;
}) {
  const links = sections.map((x) => (
    <button key={x.id} type="button" onClick={() => focusEditorSection(x.id)}>
      <span>{x.title}</span>
      {x.summary && <small>{x.summary}</small>}
    </button>
  ));
  return (
    <div className={[s.layout, preview && s.withPreview].filter(Boolean).join(' ')}>
      <div className={s.mobileNav}>
        <Disclosure title="작성 구역" level={2}>
          <nav aria-label="작성 구역" className={s.links}>
            {links}
          </nav>
        </Disclosure>
      </div>
      <nav aria-label="작성 구역" className={s.desktopNav}>
        <h2>작성 구역</h2>
        <div className={s.links}>{links}</div>
      </nav>
      <div className={s.work}>{children}</div>
      {preview && <aside className={s.preview}>{preview}</aside>}
    </div>
  );
}
export function EditorSection({
  id,
  title,
  description,
  tone,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  tone?: 'gold' | 'sage';
  children: ReactNode;
}) {
  return (
    <section
      className={[s.section, tone && s[tone]].filter(Boolean).join(' ')}
      id={id}
      tabIndex={-1}
      aria-labelledby={`${id}-title`}
    >
      <header className={s.head}>
        <h2 id={`${id}-title`}>{title}</h2>
        {description && <p>{description}</p>}
      </header>
      <div className={s.body}>{children}</div>
    </section>
  );
}
