import { useId, type ReactNode } from 'react';
import { Icon } from './icons';
import s from './List.module.css';

/** 카드 안의 줄 목록(카드 안에 카드를 넣지 않는다). 줄 사이는 --line 구분선. */
export function List({ children, label }: { children: ReactNode; label?: string }) {
  return <ul className={s.list} aria-label={label}>{children}</ul>;
}

export interface ListRowProps {
  /** 줄 제목(이름 등) */
  title: ReactNode;
  /** 제목 아래 보조 줄(생일, 이메일 …) */
  meta?: ReactNode;
  /** 오른쪽 짧은 값(연속 출석, 역할) */
  aside?: ReactNode;
  /** onToggle 이 있으면 줄 전체가 펼침 버튼이 된다(aria-expanded). */
  open?: boolean;
  onToggle?(): void;
  /** 펼쳤을 때 아래에 열리는 내용(고치기·링크 공유 …) */
  children?: ReactNode;
  /** 줄(li)의 DOM id — 스크롤해 옮겨 갈 때 */
  id?: string;
}

export function ListRow({ title, meta, aside, open = false, onToggle, children, id }: ListRowProps) {
  const panelId = useId();
  const head = (
    <>
      <span className={s.text}>
        <span className={s.title}>{title}</span>
        {meta && <span className={s.meta}>{meta}</span>}
      </span>
      {aside && <span className={s.aside}>{aside}</span>}
      {onToggle && <span className={s.chev} aria-hidden="true"><Icon name="chevronDown" size={20} /></span>}
    </>
  );
  return (
    <li id={id} className={[s.row, open && s.open].filter(Boolean).join(' ')}>
      {onToggle ? (
        <button type="button" className={s.head} aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={onToggle}>
          {head}
        </button>
      ) : (
        <div className={s.head}>{head}</div>
      )}
      {open && children && <div className={s.panel} id={panelId}>{children}</div>}
    </li>
  );
}
