import type { ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import s from './TabIcon.module.css';

/** 선 아이콘의 윤곽을 따르는 채움형. 내부 표시는 배경색을 덧칠하지 않고 비워 둬요. */
const FILLED = {
  home: <path fillRule="evenodd" d="M10.7 2.5a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 .7-1.5zM10 13v8h4v-8z" />,
  bulletin: <path fillRule="evenodd" d="M8 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H5a3 3 0 0 0 1-2V4a2 2 0 0 1 2-2ZM4 9v11a1 1 0 0 1-2 0v-9a2 2 0 0 1 2-2Zm6-3v4h8V6Zm0 7v2h8v-2Zm0 4v2h5v-2Z" />,
  sermon: <path d="M3 3h5a3 3 0 0 1 3 3v14a5 5 0 0 0-3-1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm18 0h-5a3 3 0 0 0-3 3v14a5 5 0 0 1 3-1h5a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1Z" />,
  prayer: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />,
  me: <path fillRule="evenodd" d="M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM15 9a3 3 0 1 0-6 0 3 3 0 0 0 6 0Zm-9 9a7.5 7.5 0 0 0 12 0 4 4 0 0 0-4-3h-4a4 4 0 0 0-4 3Z" />,
  attendance: <path fillRule="evenodd" d="M9 2h6a1 1 0 0 1 1 1v1h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2V3a1 1 0 0 1 1-1Zm0 1v2h6V3Zm-.7 10.3-1.4 1.4 4.1 4.1 6.1-6.1-1.4-1.4L11 16Z" />,
  class: <>
    <circle cx="9" cy="7" r="4" />
    <path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2Zm14-17.9a4 4 0 0 1 0 7.8 6 6 0 0 0 0-7.8Zm3 12a4 4 0 0 1 3 3.9v2h-4v-2a6 6 0 0 0-1.4-3.9Z" />
  </>,
  admin: <>
    <path d="M3 4h18M3 12h18M3 20h18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    <circle cx="14" cy="4" r="3" /><circle cx="8" cy="12" r="3" /><circle cx="16" cy="20" r="3" />
  </>,
} satisfies Partial<Record<IconName, ReactNode>>;

export type TabIconName = keyof typeof FILLED;

export function TabIcon({ name, selected }: { name: TabIconName; selected: boolean }) {
  return (
    <span className={s.icon} data-selected={selected} aria-hidden="true">
      <Icon name={name} />
      <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
        {FILLED[name]}
      </svg>
    </span>
  );
}
