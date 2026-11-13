import { birthdayCelebration } from '../lib/celebrate';
import type { Student } from '../types';
import { Icon } from './icons';
import s from './CelebrationBanner.module.css';

export interface CelebrationBannerProps { student: Student; sundayId: string }

/** 홈에는 생일 축하만 보여 줘요. 해당 없으면 빈자리 없이 빠져요. */
export function CelebrationBanner({ student, sundayId }: CelebrationBannerProps) {
  const birthday = birthdayCelebration(student, sundayId);
  if (!birthday) return null;
  return (
    <section className={s.banner} aria-label="축하해요">
      <p className={s.line}>
        <Icon name="cake" size={20} />
        <span>{birthday}</span>
      </p>
    </section>
  );
}
