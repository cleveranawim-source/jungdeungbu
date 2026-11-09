import { Sunrise } from '../ui/Sunrise';
import s from './InvalidLink.module.css';

/**
 * 학생 링크가 틀렸거나 더 이상 쓰지 않는 링크일 때의 한 화면.
 * 두 경우를 구분하지 않는다(스펙). 학생 앱(Task 10)도 학생 문서가 없을 때 이 화면을 그대로 쓴다.
 */
export function InvalidLink() {
  return (
    <main className={s.page}>
      <Sunrise at={0.32} className={s.art} />
      <h1 className={s.title}>선생님께 링크를 다시 받아주세요</h1>
      <p className={s.body}>이 링크로는 들어올 수 없어요. 반 선생님께 말하면 새 링크를 바로 보내 주실 거예요.</p>
    </main>
  );
}
