import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { Icon } from '../ui/icons';
import { newKey } from './formShape';
import { previewOrder, type OrderRow } from './bulletinEditorForm';
import ed from './editor.module.css';
import s from './OrderEditor.module.css';

type Focus = { k: string; part: 'type' | 'up' | 'down' } | 'add';
/** 한 입력 DOM을 휴대폰에서는 펼침 행, 넓은 화면에서는 표 셀로 배치해요. */
export function OrderEditor({
  rows,
  onChange,
  scripture,
  sermonTitle,
}: {
  rows: OrderRow[];
  onChange(rows: OrderRow[]): void;
  scripture: string;
  sermonTitle: string;
}) {
  const [wide, setWide] = useState(() => matchMedia('(min-width: 900px)').matches);
  useEffect(() => {
    const mq = matchMedia('(min-width: 900px)');
    const change = () => setWide(mq.matches);
    mq.addEventListener('change', change);
    return () => mq.removeEventListener('change', change);
  }, []);
  const [open, setOpen] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const focus = useRef<Focus | null>(null);
  const previews = previewOrder(rows, scripture, sermonTitle);
  useLayoutEffect(() => {
    const f = focus.current;
    if (!f) return;
    focus.current = null;
    if (f === 'add') {
      addRef.current?.focus();
      return;
    }
    const row = root.current?.querySelector(`[data-order-edit="${f.k}"]`);
    const el =
      row?.querySelector<HTMLElement>(`[data-part="${f.part}"]:not(:disabled)`) ??
      row?.querySelector<HTMLElement>('[data-part="type"]');
    el?.focus();
  });
  const set = (i: number, patch: Partial<OrderRow>) =>
    onChange(rows.map((r, j) => (i === j ? { ...r, ...patch } : r)));
  function move(i: number, delta: -1 | 1) {
    const next = [...rows];
    [next[i], next[i + delta]] = [next[i + delta], next[i]];
    setOpen(rows[i].k);
    focus.current = { k: rows[i].k, part: delta < 0 ? 'up' : 'down' };
    onChange(next);
  }
  function remove(i: number) {
    const next = rows[i + 1] ?? rows[i - 1];
    setOpen(next?.k ?? null);
    focus.current = next ? { k: next.k, part: 'type' } : 'add';
    onChange(rows.filter((_, j) => i !== j));
  }
  function add() {
    const r: OrderRow = { k: newKey(), type: '', title: '', detail: '', standing: false };
    setOpen(r.k);
    focus.current = { k: r.k, part: 'type' };
    onChange([...rows, r]);
  }
  return (
    <div ref={root}>
      <table className={s.table} role={wide ? undefined : "presentation"} aria-label={wide ? "예배 순서 줄" : undefined}>
        <colgroup>
          <col className={s.numberCol} />
          <col className={s.typeCol} />
          <col className={s.contentCol} />
          <col className={s.personCol} />
          <col className={s.standCol} />
          <col className={s.actionsCol} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" aria-label="번호">
              #
            </th>
            <th scope="col">이름</th>
            <th scope="col">내용</th>
            <th scope="col">맡은 사람</th>
            <th scope="col">일어서서</th>
            <th scope="col">옮기기·삭제</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const n = i + 1;
            const id = `order-${r.k}`;
            const view = previews.get(r.k);
            const expanded = open === r.k;
            return (
              <Fragment key={r.k}>
                <tr className={s.summaryRow} data-order-summary={r.k}>
                  <th colSpan={6}>
                    <button
                      type="button"
                      className={s.summary}
                      aria-expanded={expanded}
                      aria-controls={id}
                      aria-label={`${n}번 ${r.type || '새 순서'} 편집`}
                      aria-describedby={`${id}-summary`}
                      onClick={() => setOpen(expanded ? null : r.k)}
                    >
                      <span className={s.number}>{n}</span>
                      <span className={s.summaryCopy}>
                        <strong>{r.type || '새 순서'}</strong>
                        <span id={`${id}-summary`}>
                          {view?.title || ''}
                          {r.detail && <span className={s.person}>{r.detail}</span>}
                        {r.standing && <span className="sr-only">일어서서</span>}
                        {view?.from && <small>이번 주 말씀에서 가져와요</small>}
                        </span>
                      </span>
                      {r.standing && <span className={s.standingMark}>일어서서</span>}
                      <Icon name="chevronDown" size={18} />
                    </button>
                  </th>
                </tr>
                <tr
                  id={id}
                  data-order-edit={r.k}
                  className={[s.editRow, expanded && s.expanded].filter(Boolean).join(' ')}
                >
                  <th scope="row" className={s.rowNumber}>
                    {n}
                  </th>
                  <td className={s.typeCell}>
                    <label className={ed.mini} htmlFor={`${id}-type`}>
                      <span className="sr-only">{n}번 </span>순서 이름
                    </label>
                    <input
                      id={`${id}-type`}
                      data-part="type"
                      className={ed.input}
                      value={r.type}
                      autoComplete="off"
                      onChange={(e) => set(i, { type: e.target.value })}
                    />
                  </td>
                  <td className={s.contentCell}>
                    <label className={ed.mini} htmlFor={`${id}-title`}>
                      <span className="sr-only">{n}번 </span>내용
                    </label>
                    <textarea
                      id={`${id}-title`}
                      className={ed.input}
                      rows={2}
                      value={r.title}
                      placeholder={view?.from ? view.title : undefined}
                      onChange={(e) => set(i, { title: e.target.value })}
                    />
                    {view?.from && (
                      <p className={s.linked}>이번 주 말씀에서 가져와요: {view.title}</p>
                    )}
                  </td>
                  <td className={s.personCell}>
                    <label className={ed.mini} htmlFor={`${id}-detail`}>
                      <span className="sr-only">{n}번 </span>맡은 사람
                    </label>
                    <input
                      id={`${id}-detail`}
                      className={ed.input}
                      value={r.detail}
                      autoComplete="off"
                      onChange={(e) => set(i, { detail: e.target.value })}
                    />
                  </td>
                  <td className={s.standCell}>
                    <label className={s.stand}>
                      <input
                        type="checkbox"
                        checked={r.standing}
                        onChange={(e) => set(i, { standing: e.target.checked })}
                      />
                      <span>
                        <span className="sr-only">{n}번 </span>일어서서
                      </span>
                    </label>
                  </td>
                  <td className={s.actionsCell}>
                    <div className={s.actions}>
                      <button
                        type="button"
                        className={ed.icon}
                        data-part="up"
                        aria-label={`${n}번 순서 위로`}
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                      >
                        <Icon name="chevronUp" />
                      </button>
                      <button
                        type="button"
                        className={ed.icon}
                        data-part="down"
                        aria-label={`${n}번 순서 아래로`}
                        disabled={i === rows.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <Icon name="chevronDown" />
                      </button>
                      <button
                        type="button"
                        className={ed.icon}
                        aria-label={`${n}번 순서 지우기`}
                        onClick={() => remove(i)}
                      >
                        <Icon name="trash" size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <Button
        ref={addRef}
        variant="ghost"
        size="sm"
        icon={<Icon name="plus" size={18} />}
        onClick={add}
      >
        순서 추가
      </Button>
    </div>
  );
}
