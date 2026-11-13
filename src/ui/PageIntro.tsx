import type { ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import s from './PageIntro.module.css';
/** 한 화면의 할 일을 짧게 알려요. 장식 표지는 입구·홈·주보에서만 써요. */
export function PageIntro({
  title,
  children,
  icon,
  tone = 'sage',
}: {
  title: string;
  children: ReactNode;
  icon: IconName;
  tone?: 'sage' | 'gold';
}) {
  return (
    <section className={s.intro}>
      <span className={`${s.mark} ${s[tone]}`}><Icon name={icon} size={24} /></span>
      <div>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
    </section>
  );
}
