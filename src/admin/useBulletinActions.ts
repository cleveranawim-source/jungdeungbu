import { useState } from 'react';
import { describeError, useToast } from '../app/Toast';
import { loadBulletinForEdit, saveBulletinDraft, publishBulletin, unpublishBulletin, discardBulletinDraft } from '../data/bulletinDrafts';
import { saveTemplate } from '../data/content';
import { db } from '../lib/firebase';
import type { BulletinEditStatus, BulletinForEdit } from '../types';
import { fromSaved, readForm, toOrder, type BulletinForm } from './bulletinEditorForm';
import type { EditorDraft } from './useEditorDraft';
interface Meta {
  status: BulletinEditStatus;
  draftAt: number | null;
  publishedAt: number | null;
}
export function useBulletinActions({ date, myUid, edit, draft, focusProblem, onSaved, onDestructive }: {
 date:string; myUid:string; edit?:BulletinForEdit; draft:EditorDraft<BulletinForm>;
 focusProblem():void; onSaved(published:boolean):void; onDestructive():void;
}) {
 const {show} = useToast();
  const [busy, setBusy] = useState<
    'draft' | 'publish' | 'template' | 'unpublish' | 'discard' | null
  >(null);
  const [savedMeta, setSavedMeta] = useState<{ date: string; meta: Meta } | null>(null);
  const meta: Meta =
    savedMeta?.date === date
      ? savedMeta.meta
      : {
          status: edit?.status ?? 'new',
          draftAt: edit?.draftSavedAt?.toMillis() ?? null,
          publishedAt: edit?.publishedAt?.toMillis() ?? null,
        };
  const hasPublished = meta.status === 'published' || meta.status === 'published-with-draft';
  async function save(published: boolean) {
    const sent = readForm(draft.value!);
    if (sent.errors) {
      focusProblem();
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
      onSaved(published);
      show(published ? '게시했어요' : '초안을 저장했어요');
    } catch (e) {
      show(describeError(e), 'error');
    } finally {
      setBusy(null);
    }
  }
  async function saveAsTemplate() {
    setBusy('template');
    try {
      await saveTemplate(db, { order: toOrder(draft.value!.order) });
      show('기본 순서를 저장했어요');
    } catch (e) {
      show(describeError(e), 'error');
    } finally {
      setBusy(null);
    }
  }
  async function takeDown() {
    setBusy('unpublish');
    try {
      await unpublishBulletin(db, myUid, date);
      setSavedMeta({ date, meta: { ...meta, status: 'draft', publishedAt: null } });
      onDestructive();
      show('게시를 내렸어요');
    } finally {
      setBusy(null);
    }
  }
  async function discard() {
    setBusy('discard');
    try {
      await discardBulletinDraft(db, date);
      setSavedMeta({ date, meta: { ...meta, status: 'published', draftAt: null } });
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
      onSaved(false);
      onDestructive();
      show('초안을 버렸어요');
    } finally {
      setBusy(null);
    }
  }
 return {busy,meta,hasPublished,save,saveAsTemplate,takeDown,discard};
}
