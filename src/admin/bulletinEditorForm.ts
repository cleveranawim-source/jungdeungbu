// 편집 폼 ↔ 깨끗한 주보 내용. Firebase·React 없이 시험해요.
import type { BulletinContent, BulletinMembers, OrderItem } from '../types';
import { extrasFromSaved, isAttForm, readExtras, type ExtrasForm } from './bulletinExtrasForm';
import { hasStrings, isRows, newKey } from './formShape';
import type { Pair } from './PairRows';
export interface OrderRow extends OrderItem {
  k: string;
  standing: boolean;
}
export interface Hymn {
  k: string;
  text: string;
}
export interface BulletinForm extends ExtrasForm {
  issue: string;
  leader: string;
  openingText: string;
  openingRef: string;
  order: OrderRow[];
  hymns: Hymn[];
  scripture: string;
  sermonTitle: string;
  servers: Pair[];
}
export type BulletinFields = Omit<BulletinContent, 'date'>;
export const toRows = (order: OrderItem[]): OrderRow[] =>
  order.map((o) => ({ ...o, standing: o.standing === true, k: newKey() }));
export const toHymns = (hymns: string[]): Hymn[] =>
  (hymns.length ? hymns : ['']).map((text) => ({ k: newKey(), text }));
export function fromSaved(d: BulletinFields, members: BulletinMembers | null): BulletinForm {
  return {
    issue: d.issue,
    leader: d.leader,
    openingText: d.opening.text,
    openingRef: d.opening.ref,
    order: toRows(d.order),
    hymns: toHymns(d.hymns),
    scripture: d.scripture,
    sermonTitle: d.sermonTitle,
    servers: d.nextServers.map((x) => ({ k: newKey(), a: x.role, b: x.name })),
    ...extrasFromSaved(d.attendance, members),
  };
}
export const toOrder = (rows: OrderRow[]): OrderItem[] =>
  rows
    .map((r) => ({
      type: r.type.trim(),
      title: r.title.trim(),
      detail: r.detail.trim(),
      ...(r.standing ? { standing: true } : {}),
    }))
    .filter((r) => r.type || r.title || r.detail);
export function readForm(f: BulletinForm) {
  // 반 ID가 공개 문서로 나가지 않도록 반드시 기존 readExtras를 거쳐요.
  const extras = readExtras(f);
  const doc: BulletinFields = {
    issue: f.issue.trim(),
    leader: f.leader.trim(),
    opening: { text: f.openingText.trim(), ref: f.openingRef.trim() },
    order: toOrder(f.order),
    hymns: f.hymns.map((h) => h.text.trim()).filter(Boolean),
    scripture: f.scripture.trim(),
    sermonTitle: f.sermonTitle.trim(),
    nextServers: f.servers
      .map((p) => ({ role: p.a.trim(), name: p.b.trim() }))
      .filter((p) => p.role || p.name),
    attendance: extras.attendance,
  };
  const { attendance: _attendance, ...plain } = doc;
  return {
    doc,
    members: extras.members,
    errors: extras.errors,
    compare: { ...plain, extras: extras.compare },
  };
}
export const comparable = (f: BulletinForm): unknown => readForm(f).compare;
export const isForm = (x: unknown): x is BulletinForm =>
  hasStrings(x, [
    'scripture',
    'sermonTitle',
    'issue',
    'leader',
    'openingText',
    'openingRef',
    'newFriends',
    'birthdays',
  ]) &&
  isRows((x as BulletinForm).order, ['type', 'title', 'detail']) &&
  (x as BulletinForm).order.every((r) => typeof r.standing === 'boolean') &&
  isRows((x as BulletinForm).hymns, ['text']) &&
  isRows((x as BulletinForm).servers, ['a', 'b']) &&
  ((x as BulletinForm).att === null || isAttForm((x as BulletinForm).att));
