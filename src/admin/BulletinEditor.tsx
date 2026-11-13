import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { describeError, useToast } from '../app/Toast';
import { useLoader } from '../app/useLoader';
import {
  getBulletin, getBulletinMembers, getSermon, getTemplate, listBulletins, saveBulletin, saveTemplate,
} from '../data/content';
import { nextIssue } from '../lib/bulletin';
import { formatAgo, formatMonthDay, shiftDateId } from '../lib/dates';
import { db } from '../lib/firebase';
import { EMPTY_BULLETIN_EXTRAS, type Bulletin, type BulletinMembers, type OrderItem } from '../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Field, TextArea } from '../ui/Field';
import { Icon } from '../ui/icons';
import { LoadError } from '../ui/LoadError';
import { Loading } from '../ui/Loading';
import {
  BulletinExtrasEditor, extrasFromSaved, isAttForm, readExtras, type ExtrasErrors, type ExtrasForm,
} from './BulletinExtrasEditor';
import { EditorBar, EditorHead, StateBadge } from './EditorBar';
import { fromPairs, PairRows, toPairs, type Pair } from './PairRows';
import { useEditorDraft } from './useEditorDraft';
import { hasStrings, isRows, newKey, useNow, useSavedBy } from './editorUtils';
import ed from './editor.module.css';
import s from './BulletinEditor.module.css';

// 화면용 폼: 줄마다 움직여도 입력칸이 따라가도록 key 를 붙인다(저장할 때 뺀다)
interface Row extends OrderItem { k: string; standing: boolean }
interface Hymn { k: string; text: string }
interface Form extends ExtrasForm {
  issue: string; leader: string; openingText: string; openingRef: string;
  order: Row[]; hymns: Hymn[]; scripture: string; sermonTitle: string;
  servers: Pair[];
}
type Doc = Pick<Bulletin, 'order' | 'hymns' | 'scripture' | 'sermonTitle' | 'issue' | 'leader' | 'opening' | 'nextServers' | 'attendance'>;

// ---------- 폼 ↔ 저장값 (출석·새 친구·생일은 BulletinExtrasEditor 의 extrasFromSaved / readExtras) ----------

const toRows = (order: OrderItem[]): Row[] =>
  order.map((o) => ({ type: o.type, title: o.title, detail: o.detail, standing: o.standing === true, k: newKey() }));
const toHymns = (hymns: string[]): Hymn[] => (hymns.length ? hymns : ['']).map((text) => ({ k: newKey(), text }));

function fromSaved(d: Doc, members: BulletinMembers | null): Form {
  return {
    issue: d.issue, leader: d.leader, openingText: d.opening.text, openingRef: d.opening.ref,
    order: toRows(d.order), hymns: toHymns(d.hymns), scripture: d.scripture, sermonTitle: d.sermonTitle,
    servers: toPairs(d.nextServers, (x) => x.role, (x) => x.name),
    ...extrasFromSaved(d.attendance, members),
  };
}

/** 순서 줄 저장 모양: 앞뒤 빈칸 정리, 빈 줄 빼기. standing 은 true 일 때만 둔다(false 를 넣으면 저장 안 한 변경 판정이 흔들린다). */
const toOrder = (rows: Row[]): OrderItem[] => rows
  .map((r) => ({ type: r.type.trim(), title: r.title.trim(), detail: r.detail.trim(), ...(r.standing ? { standing: true } : {}) }))
  .filter((r) => r.type || r.title || r.detail);

/** 폼 → 저장할 주보·명단과 고칠 칸. 저장 안 한 내용 판단도 이 결과(compare)로 비교한다. */
function readForm(f: Form): { doc: Doc; members: BulletinMembers; errors: ExtrasErrors | null; compare: unknown } {
  const extras = readExtras(f);
  const doc: Doc = {
    issue: f.issue.trim(),
    leader: f.leader.trim(),
    opening: { text: f.openingText.trim(), ref: f.openingRef.trim() },
    order: toOrder(f.order),
    hymns: f.hymns.map((h) => h.text.trim()).filter(Boolean),
    scripture: f.scripture.trim(),
    sermonTitle: f.sermonTitle.trim(),
    nextServers: fromPairs(f.servers).map((p) => ({ role: p.a, name: p.b })),
    attendance: extras.attendance,
  };
  const { attendance: _counted, ...plain } = doc;
  return { doc, members: extras.members, errors: extras.errors, compare: { ...plain, extras: extras.compare } };
}
const comparable = (f: Form): unknown => readForm(f).compare;

/** sessionStorage 복구본이 이 폼 모양인지(옛 모양·깨진 값은 버린다) */
const isForm = (x: unknown): x is Form =>
  hasStrings(x, ['scripture', 'sermonTitle', 'issue', 'leader', 'openingText', 'openingRef', 'newFriends', 'birthdays'])
  && isRows((x as Form).order, ['type', 'title', 'detail'])
  && (x as Form).order.every((r) => typeof r.standing === 'boolean')
  && isRows((x as Form).hymns, ['text'])
  && isRows((x as Form).servers, ['a', 'b'])
  && ((x as Form).att === null || isAttForm((x as Form).att));

interface Meta { published: boolean; by: string; at: number }

/**
 * 관리 → 주보 작성. 주일을 고르면 그 날 주보를 열고(없으면 템플릿 순서·다음 호수로 시작),
 * 예배 순서·찬양·말씀·예배위원·출석·새 친구·생일을 채워 "임시저장"(학생에게 안 보임) 또는 "게시".
 */
export function BulletinEditor({ myUid, thisSunday }: { myUid: string; thisSunday: string }) {
  const { show } = useToast();
  const [date, setDate] = useState(thisSunday);
  const draft = useEditorDraft<Form>('bulletin', date, setDate, comparable, isForm);
  const [busy, setBusy] = useState<'draft' | 'publish' | 'template' | null>(null);
  const [savedMeta, setSavedMeta] = useState<{ date: string; meta: Meta } | null>(null);
  const [copied, setCopied] = useState<{ date: string; from: string; before: Pick<Form, 'order' | 'hymns'> } | null>(null);
  // 저장이 막힌 날짜(그 뒤로는 고칠 때마다 안내가 따라 바뀐다)와, 첫 틀린 칸으로 초점을 옮길 신호
  const [checked, setChecked] = useState<string | null>(null);
  const [focusBad, setFocusBad] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const latest = shiftDateId(thisSunday, 28); // 4주 뒤 주일까지 미리 준비

  const one = useLoader(useCallback(async () => {
    const [bulletin, members, sermon] = await Promise.all([getBulletin(db, date), getBulletinMembers(db, date), getSermon(db, date)]);
    if (bulletin) return { date, bulletin, members, sermon, start: null };
    // 새 주보: 템플릿 순서 + 바로 앞 게시 주보의 다음 호수(목록을 못 읽으면 호수만 빈칸으로 시작)
    const [template, recent] = await Promise.all([getTemplate(db), listBulletins(db).catch(() => [])]);
    const prev = recent.find((b) => b.date < date);
    return { date, bulletin, members, sermon, start: { order: template.order, issue: prev ? nextIssue(prev.issue) : '' } };
  }, [date]));
  // 지난 주보 복사용(게시본, 최신순). 실패해도 편집은 된다
  const past = useLoader(useCallback(() => listBulletins(db), []));
  const savedBy = useSavedBy();
  const now = useNow();

  const loaded = one.data?.date === date ? one.data : undefined;
  const { open } = draft;
  useEffect(() => {
    if (!loaded) return;
    open(loaded.bulletin
      ? fromSaved(loaded.bulletin, loaded.members)
      : fromSaved({ ...EMPTY_BULLETIN_EXTRAS, order: loaded.start!.order, hymns: [], scripture: '', sermonTitle: '', issue: loaded.start!.issue }, null));
  }, [loaded, open]);

  useEffect(() => {
    if (focusBad) rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusBad]);

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
  const errors = checked === date ? readForm(form).errors : null;

  async function save(published: boolean) {
    const read = readForm(form!);
    if (read.errors) {
      setChecked(date);
      setFocusBad((n) => n + 1);
      show('고칠 곳이 있어요', 'error');
      return;
    }
    setBusy(published ? 'publish' : 'draft');
    try {
      await saveBulletin(db, myUid, { date, ...read.doc, published }, read.members);
      draft.saved(fromSaved(read.doc, read.members));
      setSavedMeta({ date, meta: { published, by: myUid, at: Date.now() } });
      setCopied(null);
      setChecked(null);
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
      await saveTemplate(db, { order: toOrder(form!.order) });
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
    <div className={s.stack} ref={rootRef}>
      <EditorHead label="주보 날짜" date={date} thisSunday={thisSunday} latest={latest} disabled={busy !== null}
        onRequestDate={draft.requestDate}
        confirmDate={pending?.kind === 'date' ? { onStay: draft.stay, onLeave: draft.leave } : null}
        recovered={draft.recovered} onRevert={draft.revert} status={status} />

      <Card title="예배 순서">
        <div className={s.head}>
          <div className={s.duo}>
            <Field label="호수" autoComplete="off" value={form.issue} placeholder="예: 2026-42호"
              onChange={(e) => update({ issue: e.target.value })} />
            <Field label="인도자" autoComplete="off" value={form.leader}
              onChange={(e) => update({ leader: e.target.value })} />
          </div>
          <TextArea label="여는 말씀" rows={2} className={s.opening} value={form.openingText}
            onChange={(e) => update({ openingText: e.target.value })} />
          <Field label="말씀 출처" autoComplete="off" value={form.openingRef} placeholder="예: 요 4:24"
            onChange={(e) => update({ openingRef: e.target.value })} />
        </div>
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
          <Field label="성경 본문" autoComplete="off" value={form.scripture} placeholder="예: 마가복음 4:35-41"
            onChange={(e) => update({ scripture: e.target.value })} />
          <Field label="설교 제목" autoComplete="off" value={form.sermonTitle}
            onChange={(e) => update({ sermonTitle: e.target.value })}
            hint={<>
              {!sermon && <>설교 작성에서 이 주일 설교를 쓰면 제목을 가져올 수 있어요<br /></>}
              순서표의 성경봉독·설교 줄을 비워 두면 여기 적은 본문과 제목이 그 줄에 보여요
            </>} />
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

      <Card title="다음 주 예배위원">
        <PairRows legend="다음 주 예배위원" labelA="맡은 일" labelB="이름" addLabel="예배위원 추가"
          rows={form.servers} onChange={(servers) => update({ servers })} />
      </Card>

      <Card title="지난 주 출석·새 친구·생일">
        <BulletinExtrasEditor date={date} value={form} errors={errors}
          onChange={(fn) => draft.set((f) => ({ ...f, ...fn(f) }))} />
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

  const set = (i: number, patch: Partial<Row>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
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
    const row: Row = { k: newKey(), type: '', title: '', detail: '', standing: false };
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
                <span className={`${ed.num} ${s.numCell}`} aria-hidden="true">{n}</span>
                <div className={s.typeCell}>
                  <label className={ed.mini} htmlFor={`${id}-type`}><span className="sr-only">{n}번 </span>순서 이름</label>
                  <input id={`${id}-type`} data-part="type" className={ed.input} autoComplete="off" value={r.type}
                    onChange={(e) => set(i, { type: e.target.value })} />
                </div>
                <div className={s.pair}>
                  <div className={s.cell}>
                    <label className={ed.mini} htmlFor={`${id}-title`}><span className="sr-only">{n}번 </span>내용</label>
                    <input id={`${id}-title`} className={ed.input} autoComplete="off" value={r.title}
                      onChange={(e) => set(i, { title: e.target.value })} />
                  </div>
                  <div className={s.cell}>
                    <label className={ed.mini} htmlFor={`${id}-detail`}><span className="sr-only">{n}번 </span>맡은 사람</label>
                    <input id={`${id}-detail`} className={ed.input} autoComplete="off" value={r.detail}
                      onChange={(e) => set(i, { detail: e.target.value })} />
                  </div>
                </div>
                <label className={s.stand}>
                  <input type="checkbox" checked={r.standing} onChange={(e) => set(i, { standing: e.target.checked })} />
                  <span><span className="sr-only">{n}번 </span>일어서서</span>
                </label>
                <div className={s.acts}>
                  <button type="button" className={ed.icon} data-part="up" aria-label={`${n}번 순서 위로`}
                    disabled={i === 0} onClick={() => move(i, -1)}><Icon name="chevronUp" /></button>
                  <button type="button" className={ed.icon} data-part="down" aria-label={`${n}번 순서 아래로`}
                    disabled={i === rows.length - 1} onClick={() => move(i, 1)}><Icon name="chevronDown" /></button>
                  <button type="button" className={ed.icon} aria-label={`${n}번 순서 지우기`}
                    onClick={() => remove(i)}><Icon name="trash" size={20} /></button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <Button ref={addRef} variant="ghost" size="sm" className={ed.add} icon={<Icon name="plus" size={18} />} onClick={add}>
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
      <ul className={ed.lines} ref={listRef}>
        {hymns.map((h, i) => (
          <li key={h.k} className={ed.line}>
            <label className={ed.num} htmlFor={`hymn-${h.k}`}><span className="sr-only">찬양 </span>{i + 1}</label>
            <input id={`hymn-${h.k}`} data-hymn={h.k} className={ed.input} autoComplete="off" value={h.text}
              placeholder={i === 0 ? '예: 찬송가 288장' : undefined}
              onChange={(e) => onChange(hymns.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
            <button type="button" className={ed.icon} aria-label={`${i + 1}번째 찬양 지우기`}
              disabled={hymns.length === 1 && !h.text} onClick={() => remove(i)}>
              <Icon name="trash" size={20} />
            </button>
          </li>
        ))}
      </ul>
      <Button variant="ghost" size="sm" className={ed.add} icon={<Icon name="plus" size={18} />} onClick={add}>
        찬양 추가
      </Button>
    </>
  );
}
