import type { ReactNode } from 'react';
import small from '../assets/walking-together/480.webp';
import medium from '../assets/walking-together/800.webp';
import large from '../assets/walking-together/1280.webp';
import s from './IllustratedCover.module.css';

/** 동행 그림은 장식. 제목·날짜·행동은 이미지와 분리된 실제 글자예요. */
export function IllustratedCover({ title, subtitle, children }: {
  title: ReactNode; subtitle?: string; children: ReactNode;
}) {
  return (
    <section className={s.cover}>
      <div className={s.art}>
        <img className={s.image} src={medium} srcSet={`${small} 480w, ${medium} 800w, ${large} 1280w`}
          sizes="(min-width: 900px) 640px, (min-width: 640px) 608px, calc(100vw - 32px)"
          width={1536} height={1024} alt="" fetchPriority="high" decoding="async" />
        <div className={s.copy}>
          <h2 className={s.title}>{title}</h2>
          {subtitle && <p className={s.subtitle}>{subtitle}</p>}
        </div>
      </div>
      <div className={s.foot}>{children}</div>
    </section>
  );
}
