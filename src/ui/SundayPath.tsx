import s from './SundayPath.module.css';

/** 표지에 한 번만 쓰는 굵은 길 모양. 장식이므로 읽기에서 제외해요. */
export function SundayPath() {
  return <span className={s.path} aria-hidden="true" />;
}
