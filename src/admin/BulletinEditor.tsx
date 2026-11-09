import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { describeError, useToast } from '../app/Toast';
import { useLoader } from '../app/useLoader';
import { getBulletin, getSermon, getTemplate, listBulletins, saveBulletin, saveTemplate } from '../data/content';
import { formatAgo, formatMonthDay, shiftDateId } from '../lib/dates';
import { db } from '../lib/firebase';
import type { Bulletin, OrderItem } from '../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Field } from '../ui/Field';
import { Icon } from '../ui/icons';
import { LoadError } from '../ui/LoadError';
import { Loading } from '../ui/Loading';
import { EditorBar, EditorHead, StateBadge } from './EditorBar';
import { useEditorDraft } from './useEditorDraft';
import { newKey, useNow, useSavedBy } from './editorUtils';
import s from './BulletinEditor.module.css';

// 화면용 폼: 줄마다 움직여도 입력칸이 따라가도록 key 를 붙인다(저장할 때 뺀다)
interface Row extends OrderItem { k: string }
interface Hymn { k: string; text: string }
interface Form { order: Row[]; hymns: Hymn[]; scripture: string; sermonTitle: string }
type Doc = Pick<Bulletin, 'order' | 'hymns' | 'scripture' | 'sermonTitle'>;

const toRows = (order: OrderItem[]): Row[] => order.map((o) => ({ type: o.type, title: o.title, detail: o.detail, k: newKey() }));
const toHymns = (hymns: string[]): Hymn[] => (hymns.length ? hymns : ['']).map((text) => ({ k: newKey(), text }));
const fromDoc = (d: Doc): Form => ({ order: toRows(d.order), hymns: toHymns(d.hymns), scripture: d.scripture, sermonTitle: d.sermonTitle });

/** 저장할 모양: 앞뒤 빈칸 정리, 빈 줄·빈 찬양 빼기. 저장 안 한 내용 판단도 이 모양으로 비교한다. */
function toDoc(f: Form): Doc {
  return {
    order: f.order
      .map((r) => ({ type: r.type.trim(), title: r.title.trim(), detail: r.detail.trim() }))
      .filter((r) => r.type || r.title || r.detail),
    hymns: f.hymns.map((h) => h.text.trim()).filter(Boolean),
    scripture: f.scripture.trim(),
    sermonTitle: f.sermonTitle.trim(),
  };
}

interface Meta { published: boolean; by: string; at: number }

/**
 * 관리 → 주보 작성. 주일을 고르면 그 날 주보를 열고(없으면 템플릿 순서로 시작),
 * 예배 순서·찬양·말씀을 채워 "임시저장"(학생에게 안 보임) 또는 "게시".
 */
export function BulletinEditor({ myUid, thisSunday }: { myUid: string; thisSunday: string }) {
  const { show } = useToast();
  const [date, setDate] = useState(thisSunday);
  const draft = useEditorDraft<Form>('bulletin', date, setDate, toDoc);
  const [busy, setBusy] = useState<'draft' | 'publish' | 'template' | null>(null);
  const [savedMeta, setSavedMeta] = useState<{ date: string; meta: Meta } | null>(null);
  const [copied, setCopied] = useState<{ date: string; from: string; before: Pick<Form, 'order' | 'hymns'> } | null>(null);
  const latest = shiftDateId(thisSunday, 28); // 4주 뒤 주일까지 미리 준비

  const one = useLoader(useCallback(async () => {
    const [bulletin, sermon] = await Promise.all([getBulletin(db, date), getSermon(db, date)]);
    const template = bulletin ? null : await getTemplate(db);
    return { date, bulletin, sermon, template };
  }, [date]));
  // 지난 주보 복사용(게시본, 최신순). 실패해도 편집은 된다
  const past = useLoader(useCallback(() => listBulletins(db), []));
  const savedBy = useSavedBy();
  const now = useNow();

  const loaded = one.data?.date === date ? one.data : undefined;
  const { open } = draft;
  useEffect(() => {
    if (!loaded) return;
    open(fromDoc(loaded.bulletin ?? { order: loaded.template!.order, hymns: [], scripture: '', sermonTitle: '' }));
  }, [loaded, open]);

  const form = draft.value;
  if (!loaded || !form) {
    if (one.error && !one.loading) return <LoadError error={one.error} onRetry={one.reload} />;
    return <Loading />;
  }

  const meta: Meta | null = savedMeta?.date === date ? savedMeta.meta
    : loaded.bulletin ? { published: loaded.bulletin.published, by: loaded.bulletin.updatedBy, at: loaded.bulletin.updatedAt?.toMillis() ?? now }
    : null;
  const sermon = loaded.sermon;
  const source = past.data?.find((b) => b.date < date);
  const update = (patch: Partial<Form>) => draft.set((f) => ({ ...f, ...patch }));

  async function save(published: boolean) {
    const doc = toDoc(form!);
    setBusy(published ? 'publish' : 'draft');
    try {
      await saveBulletin(db, myUid, { date, ...doc, published });
      draft.saved(fromDoc(doc));
      setSavedMeta({ date, meta: { published, by: myUid, at: Date.now() } });
      setCopied(null);
      show(published ? '게시했어요' : '임시저장했어요');
      if (published) void past.reload();
    } catch (e) {
      show(describeError(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function saveAsTemplate() {
    setBusy('template');
    try {
      await saveTemplate(db, { order: toDoc(form!).order });
      show('예배 순서를 템플릿으로 저장했어요');
    } catch (e) {
      show(describeError(e), 'error');
    } finally {
      setBusy(null);
    }
  }

  function copyFrom(b: Bulletin) {
    setCopied({ date, from: b.date, before: { order: form!.order, hymns: form!.hymns } });
    update({ order: toRows(b.order), hymns: toHymns(b.hymns) });
  }

  const status = meta ? (
    <>
      <StateBadge tone={meta.published ? 'ok' : 'draft'}>{meta.published ? '게시됨' : '임시저장'}</StateBadge>
      <span>{savedBy(meta.by)}님이 {formatAgo(meta.at, now)} 저장</span>
    </>
  ) : (
    <>
      <StateBadge tone="new">새 주보</StateBadge>
      <span>템플릿 순서로 시작했어요</span>
    </>
  );

  const pending = draft.pending;
  return (
    <div className={s.stack}>
      <EditorHead label="주보 날짜" date={date} thisSunday={thisSunday} latest={latest} disabled={busy !== null}
        onRequestDate={draft.requestDate}
        confirmDate={pending?.kind === 'date' ? { onStay: draft.stay, onLeave: draft.leave } : null}
        recovered={draft.recovered} onRevert={draft.revert} status={status} />

      <Card title="예배 순서">
        <OrderEditor rows={form.order} onChange={(order) => update({ order })} />
        <div className={s.tools}>
          <Button variant="secondary" size="sm" icon={<Icon name="copy" size={18} />} disabled={!source}
            onClick={() => source && copyFrom(source)}>
            지난 주보 복사
          </Button>
          <Button variant="secondary" size="sm" icon={<Icon name="list" size={18} />} busy={busy === 'template'}
            onClick={saveAsTemplate}>
            예배 순서 템플릿으로 저장
          </Button>
        </div>
        {copied?.date === date ? (
          <p className={s.note} role="status">
            <span>{formatMonthDay(copied.from)} 주보의 순서와 찬양을 가져왔어요.</span>
            <Button variant="ghost" size="sm" icon={<Icon name="undo" size={18} />}
              onClick={() => { update(copied.before); setCopied(null); }}>
              되돌리기
            </Button>
          </p>
        ) : (
          <p className={s.hint}>
            {source ? `지난 주보 복사는 ${formatMonthDay(source.date)} 주보의 순서와 찬양을 가져와요. ` : '복사할 지난 주보가 아직 없어요. '}
            템플릿은 새 주보를 열 때 처음 채워지는 순서예요.
          </p>
        )}
      </Card>

      <Card title="찬양">
        <HymnEditor hymns={form.hymns} onChange={(hymns) => update({ hymns })} />
      </Card>

      <Card title="말씀">
        <div className={s.fields}>
          <Field label="성경 본문" autoComplete="off" value={form.scripture} placeholder="마가복음 4:35-41"
            onChange={(e) => update({ scripture: e.target.value })} />
          <Field label="설교 제목" autoComplete="off" value={form.sermonTitle}
            onChange={(e) => update({ sermonTitle: e.target.value })}
            hint={sermon ? undefined : '설교 작성에서 이 주일 설교를 쓰면 제목을 가져올 수 있어요'} />
          {sermon && sermon.title && sermon.title !== form.sermonTitle && (
            <div className={s.fetch}>
              <Button variant="secondary" size="sm" icon={<Icon name="sermon" size={18} />}
                onClick={() => update({ sermonTitle: sermon.title, scripture: form.scripture || sermon.scripture })}>
                설교 제목 가져오기
              </Button>
              <span className={s.fetchFrom}>{sermon.title}</span>
            </div>
          )}
        </div>
      </Card>

      <EditorBar dirty={draft.dirty}
        note={meta?.published ? '임시저장하면 학생 화면에서 내려가요' : '게시해야 학생에게 보여요'}
        leave={pending?.kind === 'nav' ? { onStay: draft.stay, onLeave: draft.leave } : null}>
        <Button variant="secondary" busy={busy === 'draft'} disabled={busy !== null} onClick={() => save(false)}>임시저장</Button>
        <Button busy={busy === 'publish'} disabled={busy !== null} onClick={() => save(true)}>게시</Button>
      </EditorBar>
    </div>
  );
}

// ---------- 예배 순서 줄 편집 ----------

type Part = 'type' | 'up' | 'down' | 'add';

function OrderEditor({ rows, onChange }: { rows: Row[]; onChange(rows: Row[]): void }) {
  const listRef = useRef<HTMLOListElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const focus = useRef<{ k: string; part: Part } | null>(null);

  // 줄을 옮기거나 지우거나 더한 뒤 초점을 알맞은 곳에(누른 버튼이 사라지거나 다른 줄로 가도 길을 잃지 않게)
  useLayoutEffect(() => {
    const f = focus.current;
    if (!f) return;
    focus.current = null;
    if (f.part === 'add') { addRef.current?.focus(); return; }
    const row = listRef.current?.querySelector<HTMLElement>(`[data-row="${f.k}"]`);
    const target = row?.querySelector<HTMLElement>(`[data-part="${f.part}"]:not(:disabled)`)
      ?? row?.querySelector<HTMLElement>('[data-part="type"]');
    target?.focus();
  });

  const set = (i: number, patch: Partial<OrderItem>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  function move(i: number, d: -1 | 1) {
    const next = [...rows];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    focus.current = { k: rows[i].k, part: d < 0 ? 'up' : 'down' };
    onChange(next);
  }
  function remove(i: number) {
    const after = rows[i + 1] ?? rows[i - 1];
    focus.current = after ? { k: after.k, part: 'type' } : { k: '', part: 'add' };
    onChange(rows.filter((_, j) => j !== i));
  }
  function add() {
    const row: Row = { k: newKey(), type: '', title: '', detail: '' };
    focus.current = { k: row.k, part: 'type' };
    onChange([...rows, row]);
  }

  return (
    <>
      {rows.length > 0 && (
        <ol className={s.rows} ref={listRef} aria-label="예배 순서 줄">
          {rows.map((r, i) => {
            const n = i + 1;
            const id = `order-${r.k}`;
            return (
              <li key={r.k} className={s.row} data-row={r.k}>
                <span className={s.num} aria-hidden="true">{n}</span>
                <div className={s.typeCell}>
                  <label className={s.mini} htmlFor={`${id}-type`}><span className="sr-only">{n}번 </span>순서 이름</label>
                  <input id={`${id}-type`} data-part="type" className={s.input} autoComplete="off" value={r.type}
                    onChange={(e) => set(i, { type: e.target.value })} />
                </div>
                <div className={s.acts}>
                  <button type="button" className={s.icon} data-part="up" aria-label={`${n}번 순서 위로`}
                    disabled={i === 0} onClick={() => move(i, -1)}><Icon name="chevronUp" /></button>
                  <button type="button" className={s.icon} data-part="down" aria-label={`${n}번 순서 아래로`}
                    disabled={i === rows.length - 1} onClick={() => move(i, 1)}><Icon name="chevronDown" /></button>
                  <button type="button" className={s.icon} aria-label={`${n}번 순서 지우기`}
                    onClick={() => remove(i)}><Icon name="trash" size={20} /></button>
                </div>
                <div className={s.pair}>
                  <div className={s.cell}>
                    <label className={s.mini} htmlFor={`${id}-title`}><span className="sr-only">{n}번 </span>내용</label>
                    <input id={`${id}-title`} className={s.input} autoComplete="off" value={r.title}
                      onChange={(e) => set(i, { title: e.target.value })} />
                  </div>
                  <div className={s.cell}>
                    <label className={s.mini} htmlFor={`${id}-detail`}><span className="sr-only">{n}번 </span>맡은 사람</label>
                    <input id={`${id}-detail`} className={s.input} autoComplete="off" value={r.detail}
                      onChange={(e) => set(i, { detail: e.target.value })} />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <Button ref={addRef} variant="ghost" size="sm" className={s.add} icon={<Icon name="plus" size={18} />} onClick={add}>
        순서 추가
      </Button>
    </>
  );
}

// ---------- 찬양 목록 ----------

function HymnEditor({ hymns, onChange }: { hymns: Hymn[]; onChange(h: Hymn[]): void }) {
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
      <ul className={s.hymns} ref={listRef}>
        {hymns.map((h, i) => (
          <li key={h.k} className={s.hymn}>
            <label className={s.num} htmlFor={`hymn-${h.k}`}><span className="sr-only">찬양 </span>{i + 1}</label>
            <input id={`hymn-${h.k}`} data-hymn={h.k} className={s.input} autoComplete="off" value={h.text}
              placeholder={i === 0 ? '찬송가 288장' : undefined}
              onChange={(e) => onChange(hymns.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
            <button type="button" className={s.icon} aria-label={`${i + 1}번째 찬양 지우기`}
              disabled={hymns.length === 1 && !h.text} onClick={() => remove(i)}>
              <Icon name="trash" size={20} />
            </button>
          </li>
        ))}
      </ul>
      <Button variant="ghost" size="sm" className={s.add} icon={<Icon name="plus" size={18} />} onClick={add}>
        찬양 추가
      </Button>
    </>
  );
}
