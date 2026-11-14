import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { Field, TextArea } from '../ui/Field';
import { Icon } from '../ui/icons';
import { newKey } from './editorUtils';
import { pairRowStatus } from './infoPairRowsState';
import type { Pair } from './PairRows';
import s from './InfoPairRows.module.css';

/** 안내의 이름·연락처: 목록마다 한 줄을 열며, 접기는 저장하지 않는다. */
export function InfoPairRows({
  legend, labelA, labelB, addLabel, rows, savedRows, onChange, multilineB, inputModeB,
}: {
  legend: string;
  labelA: string;
  labelB: string;
  addLabel: string;
  rows: Pair[];
  savedRows: Pair[];
  onChange(rows: Pair[]): void;
  multilineB?: boolean;
  inputModeB?: 'text' | 'tel';
}) {
  const id = useId();
  const [open, setOpen] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const addRef = useRef<HTMLButtonElement>(null);
  const focus = useRef<{ k: string; edit: boolean } | null>(null);

  useLayoutEffect(() => {
    if (!focus.current) return;
    const { k, edit } = focus.current;
    focus.current = null;
    const row = rowRefs.current.get(k);
    const target = row?.querySelector<HTMLElement>(edit ? 'input' : 'button');
    (target ?? addRef.current)?.focus();
  });

  function toggle(k: string) {
    const edit = open !== k;
    focus.current = { k, edit };
    setOpen(edit ? k : null);
  }
  function close(k: string) {
    focus.current = { k, edit: false };
    setOpen(null);
  }
  function add() {
    const row = { k: newKey(), a: '', b: '' };
    focus.current = { k: row.k, edit: true };
    setOpen(row.k);
    onChange([...rows, row]);
  }
  function remove(index: number) {
    focus.current = { k: (rows[index + 1] ?? rows[index - 1])?.k ?? '', edit: false };
    setOpen(null);
    onChange(rows.filter((_, i) => i !== index));
  }
  const update = (k: string, patch: Partial<Pair>) =>
    onChange(rows.map((row) => row.k === k ? { ...row, ...patch } : row));

  return (
    <fieldset className={s.group}>
      <legend className="sr-only">{legend}</legend>
      <p className={s.hint}>요약 줄을 눌러 고쳐요. 저장은 아래에서 한 번에 해요.</p>
      <ol className={s.rows}>
        {rows.map((row, index) => {
          const expanded = open === row.k;
          const panelId = `${id}-${row.k}-panel`;
          const empty = !row.a.trim() && !row.b.trim();
          const status = pairRowStatus(row, savedRows);
          return (
            <li key={row.k} className={s.row} ref={(el) => {
              if (el) rowRefs.current.set(row.k, el);
              else rowRefs.current.delete(row.k);
            }}>
              <button
                type="button"
                className={s.summary}
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => toggle(row.k)}
              >
                <span className={s.content}>
                  <span className={s.name}>{empty ? '내용 없음' : row.a.trim() || `${labelA} 없음`}</span>
                  <span className={s.detail}>{empty ? '필요한 내용만 적어요' : row.b.trim() || `${labelB} 없음`}</span>
                </span>
                {status && <span className={s.status}>{status}</span>}
                <Icon name="chevronDown" size={20} />
              </button>
              <div id={panelId} hidden={!expanded} className={s.panel} onKeyDown={(e) => {
                // Safari의 조합 취소 직후에는 isComposing이 false여도 keyCode가 229다.
                if (e.key === 'Escape' && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) {
                  e.preventDefault();
                  e.stopPropagation();
                  close(row.k);
                }
              }}>
                <Field
                  label={<><span className="sr-only">{index + 1}번 </span>{labelA}</>}
                  value={row.a}
                  autoComplete="off"
                  onChange={(e) => update(row.k, { a: e.target.value })}
                />
                {multilineB ? (
                  <TextArea
                    label={<><span className="sr-only">{index + 1}번 </span>{labelB}</>}
                    rows={3}
                    value={row.b}
                    onChange={(e) => update(row.k, { b: e.target.value })}
                  />
                ) : (
                  <Field
                    label={<><span className="sr-only">{index + 1}번 </span>{labelB}</>}
                    value={row.b}
                    autoComplete="off"
                    inputMode={inputModeB}
                    type={inputModeB === 'tel' ? 'tel' : 'text'}
                    onChange={(e) => update(row.k, { b: e.target.value })}
                  />
                )}
                <div className={s.actions}>
                  <Button variant="ghost" size="sm" icon={<Icon name="trash" size={18} />}
                    aria-label={`${legend} ${index + 1}번 지우기`} onClick={() => remove(index)}>지우기</Button>
                  <Button variant="secondary" size="sm" onClick={() => close(row.k)}>접기</Button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <Button ref={addRef} variant="ghost" size="sm" icon={<Icon name="plus" size={18} />} onClick={add}>
        {addLabel}
      </Button>
    </fieldset>
  );
}
