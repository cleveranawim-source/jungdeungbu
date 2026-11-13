import { celebrations, emphasisParts } from '../lib/celebrate';
import type { Student } from '../types';
import { Icon } from './icons';
import s from './CelebrationBanner.module.css';

export interface CelebrationBannerProps { student: Student; sundayId: string }

/**
 * 생일 주간·연속 출석(4주마다) 축하. 해당 없으면 아무것도 그리지 않는다(null).
 * 조용한 띠 하나: 생일은 선 아이콘, 연속 출석은 주수로 강조해요.
 */
export function CelebrationBanner({ student, sundayId }: CelebrationBannerProps) {
  const items = celebrations(student, sundayId);
  if (items.length === 0) return null;
  return (
    <section className={s.banner} aria-label="축하해요">
      {items.map((c) => (
        <p key={c.kind} className={s.line}>
          {c.kind === 'birthday' && <Icon name="cake" size={20} />}
          <span>{emphasisParts(c.text).map((part, i) => (part.strong ? <strong key={i} className={s.num}>{part.text}</strong> : part.text))}</span>
        </p>
      ))}
    </section>
  );
}
