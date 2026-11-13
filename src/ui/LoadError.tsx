import { describeError, type ErrorAudience } from '../app/Toast';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Icon } from './icons';

/** 목록을 불러오지 못했을 때: 무슨 일인지(describeError) + 다시 불러오기. */
export function LoadError({ error, onRetry, audience }: { error: unknown; onRetry(): void; audience?: ErrorAudience }) {
  return (
    <EmptyState icon="alert" title="불러오지 못했어요"
      action={<Button variant="secondary" size="sm" icon={<Icon name="refresh" size={18} />} onClick={onRetry}>다시 불러오기</Button>}>
      {describeError(error, audience, 'read')}
    </EmptyState>
  );
}
