// 자리 표시: Task 10 에서 학생 화면으로 바꾼다.
import { studentHref, type StudentTab } from '../app/router';
import { TabBar, type TabItem } from '../app/TabBar';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/icons';
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
  const current = TABS.find((t) => t.key === tab) ?? TABS[0];
  return (
    <Screen
      title={current.label}
      tabBar={<TabBar items={TABS} current={tab} onChange={(k) => { location.hash = studentHref(token, k); }} label="학생 메뉴" />}
    >
      <EmptyState title="준비 중이에요">이 화면은 곧 채워질 거예요.</EmptyState>
    </Screen>
  );
}
