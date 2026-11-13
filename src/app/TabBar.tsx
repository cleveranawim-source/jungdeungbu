import { useRef, type KeyboardEvent } from 'react';
import { TabIcon, type TabIconName } from '../ui/TabIcon';
import s from './TabBar.module.css';

export interface TabItem<K extends string = string> {
  key: K;
  /** 한두 글자 짧은 이름(홈·주보·말씀·기도·나) */
  label: string;
  /** 선택 상태에 따라 선/채움형으로 보여 줄 아이콘 */
  icon: TabIconName;
}

export interface TabBarProps<K extends string = string> {
  items: readonly TabItem<K>[];
  current: K;
  onChange(key: K): void;
  /** 화면 읽기용 이름. 기본 "메뉴" */
  label?: string;
}

/** 하단 고정 탭 바. 높이 56px + 아래 안전 영역. 탭 하나의 터치 영역은 최소 44×56px. */
export function TabBar<K extends string>({ items, current, onChange, label = '메뉴' }: TabBarProps<K>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent, i: number) {
    const last = items.length - 1;
    const next = e.key === 'ArrowRight' ? (i === last ? 0 : i + 1)
      : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : -1;
    if (next < 0) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onChange(items[next].key);
  }

  return (
    <nav className={s.bar} aria-label={label}>
      <div className={s.list} role="tablist" aria-label={label}>
        {items.map((it, i) => {
          const selected = it.key === current;
          return (
            <button
              key={it.key}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="tab"
              className={s.tab}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => { if (!selected) onChange(it.key); }}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              <span className={s.icon} aria-hidden="true"><TabIcon name={it.icon} selected={selected} /></span>
              {it.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
