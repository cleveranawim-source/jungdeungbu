import { useSyncExternalStore } from 'react';
import { Icon } from '../ui/icons';
import s from './OfflineBar.module.css';

function subscribe(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}
const getOnline = () => navigator.onLine;
const getServerOnline = () => true;

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, getOnline, getServerOnline);
}

/** 연결이 끊기면 화면 맨 위에 붙는 띠. 연결되면 사라진다. */
export function OfflineBar() {
  const online = useOnline();
  // 알림 영역(role=status)은 늘 두고 안의 띠만 넣고 빼야 화면 읽기가 바뀜을 읽어 준다.
  return (
    <div role="status" className={online ? undefined : s.sticky}>
      {!online && (
        <div className={s.bar}>
          <Icon name="offline" size={18} />
          오프라인이에요. 연결되면 저장돼요
        </div>
      )}
    </div>
  );
}
