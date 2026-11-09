// 자리 표시: Task 9 에서 교사 화면으로 바꾼다.
import { EmptyState } from '../ui/EmptyState';
import { Screen } from '../ui/Screen';

export interface TeacherAppProps { tab: string }

export function TeacherApp(_props: TeacherAppProps) {
  return (
    <Screen title="선생님">
      <EmptyState title="준비 중이에요">교사 화면은 곧 채워질 거예요.</EmptyState>
    </Screen>
  );
}
