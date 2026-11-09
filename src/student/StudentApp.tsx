// 최소 학생 화면(Task 9): 토큰으로 학생을 찾아 이름과 탭 바만. 탭 내용·익명 로그인은 Task 10 에서 채운다.
import { useCallback } from 'react';
import { InvalidLink } from '../app/InvalidLink';
import { studentHref, type StudentTab } from '../app/router';
import { TabBar, type TabItem } from '../app/TabBar';
import { useLoader } from '../app/useLoader';
import { getStudent } from '../data/students';
import { db } from '../lib/firebase';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/icons';
import { LoadError } from '../ui/LoadError';
import { Loading } from '../ui/Loading';
import { Screen } from '../ui/Screen';

export interface StudentAppProps { token: string; tab: StudentTab }

const TABS: readonly TabItem<StudentTab>[] = [
  { key: 'home', label: '홈', icon: <Icon name="home" /> },
  { key: 'bulletin', label: '주보', icon: <Icon name="bulletin" /> },
  { key: 'sermon', label: '말씀', icon: <Icon name="sermon" /> },
  { key: 'prayer', label: '기도', icon: <Icon name="prayer" /> },
  { key: 'me', label: '나', icon: <Icon name="me" /> },
];

export function StudentApp({ token, tab }: StudentAppProps) {
  // App 이 key={token} 으로 다시 만들므로 토큰이 바뀌면 새로 불러온다
  const { data: student, error, reload } = useLoader(useCallback(() => getStudent(db, token), [token]));

  if (student === undefined) {
    if (error) return <Screen><LoadError error={error} onRetry={reload} /></Screen>;
    return <Screen><Loading /></Screen>;
  }
  // 없는 토큰·비활성(재발급된 옛 링크) 모두 같은 안내
  if (student === null || !student.active) return <InvalidLink />;

  const current = TABS.find((t) => t.key === tab) ?? TABS[0];
  return (
    <Screen
      title={current.label}
      sub={student.name}
      tabBar={<TabBar items={TABS} current={tab} onChange={(k) => { location.hash = studentHref(token, k); }} label="학생 메뉴" />}
    >
      <EmptyState title="준비 중이에요">이 화면은 곧 채워질 거예요.</EmptyState>
    </Screen>
  );
}
