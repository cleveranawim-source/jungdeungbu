import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { describeError, useToast } from '../app/Toast';
import { useLoader } from '../app/useLoader';
import { getSermon, saveSermon } from '../data/content';
import { shiftDateId } from '../lib/dates';
import { db } from '../lib/firebase';
import type { Sermon } from '../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Field, TextArea } from '../ui/Field';
import { Icon } from '../ui/icons';
import { LoadError } from '../ui/LoadError';
import { Loading } from '../ui/Loading';
import { EditorBar, EditorHead, StateBadge } from './EditorBar';
import { newKey } from './editorUtils';
import { useEditorDraft } from './useEditorDraft';
import ed from './editor.module.css';
import s from './SermonEditor.module.css';

interface Question { k: string; text: string }
interface Form { title: string; scripture: string; summary: string; body: string; questions: Question[] }
type Doc = Omit<Sermon, 'date'>;

const EMPTY: Doc = { title: '', scripture: '', summary: '', body: '', questions: [] };
const fromDoc = (d: Doc): Form => ({
  title: d.title, scripture: d.scripture, summary: d.summary, body: d.body,
  questions: (d.questions.length ? d.questions : ['']).map((text) => ({ k: newKey(), text })),
});
/** 저장할 모양(앞뒤 빈칸 정리, 빈 질문 빼기). 본문·요약은 줄바꿈을 살리고 끝 빈칸만 뺀다 */
const toDoc = (f: Form): Doc => ({
  title: f.title.trim(),
  scripture: f.scripture.trim(),
  summary: f.summary.trim(),
  body: f.body.trim(),
  questions: f.questions.map((q) => q.text.trim()).filter(Boolean),
});

/** 관리 → 설교 작성. 주일을 고르고 제목·본문·요약·원고·적용 질문을 써서 저장. 학생 "말씀" 탭에 보인다. */
export function SermonEditor({ thisSunday }: { thisSunday: string }) {
  const { show } = useToast();
  const [date, setDate] = useState(thisSunday);
  const draft = useEditorDraft<Form>('sermon', date, setDate, toDoc);
  const [busy, setBusy] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [savedDate, setSavedDate] = useState<string | null>(null); // 이 화면에서 저장한 날짜(새 설교 → 저장됨)
  const latest = shiftDateId(thisSunday, 28);
  const titleRef = useRef<HTMLInputElement>(null);

  const one = useLoader(useCallback(async () => ({ date, sermon: await getSermon(db, date) }), [date]));
  const loaded = one.data?.date === date ? one.data : undefined;
  const { open } = draft;
  useEffect(() => {
    if (loaded) open(fromDoc(loaded.sermon ?? EMPTY));
  }, [loaded, open]);

  const form = draft.value;
  if (!loaded || !form) {
    if (one.error && !one.loading) return <LoadError error={one.error} onRetry={one.reload} />;
    return <Loading />;
  }

  const exists = loaded.sermon !== null || savedDate === date;
  const update = (patch: Partial<Form>) => draft.set((f) => ({ ...f, ...patch }));

  async function save() {
    const doc = toDoc(form!);
    if (!doc.title) {
      setTitleError('설교 제목을 적어 주세요');
      titleRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      await saveSermon(db, { date, ...doc });
      draft.saved(fromDoc(doc));
      setSavedDate(date);
      show('설교를 저장했어요');
    } catch (e) {
      show(describeError(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  const pending = draft.pending;
  return (
    <div className={s.stack}>
      <EditorHead label="설교 날짜" date={date} thisSunday={thisSunday} latest={latest} disabled={busy}
        onRequestDate={(d) => { setTitleError(null); draft.requestDate(d); }}
        confirmDate={pending?.kind === 'date' ? { onStay: draft.stay, onLeave: draft.leave } : null}
        recovered={draft.recovered} onRevert={draft.revert}
        status={exists
          ? <><StateBadge tone="ok">저장됨</StateBadge><span>학생 말씀 탭에 보여요</span></>
          : <><StateBadge tone="new">새 설교</StateBadge><span>저장하면 학생 말씀 탭에 보여요</span></>} />

      <Card title="설교">
        <div className={s.fields}>
          <Field ref={titleRef} label="설교 제목" autoComplete="off" maxLength={60} value={form.title} error={titleError}
            onChange={(e) => { setTitleError(null); update({ title: e.target.value }); }} />
          <Field label="성경 본문" autoComplete="off" value={form.scripture} placeholder="마가복음 4:35-41"
            onChange={(e) => update({ scripture: e.target.value })} />
          <TextArea label="요약" rows={3} maxLength={300} showCount value={form.summary}
            hint="말씀 목록과 첫머리에 보이는 두세 문장이에요"
            onChange={(e) => update({ summary: e.target.value })} />
          <TextArea label="설교 원고" rows={14} className={s.body} value={form.body}
            hint="빈 줄로 문단을 나눠요"
            onChange={(e) => update({ body: e.target.value })} />
        </div>
      </Card>

      <Card title="적용 질문">
        <QuestionEditor questions={form.questions} onChange={(questions) => update({ questions })} />
      </Card>

      <EditorBar dirty={draft.dirty}
        leave={pending?.kind === 'nav' ? { onStay: draft.stay, onLeave: draft.leave } : null}>
        <Button busy={busy} onClick={save}>저장</Button>
      </EditorBar>
    </div>
  );
}

function QuestionEditor({ questions, onChange }: { questions: Question[]; onChange(q: Question[]): void }) {
  const listRef = useRef<HTMLOListElement>(null);
  const focus = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (focus.current === null) return;
    listRef.current?.querySelector<HTMLElement>(`[data-q="${focus.current}"]`)?.focus();
    focus.current = null;
  });

  function remove(i: number) {
    const rest = questions.filter((_, j) => j !== i);
    const next = rest.length ? rest : [{ k: newKey(), text: '' }];
    focus.current = (next[i] ?? next[i - 1]).k;
    onChange(next);
  }
  function add() {
    const q = { k: newKey(), text: '' };
    focus.current = q.k;
    onChange([...questions, q]);
  }

  return (
    <>
      <ol className={ed.lines} ref={listRef}>
        {questions.map((q, i) => (
          <li key={q.k} className={`${ed.line} ${s.question}`}>
            <label className={ed.num} htmlFor={`q-${q.k}`}><span className="sr-only">적용 질문 </span>{i + 1}</label>
            <textarea id={`q-${q.k}`} data-q={q.k} className={ed.input} rows={2} value={q.text}
              placeholder={i === 0 ? '요즘 내가 무서워하는 것은 무엇인가요?' : undefined}
              onChange={(e) => onChange(questions.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
            <button type="button" className={ed.icon} aria-label={`${i + 1}번째 질문 지우기`}
              disabled={questions.length === 1 && !q.text} onClick={() => remove(i)}>
              <Icon name="trash" size={20} />
            </button>
          </li>
        ))}
      </ol>
      <Button variant="ghost" size="sm" className={ed.add} icon={<Icon name="plus" size={18} />} onClick={add}>
        질문 추가
      </Button>
    </>
  );
}
