import { useCallback, useEffect, useRef, useState } from 'react';
import { BULLETIN_BRAND } from '../app/brand';
import { teacherHref } from '../app/router';
import { describeError, useToast } from '../app/Toast';
import { useLoader } from '../app/useLoader';
import {
  activeAnnouncements,
  getSermon,
  getTemplate,
  listBulletins,
  saveTemplate,
} from '../data/content';
import {
  loadBulletinForEdit,
  saveBulletinDraft,
  publishBulletin,
  unpublishBulletin,
  discardBulletinDraft,
} from '../data/bulletinDrafts';
import { getChurchInfo, getMemberInfo } from '../data/info';
import { nextIssue } from '../lib/bulletin';
import { formatAgo, formatMonthDay, shiftDateId } from '../lib/dates';
import { db } from '../lib/firebase';
import { EMPTY_BULLETIN_EXTRAS, type Bulletin, type BulletinEditStatus } from '../types';
import { AnnouncementList } from '../ui/AnnouncementList';
import { BulletinView } from '../ui/BulletinView';
import { Button, LinkButton } from '../ui/Button';
import { ConfirmAction } from '../ui/ConfirmAction';
import { Disclosure } from '../ui/Disclosure';
import { Field, TextArea } from '../ui/Field';
import { InfoCard } from '../ui/InfoCard';
import { LoadError } from '../ui/LoadError';
import { Loading } from '../ui/Loading';
import { BulletinExtrasEditor } from './BulletinExtrasEditor';
import {
  comparable,
  fromSaved,
  isForm,
  readForm,
  toHymns,
  toOrder,
  toRows,
  type BulletinForm,
} from './bulletinEditorForm';
import { EditorBar, EditorHead, StateBadge } from './EditorBar';
import { EditorLayout, EditorSection } from './EditorLayout';
import { HymnEditor } from './HymnEditor';
import { OrderEditor } from './OrderEditor';
import { PairRows } from './PairRows';
import { useEditorDraft } from './useEditorDraft';
import { useNow } from './editorUtils';
import s from './BulletinEditor.module.css';

const STATUS: Record<BulletinEditStatus, string> = {
  new: '새 주보',
  draft: '초안',
  published: '게시 중',
  'published-with-draft': '게시 중 · 고친 초안 있음',
};
interface Meta {
  status: BulletinEditStatus;
  draftAt: number | null;
  publishedAt: number | null;
}
export function BulletinEditor({
  myUid,
  thisSunday,
  initialDate = thisSunday,
  onDateChange,
}: {
  myUid: string;
  thisSunday: string;
  initialDate?: string;
  onDateChange?(date: string): void;
}) {
  const { show } = useToast();
  const [date, setDate] = useState(initialDate);
  const draft = useEditorDraft<BulletinForm>('bulletin', date, setDate, comparable, isForm);
  const [busy, setBusy] = useState<
    'draft' | 'publish' | 'template' | 'unpublish' | 'discard' | null
  >(null);
  const [savedMeta, setSavedMeta] = useState<{ date: string; meta: Meta } | null>(null);
  const [copied, setCopied] = useState<{
    date: string;
    from: string;
    before: Pick<BulletinForm, 'order' | 'hymns'>;
  } | null>(null);
  const [checked, setChecked] = useState<string | null>(null);
  const [focusBad, setFocusBad] = useState(0);
  const [publicPreview, setPublicPreview] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const refocusTitle = useRef(false);
  useEffect(() => {
    if (!busy && refocusTitle.current) {
      refocusTitle.current = false;
      titleRef.current?.focus();
    }
  }, [busy]);
  const now = useNow();
  useEffect(() => {
    onDateChange?.(date);
  }, [date, onDateChange]);
  const one = useLoader(
    useCallback(async () => {
      const [edit, sermon] = await Promise.all([
        loadBulletinForEdit(db, date),
        getSermon(db, date),
      ]);
      if (edit.content) return { date, edit, sermon, start: null };
      const [template, recent] = await Promise.all([
        getTemplate(db),
        listBulletins(db).catch(() => []),
      ]);
      const prev = recent.find((b) => b.date < date);
      return {
        date,
        edit,
        sermon,
        start: { order: template.order, issue: prev ? nextIssue(prev.issue) : '' },
      };
    }, [date]),
  );
  const past = useLoader(useCallback(() => listBulletins(db), []));
  const news = useLoader(useCallback(() => activeAnnouncements(db, date), [date]));
  const info = useLoader(
    useCallback(
      async () => ({ church: await getChurchInfo(db), members: await getMemberInfo(db) }),
      [],
    ),
  );
  const loaded = one.data?.date === date ? one.data : undefined;
  const { open } = draft;
  useEffect(() => {
    if (!loaded) return;
    open(
      loaded.edit.content
        ? fromSaved(loaded.edit.content, loaded.edit.members)
        : fromSaved(
            {
              ...EMPTY_BULLETIN_EXTRAS,
              order: loaded.start!.order,
              hymns: [],
              scripture: '',
              sermonTitle: '',
              issue: loaded.start!.issue,
            },
            null,
          ),
    );
  }, [loaded, open]);
  useEffect(() => {
    if (focusBad) rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusBad]);
  const form = draft.value;
  if (!loaded || !form)
    return one.error && !one.loading ? (
      <LoadError error={one.error} onRetry={one.reload} />
    ) : (
      <Loading />
    );
  const meta: Meta =
    savedMeta?.date === date
      ? savedMeta.meta
      : {
          status: loaded.edit.status,
          draftAt: loaded.edit.draftSavedAt?.toMillis() ?? null,
          publishedAt: loaded.edit.publishedAt?.toMillis() ?? null,
        };
  const hasPublished = meta.status === 'published' || meta.status === 'published-with-draft';
  const read = readForm(form);
  const errors = checked === date ? read.errors : null;
  const source = past.data?.find((b) => b.date < date);
  const update = (patch: Partial<BulletinForm>) => draft.set((f) => ({ ...f, ...patch }));
  function focusProblem() {
    setChecked(date);
    setFocusBad((n) => n + 1);
  }
  async function save(published: boolean) {
    const sent = readForm(form!);
    if (sent.errors) {
      focusProblem();
      show('고칠 곳이 있어요', 'error');
      return;
    }
    setBusy(published ? 'publish' : 'draft');
    try {
      const content = { date, ...sent.doc };
      if (published) await publishBulletin(db, myUid, content, sent.members);
      else await saveBulletinDraft(db, myUid, content, sent.members);
      draft.saved(fromSaved(sent.doc, sent.members));
      setSavedMeta({
        date,
        meta: {
          status: published ? 'published' : hasPublished ? 'published-with-draft' : 'draft',
          draftAt: published ? null : Date.now(),
          publishedAt: published ? Date.now() : meta.publishedAt,
        },
      });
      setCopied(null);
      setChecked(null);
      show(published ? '게시했어요' : '초안을 저장했어요');
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
      show('기본 순서를 저장했어요');
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
  async function takeDown() {
    setBusy('unpublish');
    try {
      await unpublishBulletin(db, myUid, date);
      setSavedMeta({ date, meta: { ...meta, status: 'draft', publishedAt: null } });
      refocusTitle.current = true;
      show('게시를 내렸어요');
    } finally {
      setBusy(null);
    }
  }
  async function discard() {
    setBusy('discard');
    try {
      await discardBulletinDraft(db, date);
      const edit = await loadBulletinForEdit(db, date);
      if (edit.content) draft.replace(fromSaved(edit.content, edit.members));
      setSavedMeta({
        date,
        meta: {
          status: edit.status,
          draftAt: edit.draftSavedAt?.toMillis() ?? null,
          publishedAt: edit.publishedAt?.toMillis() ?? null,
        },
      });
      setChecked(null);
      refocusTitle.current = true;
      show('초안을 버렸어요');
    } finally {
      setBusy(null);
    }
  }
  const pending = draft.pending;
  const status = (
    <>
      {form.issue && <span>{form.issue}</span>}
      <StateBadge
        tone={meta.status === 'published' ? 'ok' : meta.status === 'new' ? 'new' : 'draft'}
      >
        {STATUS[meta.status]}
      </StateBadge>
      <span>
        {meta.draftAt
          ? `${formatAgo(meta.draftAt, now)} 초안 저장`
          : meta.publishedAt
            ? `${formatAgo(meta.publishedAt, now)} 게시`
            : meta.status === 'new'
              ? '기본 순서로 시작했어요'
              : '아직 게시하지 않았어요'}
      </span>
    </>
  );
  return (
    <div className={s.stack} ref={rootRef}>
      <EditorHead
        label="주보 날짜"
        date={date}
        thisSunday={thisSunday}
        latest={shiftDateId(thisSunday, 28)}
        disabled={busy !== null}
        onRequestDate={draft.requestDate}
        confirmDate={pending?.kind === 'date' ? { onStay: draft.stay, onLeave: draft.leave } : null}
        recovered={draft.recovered}
        onRevert={draft.revert}
        status={status}
      />
      <div inert={busy === 'discard' || busy === 'unpublish'}>
        <EditorLayout
          sections={[
            { id: 'editor-word', title: '이번 주 말씀' },
            { id: 'editor-order', title: '예배 순서', summary: `${form.order.length}개 순서` },
            { id: 'editor-hymns', title: '찬양' },
            { id: 'editor-news', title: '광고' },
            { id: 'editor-servers', title: '다음 주 예배위원' },
            { id: 'editor-extras', title: '출석·새 친구·생일' },
            { id: 'editor-preview', title: '게시 전 확인' },
          ]}
        >
          <EditorSection
            id="editor-word"
            title="이번 주 말씀"
            description="말씀을 먼저 적고 예배를 준비해요."
            tone="gold"
          >
            <div className={s.fields}>
              <Field
                ref={titleRef}
                label="설교 제목"
                value={form.sermonTitle}
                onChange={(e) => update({ sermonTitle: e.target.value })}
              />
              <Field
                label="성경 본문"
                value={form.scripture}
                onChange={(e) => update({ scripture: e.target.value })}
              />
              {loaded.sermon?.title && loaded.sermon.title !== form.sermonTitle && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    update({
                      sermonTitle: loaded.sermon!.title,
                      scripture: form.scripture || loaded.sermon!.scripture,
                    })
                  }
                >
                  설교 제목 가져오기
                </Button>
              )}
              <p className={s.hint}>
                순서표의 성경봉독·설교 내용을 비우면 여기 적은 말씀이 보여요.
              </p>
              <div className={s.duo}>
                <Field
                  label="호수"
                  value={form.issue}
                  onChange={(e) => update({ issue: e.target.value })}
                />
                <Field
                  label="인도자"
                  value={form.leader}
                  onChange={(e) => update({ leader: e.target.value })}
                />
              </div>
              <TextArea
                label="여는 말씀"
                rows={2}
                value={form.openingText}
                onChange={(e) => update({ openingText: e.target.value })}
              />
              <Field
                label="말씀 출처"
                value={form.openingRef}
                onChange={(e) => update({ openingRef: e.target.value })}
              />
            </div>
          </EditorSection>
          <EditorSection
            id="editor-order"
            title="예배 순서"
            description="순서를 눌러 고쳐요. 넓은 화면에서는 표에서 바로 입력해요."
          >
            <div className={s.tools}>
              <Button
                variant="secondary"
                size="sm"
                disabled={!source || busy !== null}
                onClick={() => source && copyFrom(source)}
              >
                지난 주에서 가져오기
              </Button>
              <Button
                variant="ghost"
                size="sm"
                busy={busy === 'template'}
                disabled={busy !== null}
                onClick={saveAsTemplate}
              >
                기본 순서 저장
              </Button>
            </div>
            {copied?.date === date && (
              <p role="status" className={s.note}>
                {formatMonthDay(copied.from)} 주보의 순서와 찬양을 가져왔어요.
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    update(copied.before);
                    setCopied(null);
                  }}
                >
                  되돌리기
                </Button>
              </p>
            )}
            <OrderEditor
              rows={form.order}
              scripture={form.scripture}
              sermonTitle={form.sermonTitle}
              onChange={(order) => update({ order })}
            />
          </EditorSection>
          <EditorSection id="editor-hymns" title="찬양">
            <Disclosure
              title="찬양 목록 고치기"
              sub={`${form.hymns.filter((h) => h.text.trim()).length}곡을 적었어요`}
            >
              <HymnEditor hymns={form.hymns} onChange={(hymns) => update({ hymns })} />
            </Disclosure>
          </EditorSection>
          <EditorSection
            id="editor-news"
            title="광고"
            description="이 주일에 학생에게 보일 소식이에요."
          >
            {news.data === undefined ? (
              news.error ? (
                <LoadError error={news.error} onRetry={news.reload} />
              ) : (
                <Loading />
              )
            ) : news.data.length ? (
              <AnnouncementList items={news.data} dates />
            ) : (
              <p className={s.hint}>이 주일에 보일 광고가 없어요.</p>
            )}
            <LinkButton
              variant="secondary"
              size="sm"
              href={teacherHref('admin', 'announcements')}
              onClick={(e) => {
                if (busy) {
                  e.preventDefault();
                  return;
                }
                draft.keepLocal();
              }}
            >
              광고 관리
            </LinkButton>
            <p className={s.hint}>다녀와도 지금 쓰는 내용과 주일은 이 기기에 남아 있어요.</p>
          </EditorSection>
          <EditorSection
            id="editor-servers"
            title="다음 주 예배위원"
            description={`${formatMonthDay(shiftDateId(date, 7))} 주일을 준비해요.`}
          >
            <Disclosure
              title="예배위원 고치기"
              sub={
                read.doc.nextServers.map((x) => `${x.role} ${x.name}`).join(', ') ||
                '아직 적은 예배위원이 없어요'
              }
            >
              <PairRows
                legend="다음 주 예배위원"
                labelA="맡은 일"
                labelB="이름"
                addLabel="예배위원 추가"
                rows={form.servers}
                onChange={(servers) => update({ servers })}
              />
            </Disclosure>
          </EditorSection>
          <EditorSection
            id="editor-extras"
            title="출석·새 친구·생일"
            tone="sage"
            description="불러온 내용을 확인하고 필요한 곳만 고쳐요."
          >
            <BulletinExtrasEditor
              date={date}
              value={form}
              errors={errors}
              onChange={(fn) => draft.set((f) => ({ ...f, ...fn(f) }))}
            />
          </EditorSection>
          <section id="editor-preview" tabIndex={-1} className={s.previewSection}>
            <Disclosure title="게시 전 미리보기" level={2}>
              {read.errors ? (
                <p>미리보기 전에 출석 인원과 생일을 확인해 주세요.</p>
              ) : (
                <>
                  <fieldset className={s.previewChoice}>
                    <legend>미리보기 범위</legend>
                    <label>
                      <input
                        type="radio"
                        name="preview"
                        checked={!publicPreview}
                        onChange={() => setPublicPreview(false)}
                      />
                      개인 링크 화면
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="preview"
                        checked={publicPreview}
                        onChange={() => setPublicPreview(true)}
                      />
                      공개 안내만
                    </label>
                  </fieldset>
                  <div className={s.previewRead}>
                    <BulletinView
                      bulletin={{ date, ...read.doc }}
                      sermon={loaded.sermon}
                      members={publicPreview ? null : read.members}
                      announcements={news.data ?? []}
                      coverLabel={BULLETIN_BRAND.label}
                      coverDescription={BULLETIN_BRAND.description}
                    />
                    {info.data && (
                      <InfoCard
                        info={info.data.church}
                        members={publicPreview ? null : info.data.members}
                      />
                    )}
                  </div>
                </>
              )}
            </Disclosure>
            {(hasPublished || meta.status === 'published-with-draft') && (
              <Disclosure title="게시 관리" level={2}>
                <div
                  className={s.fields}
                  onFocus={(event) => {
                    // 저장 줄에 가리지 않게 확인 설명과 버튼을 함께 보여 줘요.
                    (event.target as HTMLElement)
                      .closest('[role="group"]')
                      ?.scrollIntoView({ block: 'center' });
                  }}
                >
                  {hasPublished && (
                    <ConfirmAction
                      label="게시 내리기"
                      message="학생 화면에서 이 주보가 내려가요. 내용은 남아 있어 다시 게시할 수 있어요."
                      confirmLabel="게시를 내려요"
                      disabled={busy !== null}
                      onConfirm={takeDown}
                    />
                  )}
                  {meta.status === 'published-with-draft' && (
                    <ConfirmAction
                      label="초안 버리기"
                      message="서버 초안과 지금 고친 내용을 버리고, 학생이 보고 있는 게시본으로 돌아가요."
                      confirmLabel="초안을 버리고 돌아가기"
                      disabled={busy !== null}
                      onConfirm={discard}
                    />
                  )}
                </div>
              </Disclosure>
            )}
          </section>
        </EditorLayout>
      </div>
      <EditorBar
        dirty={draft.dirty}
        note={
          hasPublished
            ? '초안 저장은 학생이 보는 주보를 바꾸지 않아요.'
            : '게시해야 학생에게 보여요.'
        }
        validation={
          errors ? (
            <button className={s.errorJump} type="button" onClick={focusProblem}>
              {errors.classes.length || errors.teachers ? '출석 인원' : '생일 날짜'}을 확인해 주세요
              — 고칠 곳으로
            </button>
          ) : undefined
        }
        leave={pending?.kind === 'nav' ? { onStay: draft.stay, onLeave: draft.leave } : null}
      >
        <Button
          variant="secondary"
          busy={busy === 'draft'}
          disabled={busy !== null}
          onClick={() => save(false)}
        >
          초안 저장
        </Button>
        <Button busy={busy === 'publish'} disabled={busy !== null} onClick={() => save(true)}>
          게시
        </Button>
      </EditorBar>
    </div>
  );
}
