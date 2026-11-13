// 학생 화면: 토큰으로 학생 문서를 한 번 읽고, 뒤에서 익명 세션을 묶고, 탭마다 화면을 그린다.
import { useCallback, useEffect, type ReactNode } from 'react';
import { InvalidLink } from '../app/InvalidLink';
import { studentHref, type StudentTab } from '../app/router';
import { TabBar, type TabItem } from '../app/TabBar';
import { useLoader } from '../app/useLoader';
import { useTodaySunday } from '../app/useTodaySunday';
import { getStudent } from '../data/students';
import { db } from '../lib/firebase';
import { clearLastStudentToken, setLastStudentToken } from '../lib/lastStudentToken';
import { LoadError } from '../ui/LoadError';
import { Loading } from '../ui/Loading';
import { Screen } from '../ui/Screen';
import { BulletinTab } from './BulletinTab';
import { HomeTab } from './HomeTab';
import { MeTab } from './MeTab';
import { PrayerTab } from './PrayerTab';
import { SermonTab } from './SermonTab';
import type { StudentTabProps } from './types';
import { useStudentSession } from './useStudentSession';

export interface StudentAppProps {
  token: string;
  tab: StudentTab;
  /** 탭 안의 화면(지난 주보·설교 날짜). 라우터가 넘긴다 */
  sub?: string;
}

const TABS: readonly TabItem<StudentTab>[] = [
  { key: 'home', label: '홈', icon: 'home' },
  { key: 'bulletin', label: '주보', icon: 'bulletin' },
  { key: 'sermon', label: '말씀', icon: 'sermon' },
  { key: 'prayer', label: '기도', icon: 'prayer' },
  { key: 'me', label: '나', icon: 'me' },
];

export function StudentApp({ token, tab, sub }: StudentAppProps) {
  // App 이 key={token} 으로 다시 만들므로 토큰이 바뀌면 새로 불러온다
  const {
    data: student,
    error,
    reload,
  } = useLoader(useCallback(() => getStudent(db, token), [token]));
  const session = useStudentSession(token, student?.active === true);
  // "이번 주" = 가장 가까운 주일. 날이 바뀌거나 화면이 다시 보일 때만 다시 계산
  const sundayId = useTodaySunday();

  // 홈 화면 앱(start_url)이 링크를 잃어도 랜딩에서 다시 들어오게 기억한다. 닫힌 링크면 잊는다.
  // 선생님 기기(등록된 교사가 학생 링크를 열어 봄)에서는 기억하지 않는다: 공용 기기에 학생 링크를 남기지 않게.
  // 세션 확인(pending)이 끝난 뒤에만 정한다.
  const known = student === undefined ? undefined : student?.active === true;
  const studentDevice = session.state !== 'pending' && session.state !== 'teacher';
  useEffect(() => {
    if (known === true && studentDevice) setLastStudentToken(token);
    else if (session.state === 'teacher') clearLastStudentToken();
    else if (known === false) clearLastStudentToken(undefined, token);
  }, [known, studentDevice, token, session.state]);

  if (student === undefined) {
    if (error)
      return (
        <Screen title="중등부">
          <LoadError error={error} onRetry={reload} audience="student" />
        </Screen>
      );
    return (
      <Screen title="중등부">
        <Loading />
      </Screen>
    );
  }
  // 없는 토큰·비활성(재발급된 옛 링크) 모두 같은 안내
  if (student === null || !student.active) return <InvalidLink />;

  const current = TABS.find((t) => t.key === tab) ?? TABS[0];
  const props: StudentTabProps = {
    student,
    token,
    classId: student.classId,
    sundayId,
    sub,
    myUid: session.uid,
    sessionState: session.state,
    retrySession: session.retry,
  };
  const body: Record<StudentTab, ReactNode> = {
    home: <HomeTab {...props} />,
    bulletin: <BulletinTab {...props} />,
    sermon: <SermonTab {...props} />,
    prayer: <PrayerTab {...props} />,
    me: <MeTab {...props} />,
  };
  return (
    <Screen
      title={current.key === 'home' ? `${student.name}, 반가워요` : current.label}
      sub={
        current.key === 'home'
          ? '함께 예배하는 주일이에요.'
          : current.key === 'bulletin'
            ? undefined
            : student.name
      }
      layout="reading"
      tabBar={
        <TabBar
          items={TABS}
          current={current.key}
          onChange={(k) => {
            location.hash = studentHref(token, k);
          }}
          label="학생 메뉴"
        />
      }
    >
      {body[current.key]}
    </Screen>
  );
}
