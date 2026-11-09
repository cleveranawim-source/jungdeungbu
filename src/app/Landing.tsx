import { signInAsEmulatorUser } from '../data/teachers';
import { auth } from '../lib/firebase';
import { LinkButton } from '../ui/Button';
import { Icon } from '../ui/icons';
import { Sunrise } from '../ui/Sunrise';
import { EmuLogin } from './EmuLogin';
import { teacherHref } from './router';
import s from './Landing.module.css';

async function emuSignIn(email: string, name: string) {
  await signInAsEmulatorUser(auth, email, name);
  location.hash = teacherHref();
}

/** `#/` 첫 화면. 위는 해돋이와 이름, 아래(엄지 닿는 곳)는 할 일. */
export function Landing() {
  return (
    <main className={s.page}>
      <div className={s.hero}>
        <Sunrise rising className={s.art} />
        <h1 className={s.title}>
          <span className={s.church}>명지대학교교회</span>{' '}
          <span className={s.group}>중등부</span>
        </h1>
        <p className={s.lead}>주보와 말씀, 우리 반 기도 제목을 여기서 함께 봐요.</p>
      </div>
      <div className={s.actions}>
        <p className={s.student}>
          <span className={s.studentMark}><Icon name="link" /></span>
          학생은 선생님이 보내준 링크로 들어와요
        </p>
        <LinkButton href={teacherHref()} size="lg" block icon={<Icon name="login" />}>선생님 로그인</LinkButton>
        <EmuLogin onSignIn={emuSignIn} />
      </div>
    </main>
  );
}
