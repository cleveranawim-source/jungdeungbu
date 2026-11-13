import { useId, useState, type ReactNode } from 'react';
import { Icon } from './icons';
import s from './Disclosure.module.css';

/** 제목은 버튼 바깥에 두어 iOS 화면 읽기에서도 제목 단계가 유지돼요. */
export function Disclosure({
  title,
  sub,
  level = 3,
  children,
  defaultOpen = false,
  tone = 'default',
  open,
  onOpenChange,
}: {
  title: string;
  sub?: string;
  level?: 2 | 3;
  children: ReactNode;
  defaultOpen?: boolean;
  tone?: 'default' | 'cover';
  open?: boolean;
  onOpenChange?(open: boolean): void;
}) {
  const id = useId();
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const expanded = open ?? localOpen;
  const Heading = level === 2 ? 'h2' : 'h3';
  function toggle() {
    if (open === undefined) setLocalOpen(!expanded);
    onOpenChange?.(!expanded);
  }
  return (
    <div className={[s.disclosure, tone === 'cover' && s.onCover].filter(Boolean).join(' ')}>
      <Heading className={s.title}>
        <button
          className={s.trigger}
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={toggle}
        >
          <span className={s.label}>
            {title}
            {sub && <span className={s.sub}>{sub}</span>}
          </span>
          <Icon name="chevronDown" size={18} />
        </button>
      </Heading>
      <div id={id} hidden={!expanded} className={s.body}>
        {children}
      </div>
    </div>
  );
}
