import s from './JourneyLines.module.css';

/** 두 사람이 나란히 걷는 길을 추상화한 장식. 내용이나 교회 로고를 대신하지 않아요. */
export function JourneyLines() {
  return <svg className={s.lines} viewBox="0 0 120 120" fill="none" aria-hidden="true">
    <path d="M116 120C98 92 48 100 50 72S104 36 88 0M100 120C82 92 30 102 34 72S88 36 72 0" />
  </svg>;
}
