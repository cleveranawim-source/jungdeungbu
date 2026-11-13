import { useLayoutEffect, useRef } from 'react';
import { Button } from '../ui/Button';
import { Icon } from '../ui/icons';
import { newKey } from './editorUtils';
import ed from './editor.module.css';
import s from './PairRows.module.css';

/** 두 칸짜리 줄 하나(k 는 화면용 key — 저장할 때 뺀다) */
export interface Pair { k: string; a: string; b: string }

export const toPairs = <T,>(list: T[], a: (x: T) => string, b: (x: T) => string): Pair[] =>
  list.map((x) => ({ k: newKey(), a: a(x), b: b(x) }));

/** 저장할 모양: 앞뒤 빈칸 정리, 두 칸 다 빈 줄은 뺀다 */
export const fromPairs = (rows: Pair[]): { a: string; b: string }[] =>
  rows.map((r) => ({ a: r.a.trim(), b: r.b.trim() })).filter((r) => r.a || r.b);

/**
 * 두 칸짜리 줄 목록(추가·지우기). 예: 다음 주 예배위원(맡은 일 | 이름).
 * 칸 라벨 앞에 줄 번호를 화면 읽기용으로 붙인다("1번 맡은 일").
 */
export function PairRows({ legend, labelA, labelB, addLabel, rows, onChange, maxLengthA, maxLengthB, inputModeB }: {
  legend: string;
  labelA: string; labelB: string;
  addLabel: string;
  rows: Pair[]; onChange(rows: Pair[]): void;
  maxLengthA?: number; maxLengthB?: number;
  inputModeB?: 'text' | 'tel';
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const focus = useRef<string | null>(null);

  // 줄을 더하면 새 줄 첫 칸으로, 지우면 이웃 줄(없으면 추가 버튼)로 초점을 옮긴다
  useLayoutEffect(() => {
    const k = focus.current;
    if (k === null) return;
    focus.current = null;
    const target = k ? listRef.current?.querySelector<HTMLElement>(`[data-pair="${k}"]`) : null;
    (target ?? addRef.current)?.focus();
  });

  const set = (i: number, patch: Partial<Pair>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  function remove(i: number) {
    focus.current = (rows[i + 1] ?? rows[i - 1])?.k ?? '';
    onChange(rows.filter((_, j) => j !== i));
  }
  function add() {
    const row: Pair = { k: newKey(), a: '', b: '' };
    focus.current = row.k;
    onChange([...rows, row]);
  }

  return (
    <fieldset className={s.group}>
      <legend className="sr-only">{legend}</legend>
      {rows.length > 0 && (
        <ol className={s.rows} ref={listRef}>
          {rows.map((r, i) => {
            const n = i + 1;
            const id = `pair-${r.k}`;
            return (
              <li key={r.k} className={s.row}>
                <div className={s.cell}>
                  <label className={ed.mini} htmlFor={`${id}-a`}><span className="sr-only">{n}번 </span>{labelA}</label>
                  <input id={`${id}-a`} data-pair={r.k} className={ed.input} autoComplete="off" value={r.a}
                    maxLength={maxLengthA} onChange={(e) => set(i, { a: e.target.value })} />
                </div>
                <div className={s.cell}>
                  <label className={ed.mini} htmlFor={`${id}-b`}><span className="sr-only">{n}번 </span>{labelB}</label>
                  <input id={`${id}-b`} className={ed.input} autoComplete="off" value={r.b}
                    maxLength={maxLengthB} inputMode={inputModeB} type={inputModeB === 'tel' ? 'tel' : 'text'}
                    onChange={(e) => set(i, { b: e.target.value })} />
                </div>
                <button type="button" className={`${ed.icon} ${s.remove}`} aria-label={`${legend} ${n}번 지우기`}
                  onClick={() => remove(i)}><Icon name="trash" size={20} /></button>
              </li>
            );
          })}
        </ol>
      )}
      <Button ref={addRef} variant="ghost" size="sm" className={ed.add} icon={<Icon name="plus" size={18} />} onClick={add}>
        {addLabel}
      </Button>
    </fieldset>
  );
}
