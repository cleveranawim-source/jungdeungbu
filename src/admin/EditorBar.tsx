import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { SundayStepper } from '../ui/SundayStepper';
import { Icon } from '../ui/icons';
import s from './EditorBar.module.css';

/**
 * 편집 화면 아래에 붙어 다니는 저장 줄(탭 바 바로 위). 스크롤 어디서든 엄지로 저장할 수 있게.
 * 저장 안 한 내용이 있으면 왼쪽 점과 문구로 알리고(색만으로 알리지 않는다),
 * 앱 안 메뉴로 나가려 하면 이 자리가 "저장하지 않은 내용이 있어요" 확인으로 바뀐다.
 */
export function EditorBar({ dirty, note, leave, children }: {
  dirty: boolean;
  /** 저장 줄 위 짧은 안내(예: "임시저장하면 학생 화면에서 내려가요") */
  note?: ReactNode;
  /** 있으면 버튼 대신 이동 확인 */
  leave?: { onStay(): void; onLeave(): void } | null;
  /** 저장 버튼들 */
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // 토스트가 이 줄(특히 이동 확인 버튼)을 가리지 않게 그 높이만큼 토스트를 올린다
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const lift = () => root.style.setProperty('--toast-lift', `${el.offsetHeight + 8}px`);
    lift();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(lift);
    ro?.observe(el);
    return () => { ro?.disconnect(); root.style.removeProperty('--toast-lift'); };
  }, []);
  return (
    <div className={s.bar} ref={ref}>
      {leave ? (
        <LeaveConfirm onStay={leave.onStay} onLeave={leave.onLeave} />
      ) : (
        <>
          <p className={s.state} aria-live="polite">
            {dirty ? (
              <><span className={s.dot} aria-hidden="true" />저장 안 한 내용이 있어요</>
            ) : (
              <><Icon name="check" size={16} />저장된 내용과 같아요</>
            )}
            {note && <span className={s.note}>{note}</span>}
          </p>
          <div className={s.buttons}>{children}</div>
        </>
      )}
    </div>
  );
}

/** 저장 안 한 내용을 두고 날짜를 바꾸거나 나가려 할 때, 그 자리에서 묻는다(브라우저 confirm 창 X). */
export function LeaveConfirm({ onStay, onLeave, detail = '이동하면 지금 고친 내용이 사라져요.', leaveLabel = '저장하지 않고 이동' }: {
  onStay(): void; onLeave(): void;
  /** 무엇을 하면 무엇이 사라지는지 */
  detail?: string;
  leaveLabel?: string;
}) {
  const stayRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { stayRef.current?.focus({ preventScroll: false }); }, []);
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); onStay(); }
  }
  return (
    <div className={s.confirm} role="group" aria-label="저장하지 않은 내용" onKeyDown={onKeyDown}>
      <p className={s.message}>
        <Icon name="alert" size={20} />
        <span>
          <strong>저장하지 않은 내용이 있어요</strong>
          <span className={s.sub}>{detail}</span>
        </span>
      </p>
      <div className={s.confirmButtons}>
        <Button ref={stayRef} variant="secondary" size="sm" onClick={onStay}>계속 쓰기</Button>
        <Button variant="danger" size="sm" onClick={onLeave}>{leaveLabel}</Button>
      </div>
    </div>
  );
}

/**
 * 편집 화면 맨 위 카드: 주일 고르기 + 저장 상태 한 줄 + (복구했으면) 복구 안내 + (날짜를 옮기려 하면) 그 자리 확인.
 */
export function EditorHead({ label, date, thisSunday, latest, onRequestDate, disabled, confirmDate, recovered, onRevert, status }: {
  /** 날짜 묶음 이름("주보 날짜") */
  label: string;
  date: string;
  thisSunday: string;
  latest: string;
  onRequestDate(d: string): void;
  /** 저장 중에는 날짜를 못 옮긴다 */
  disabled?: boolean;
  /** 날짜를 옮기려다 붙잡혔으면 확인 */
  confirmDate?: { onStay(): void; onLeave(): void } | null;
  recovered: boolean;
  onRevert(): void;
  /** 상태 배지와 "○○님이 n분 전 저장" */
  status: ReactNode;
}) {
  return (
    <Card className={s.head}>
      <fieldset className={s.dateSet} disabled={disabled}>
        <SundayStepper label={label} value={date} thisSunday={thisSunday} latest={latest} onChange={onRequestDate} />
      </fieldset>
      {confirmDate && (
        <LeaveConfirm onStay={confirmDate.onStay} onLeave={confirmDate.onLeave}
          detail="다른 주일로 옮기면 지금 고친 내용이 사라져요." leaveLabel="저장하지 않고 옮기기" />
      )}
      <div className={s.status}>{status}</div>
      {recovered && (
        <div className={s.recovered} role="status">
          <Icon name="refresh" size={18} />
          <span className={s.recoveredText}>저장 안 된 내용을 복구했어요</span>
          <Button variant="ghost" size="sm" icon={<Icon name="undo" size={18} />} onClick={onRevert}>되돌리기</Button>
        </div>
      )}
    </Card>
  );
}

/** 상태 배지: 게시됨(초록) · 임시저장(베이지) · 새로(점선). 글자로 알린다. */
export function StateBadge({ tone, children }: { tone: 'ok' | 'draft' | 'new'; children: ReactNode }) {
  return <span className={[s.badge, s[tone]].join(' ')}>{children}</span>;
}
