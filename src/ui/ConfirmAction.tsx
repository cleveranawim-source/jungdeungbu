import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { describeError, useToast } from '../app/Toast';
import { Button } from './Button';
import { Icon, type IconName } from './icons';
import s from './ConfirmAction.module.css';

export interface ConfirmActionProps {
  /** 처음 보이는 버튼 글자("링크 재발급") */
  label: string;
  icon?: IconName;
  /** 확인 단계에서 보이는 설명: 무슨 일이 생기는지, 되돌릴 수 있는지 */
  message: ReactNode;
  /** 확인 버튼 글자("재발급하기"). label 과 다른 말로(같은 화면에서 헷갈리지 않게) */
  confirmLabel: string;
  /** 실패하면 던진다 → 오류 토스트, 확인 단계는 열린 채로. 성공 토스트는 부르는 쪽이 띄운다. */
  onConfirm(): Promise<void>;
  disabled?: boolean;
  /** 줄마다 되풀이되는 목록에서: 테두리 없는 글자 버튼(ghost)으로 조용하게. 기본은 보조 버튼 */
  quiet?: boolean;
}

/**
 * 되돌리기 어려운 행동의 줄 안 확인(브라우저 confirm 창을 쓰지 않는다).
 * 버튼을 누르면 그 자리에 설명 + 취소 + 빨간 확인 버튼이 열린다. Esc 나 취소로 닫힌다.
 */
export function ConfirmAction({ label, icon, message, confirmLabel, onConfirm, disabled, quiet = false }: ConfirmActionProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reopenFocus = useRef(false);
  const alive = useRef(true);
  const { show } = useToast();

  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => {
    if (open) cancelRef.current?.focus();
    else if (reopenFocus.current) { reopenFocus.current = false; triggerRef.current?.focus(); }
  }, [open]);

  function close() { reopenFocus.current = true; setOpen(false); }

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
      if (alive.current) setOpen(false);
    } catch (e) {
      show(describeError(e), 'error');
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !busy) { e.stopPropagation(); close(); }
  }

  if (!open) {
    return (
      <span className={s.wrap}>
        <Button ref={triggerRef} variant={quiet ? 'ghost' : 'secondary'} size="sm" className={quiet ? `${s.trigger} ${s.quiet}` : s.trigger} disabled={disabled}
          icon={icon && <Icon name={icon} size={18} />} onClick={() => setOpen(true)}>
          {label}
        </Button>
      </span>
    );
  }
  return (
    <div className={s.box} role="group" aria-label={label} onKeyDown={onKeyDown}>
      <p className={s.message}>
        <Icon name="alert" size={20} />
        <span>{message}</span>
      </p>
      <div className={s.buttons}>
        <Button ref={cancelRef} variant="secondary" size="sm" onClick={close} disabled={busy}>취소</Button>
        <Button variant="danger" size="sm" busy={busy} onClick={confirm}>{confirmLabel}</Button>
      </div>
    </div>
  );
}
