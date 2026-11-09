import { celebrations } from '../lib/celebrate';
import type { Student } from '../types';
import s from './CelebrationBanner.module.css';

export interface CelebrationBannerProps { student: Student; sundayId: string }

/**
 * 생일 주간·연속 출석(4주마다) 축하. 해당 없으면 아무것도 그리지 않는다(null).
 * 조용한 띠 하나: 움직임·색 폭죽 없이 해 빛무리 테두리와 문구 안 이모지만.
 */
export function CelebrationBanner({ student, sundayId }: CelebrationBannerProps) {
  const items = celebrations(student, sundayId);
  if (items.length === 0) return null;
  return (
    <section className={s.banner} aria-label="축하해요">
      {items.map((c) => <p key={c.kind} className={s.line}>{c.text}</p>)}
    </section>
  );
}
