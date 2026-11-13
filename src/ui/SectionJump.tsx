import s from './SectionJump.module.css';

export function SectionJump({ items }: { items: { id: string; label: string }[] }) {
  if (items.length === 0) return null;
  function jump(id: string) {
    const target = document.getElementById(id);
    if (!target) return;
    // 이 앱은 hash 라우터이므로 #구역 링크로 경로를 바꾸지 않아요.
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  return (
    <nav className={s.nav} aria-label="주보 안에서 이동">
      {items.map((item) => <button key={item.id} type="button" className={s.button} onClick={() => jump(item.id)}>{item.label}</button>)}
    </nav>
  );
}
