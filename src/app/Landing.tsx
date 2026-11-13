import { useState } from 'react';
import { signInAsEmulatorUser } from '../data/teachers';
import { auth } from '../lib/firebase';
import { clearLastStudentToken, getLastStudentToken } from '../lib/lastStudentToken';
import { Button, LinkButton } from '../ui/Button';
import { Icon } from '../ui/icons';
import { EmuLogin } from './EmuLogin';
import { studentHref, teacherHref } from './router';
import small from '../assets/walking-together/480.webp';
import medium from '../assets/walking-together/800.webp';
import s from './Landing.module.css';

async function emuSignIn(email: string, name: string) {
  await signInAsEmulatorUser(auth, email, name);
  location.hash = teacherHref();
}

/**
 * `#/` 첫 화면. 교회 이름과 동행 그림 표지, 학생 링크 안내와 로그인 행동을 나눠 보여 준다.
 * 이 기기에서 학생 링크를 연 적이 있으면(홈 화면 앱은 링크 없이 여기로 열린다) "내 화면 열기"를 먼저 보여 준다.
 * 저절로 옮겨 가지 않는다: 선생님이 같은 휴대폰을 쓸 수도 있다.
 */
export function Landing() {
  const [last, setLast] = useState(() => getLastStudentToken());
  return (
    <main className={s.page}>
      <div className={s.hero}>
        <h1 className={s.title}>
          <span className={s.church}>명지대학교교회</span> <span className={s.group}>중등부</span>
        </h1>
        <img
          className={s.art}
          src={medium}
          srcSet={`${small} 480w, ${medium} 800w`}
          sizes="(min-width:900px) 600px, 100vw"
          alt=""
          width={1536}
          height={1024}
        />
        <p className={s.lead}>주보와 말씀, 우리 반 기도 제목을 여기서 함께 봐요.</p>
      </div>
      <div className={s.actions}>
        {last ? (
          <div className={s.resume}>
            <LinkButton href={studentHref(last)} size="lg" block icon={<Icon name="home" />}>
              내 화면 열기
            </LinkButton>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearLastStudentToken();
                setLast(null);
              }}
            >
              다른 링크로 들어왔어요
            </Button>
          </div>
        ) : (
          <p className={s.student}>
            <span className={s.studentMark}>
              <Icon name="link" />
            </span>
            학생은 선생님이 보내준 링크로 들어와요
          </p>
        )}
        <LinkButton
          href={teacherHref()}
          size="lg"
          block
          variant={last ? 'secondary' : 'primary'}
          icon={<Icon name="login" />}
        >
          선생님 로그인
        </LinkButton>
        <EmuLogin onSignIn={emuSignIn} />
      </div>
    </main>
  );
}
