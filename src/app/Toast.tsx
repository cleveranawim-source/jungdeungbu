import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../ui/icons';
import s from './Toast.module.css';

export type ToastKind = 'info' | 'error';

interface ToastApi {
  show(message: string, kind?: ToastKind): void;
}

interface Item { id: number; message: string; kind: ToastKind }

/** 사라지기까지: 안내 3.5초, 오류 6초. 눌러서 바로 닫을 수도 있다. */
const DURATION: Record<ToastKind, number> = { info: 3500, error: 6000 };
const MAX = 3;

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  // 화면 읽기용: 늘 있는 알림 영역 두 개에 마지막 문구를 넣는다(안내는 polite, 오류는 assertive).
  const [spoken, setSpoken] = useState<Record<ToastKind, string>>({ info: '', error: '' });
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((xs) => xs.filter((x) => x.id !== id));
  }, []);

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = ++seq.current;
    setItems((xs) => {
      // 같은 문구가 떠 있으면 하나만 남긴다(연속 실패 시 쌓이지 않게)
      const rest = xs.filter((x) => x.message !== message).slice(-(MAX - 1));
      return [...rest, { id, message, kind }];
    });
    setSpoken((p) => ({ ...p, [kind]: message }));
    timers.current.set(id, setTimeout(() => dismiss(id), DURATION[kind]));
  }, [dismiss]);

  useEffect(() => {
    const t = timers.current;
    return () => { t.forEach(clearTimeout); t.clear(); };
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="sr-only" role="status">{spoken.info}</div>
      <div className="sr-only" role="alert">{spoken.error}</div>
      <div className={s.region}>
        {items.map((it) => (
          <div key={it.id} className={[s.toast, it.kind === 'error' && s.error].filter(Boolean).join(' ')}>
            <Icon name={it.kind === 'error' ? 'alert' : 'check'} size={20} />
            <span className={s.msg}>{it.message}</span>
            <button type="button" className={s.close} aria-label="알림 닫기" onClick={() => dismiss(it.id)}>
              <Icon name="close" size={18} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('useToast는 ToastProvider 안에서만 쓸 수 있습니다');
  return api;
}

/** 오류 문구를 누구에게 보여 주는지. 학생에게는 "담당 반" 같은 교사 말을 쓰지 않는다. */
export type ErrorAudience = 'teacher' | 'student';

/**
 * 오류를 사용자에게 보여 줄 문장으로 바꾼다.
 * Firestore 오류 코드(`permission-denied`, `unavailable`; `firestore/…` 접두어도 허용)는 정해진 문구로, 나머지는 message.
 * `audience` 가 'student' 면 권한 오류를 학생이 할 수 있는 일(링크 다시 열기)로 안내한다.
 */
export function describeError(e: unknown, audience: ErrorAudience = 'teacher', operation: 'read' | 'write' = 'write'): string {
  const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : '';
  const short = code.split('/').pop();
  if (short === 'permission-denied') {
    return audience === 'student'
      ? '링크를 다시 열어 주세요. 계속 안 되면 선생님께 말해 주세요'
      : '권한이 없어요. 담당 반이 맞는지 확인해 주세요';
  }
  if (short === 'unavailable') return operation === 'read'
    ? '연결이 끊겼어요. 연결을 확인한 뒤 다시 불러와 주세요'
    : '연결이 끊겼어요. 연결을 확인한 뒤 다시 시도해 주세요';
  const msg = typeof e === 'object' && e !== null && 'message' in e ? (e as { message: unknown }).message : undefined;
  return typeof msg === 'string' && msg ? msg : '문제가 생겼어요. 잠시 뒤 다시 해 주세요';
}
