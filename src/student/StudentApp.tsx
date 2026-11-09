// 학생 화면: 토큰으로 학생 문서를 한 번 읽고, 뒤에서 익명 세션을 묶고, 탭마다 화면을 그린다.
import { useCallback, useMemo, type ReactNode } from 'react';
import { InvalidLink } from '../app/InvalidLink';
import { studentHref, type StudentTab } from '../app/router';
import { TabBar, type TabItem } from '../app/TabBar';
import { useLoader } from '../app/useLoader';
import { getStudent } from '../data/students';
import { nearestSunday, toDateId } from '../lib/dates';
import { db } from '../lib/firebase';
import { Icon } from '../ui/icons';
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
  { key: 'home', label: '홈', icon: <Icon name="home" /> },
  { key: 'bulletin', label: '주보', icon: <Icon name="bulletin" /> },
  { key: 'sermon', label: '말씀', icon: <Icon name="sermon" /> },
  { key: 'prayer', label: '기도', icon: <Icon name="prayer" /> },
  { key: 'me', label: '나', icon: <Icon name="me" /> },
];

export function StudentApp({ token, tab, sub }: StudentAppProps) {
  // App 이 key={token} 으로 다시 만들므로 토큰이 바뀌면 새로 불러온다
  const { data: student, error, reload } = useLoader(useCallback(() => getStudent(db, token), [token]));
  const session = useStudentSession(token, student?.active === true);
  // "이번 주" = 가장 가까운 주일. 화면이 열려 있는 동안은 고정
  const sundayId = useMemo(() => toDateId(nearestSunday(new Date())), []);

  if (student === undefined) {
    if (error) return <Screen><LoadError error={error} onRetry={reload} /></Screen>;
    return <Screen><Loading /></Screen>;
  }
  // 없는 토큰·비활성(재발급된 옛 링크) 모두 같은 안내
  if (student === null || !student.active) return <InvalidLink />;

  const current = TABS.find((t) => t.key === tab) ?? TABS[0];
  const props: StudentTabProps = {
    student, token, classId: student.classId, sundayId, sub,
    myUid: session.uid, sessionState: session.state, retrySession: session.retry,
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
      title={current.label}
      sub={student.name}
      tabBar={<TabBar items={TABS} current={current.key} onChange={(k) => { location.hash = studentHref(token, k); }} label="학생 메뉴" />}
    >
      {body[current.key]}
    </Screen>
  );
}
