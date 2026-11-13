import type { ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import s from './EmptyState.module.css';

export interface EmptyStateProps {
  icon?: IconName;
  /** 지금 상태를 한 문장으로("이번 주 주보가 아직 없어요") */
  title: ReactNode;
  /** 다음에 무엇을 하면 되는지 */
  children?: ReactNode;
  /** 할 수 있는 행동이 있으면 버튼 하나 */
  action?: ReactNode;
}

/** 빈 목록·준비 중·안내. 차분한 면 + 상태 아이콘 + 다음 행동. */
export function EmptyState({ icon = 'sprout', title, children, action }: EmptyStateProps) {
  return (
    <div className={s.empty}>
      <span className={s.mark}>
        <Icon name={icon} />
      </span>
      <div className={s.text}>
        <h2 className={s.title}>{title}</h2>
        {children && <p className={s.body}>{children}</p>}
        {action && <div className={s.action}>{action}</div>}
      </div>
    </div>
  );
}
