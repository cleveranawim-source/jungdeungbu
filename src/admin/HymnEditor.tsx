import { useLayoutEffect, useRef } from 'react';
import { Button } from '../ui/Button';
import { Icon } from '../ui/icons';
import { newKey } from './formShape';
import type { Hymn } from './bulletinEditorForm';
import ed from './editor.module.css';
// ---------- 찬양 목록 ----------

export function HymnEditor({ hymns, onChange }: { hymns: Hymn[]; onChange(h: Hymn[]): void }) {
  const listRef = useRef<HTMLUListElement>(null);
  const focus = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (focus.current === null) return;
    listRef.current?.querySelector<HTMLElement>(`[data-hymn="${focus.current}"]`)?.focus();
    focus.current = null;
  });

  function remove(i: number) {
    const rest = hymns.filter((_, j) => j !== i);
    const next = rest.length ? rest : [{ k: newKey(), text: '' }];
    focus.current = (next[i] ?? next[i - 1]).k;
    onChange(next);
  }
  function add() {
    const h = { k: newKey(), text: '' };
    focus.current = h.k;
    onChange([...hymns, h]);
  }

  return (
    <>
      <ul className={ed.lines} ref={listRef}>
        {hymns.map((h, i) => (
          <li key={h.k} className={ed.line}>
            <label className={ed.num} htmlFor={`hymn-${h.k}`}>
              <span className="sr-only">찬양 </span>
              {i + 1}
            </label>
            <input
              id={`hymn-${h.k}`}
              data-hymn={h.k}
              className={ed.input}
              autoComplete="off"
              value={h.text}
              placeholder={i === 0 ? '예: 찬송가 288장' : undefined}
              onChange={(e) =>
                onChange(hymns.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
              }
            />
            <button
              type="button"
              className={ed.icon}
              aria-label={`${i + 1}번째 찬양 지우기`}
              disabled={hymns.length === 1 && !h.text}
              onClick={() => remove(i)}
            >
              <Icon name="trash" size={20} />
            </button>
          </li>
        ))}
      </ul>
      <Button
        variant="ghost"
        size="sm"
        className={ed.add}
        icon={<Icon name="plus" size={18} />}
        onClick={add}
      >
        찬양 추가
      </Button>
    </>
  );
}
