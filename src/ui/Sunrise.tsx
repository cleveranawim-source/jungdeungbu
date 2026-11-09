import { useId } from 'react';
import s from './Sunrise.module.css';

export interface SunriseProps {
  /** 처음 한 번 해가 떠오르는 움직임(랜딩 전용). 움직임 줄이기 설정이면 바로 그려진다. */
  rising?: boolean;
  /** 해 위치(0.3~0.7, 가로 비율 — 빛무리가 잘리지 않는 범위). 기본 0.66 — 왼쪽 정렬 제목과 엇갈리게. */
  at?: number;
  className?: string;
}

/** 이 앱의 상징: 지평선 위로 떠오르는 주일 아침 해. 장식이므로 화면 읽기에서 숨긴다. */
export function Sunrise({ rising, at = 0.66, className }: SunriseProps) {
  const clip = 'sky' + useId().replace(/[^A-Za-z0-9_-]/g, '');
  const W = 360, H = 132, y = 120, cx = Math.round(W * at);
  return (
    <svg
      className={[s.art, rising && s.rising, className].filter(Boolean).join(' ')}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={clip}><rect x="0" y="0" width={W} height={y} /></clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <circle className={s.halo2} cx={cx} cy={y} r="108" />
        <circle className={s.halo1} cx={cx} cy={y} r="82" />
        <g className={s.sunGroup}>
          <circle className={s.sun} cx={cx} cy={y} r="56" />
        </g>
      </g>
      <line className={s.horizon} x1="2" y1={y} x2={W - 2} y2={y} />
    </svg>
  );
}
