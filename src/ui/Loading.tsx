import s from './Loading.module.css';

/** 불러오는 동안 한 줄. 화면 읽기에는 status 로 읽힌다. */
export function Loading({ children = '불러오는 중이에요' }: { children?: string }) {
  return (
    <p className={s.loading} role="status">
      <span className={s.dot} aria-hidden="true" />
      {children}
    </p>
  );
}
