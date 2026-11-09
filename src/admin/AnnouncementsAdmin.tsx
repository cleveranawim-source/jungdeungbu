import { useCallback, useRef, useState, type FormEvent } from 'react';
import { describeError, useToast } from '../app/Toast';
import { useLoader } from '../app/useLoader';
import { deleteAnnouncement, listAnnouncements, saveAnnouncement } from '../data/content';
import { formatMonthDay } from '../lib/dates';
import { db } from '../lib/firebase';
import type { Announcement, WithId } from '../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ChoiceChips } from '../ui/ChoiceChips';
import { ConfirmAction } from '../ui/ConfirmAction';
import { Field, TextArea } from '../ui/Field';
import { Icon } from '../ui/icons';
import { List, ListRow } from '../ui/List';
import { LoadError } from '../ui/LoadError';
import { Loading } from '../ui/Loading';
import { SundayStepper } from '../ui/SundayStepper';
import s from './AnnouncementsAdmin.module.css';

type Ad = WithId<Announcement>;
type AdInput = Omit<Announcement, 'createdAt'>;
type Status = 'now' | 'soon' | 'past';

const STATUS_LABEL: Record<Status, string> = { now: '진행 중', soon: '예정', past: '끝남' };

/** 이번 주일 기준: 시작 전이면 예정, 끝났으면 끝남, 아니면 진행 중(학생 화면에 보이는 중) */
function statusOf(a: AdInput, thisSunday: string): Status {
  if (a.startDate > thisSunday) return 'soon';
  if (a.endDate < thisSunday) return 'past';
  return 'now';
}

/** 진행 중(고정 먼저, 최근 시작 먼저) → 예정(가까운 것 먼저) → 끝남(최근에 끝난 것 먼저) */
function sortAds(ads: Ad[], thisSunday: string): Ad[] {
  const rank: Record<Status, number> = { now: 0, soon: 1, past: 2 };
  return [...ads].sort((a, b) => {
    const sa = statusOf(a, thisSunday);
    const sb = statusOf(b, thisSunday);
    if (sa !== sb) return rank[sa] - rank[sb];
    if (sa === 'now') return Number(b.pinned) - Number(a.pinned) || b.startDate.localeCompare(a.startDate);
    if (sa === 'soon') return a.startDate.localeCompare(b.startDate);
    return b.endDate.localeCompare(a.endDate);
  });
}

function period(a: AdInput): string {
  return a.startDate === a.endDate
    ? `${formatMonthDay(a.startDate)} 주일 하루`
    : `${formatMonthDay(a.startDate)} ~ ${formatMonthDay(a.endDate)}`;
}

/** 관리 → 광고: 목록(기간·고정·진행 상태) → 줄을 열어 고치기·삭제, 아래에서 새 광고 추가. */
export function AnnouncementsAdmin({ thisSunday }: { thisSunday: string }) {
  const { show } = useToast();
  const { data, error, loading, reload } = useLoader(useCallback(() => listAnnouncements(db), []));
  const [open, setOpen] = useState<string | null>(null);

  if (!data) {
    if (error) return <LoadError error={error} onRetry={reload} />;
    return <Loading />;
  }
  const ads = sortAds(data, thisSunday);
  const live = ads.filter((a) => statusOf(a, thisSunday) === 'now').length;

  return (
    <div className={s.stack} aria-busy={loading || undefined}>
      <Card title="광고">
        {ads.length === 0 ? (
          <p className={s.muted}>아직 광고가 없어요. 아래에서 첫 광고를 추가해 주세요.</p>
        ) : (
          <>
            <p className={s.muted}>
              {live > 0 ? `이번 주일 학생 화면에 ${live}개가 보여요.` : '이번 주일에 보이는 광고는 없어요.'}
            </p>
            <List label="광고 목록">
              {ads.map((a) => {
                const st = statusOf(a, thisSunday);
                return (
                  <ListRow key={a.id}
                    title={<span className={s.title}>{a.title}{a.pinned && <Icon name="pin" size={16} label="고정" />}</span>}
                    meta={period(a)}
                    aside={<span className={[s.status, s[st]].join(' ')}>{STATUS_LABEL[st]}</span>}
                    open={open === a.id} onToggle={() => setOpen((o) => (o === a.id ? null : a.id))}>
                    <AdForm initial={a} thisSunday={thisSunday} label={`${a.title} 고치기`} submitLabel="저장"
                      onSubmit={async (next) => {
                        await saveAnnouncement(db, a.id, next);
                        show('광고를 저장했어요');
                        setOpen(null);
                        await reload();
                      }} />
                    <div className={s.danger}>
                      <ConfirmAction label="삭제" icon="trash" confirmLabel="삭제하기"
                        message="학생 화면에서 바로 사라지고 되돌릴 수 없어요."
                        onConfirm={async () => {
                          await deleteAnnouncement(db, a.id);
                          show('광고를 삭제했어요');
                          setOpen(null);
                          await reload();
                        }} />
                    </div>
                  </ListRow>
                );
              })}
            </List>
          </>
        )}
      </Card>

      <Card title="새 광고">
        <AdForm thisSunday={thisSunday} label="새 광고" submitLabel="광고 추가" primary resetAfter
          onSubmit={async (next) => {
            await saveAnnouncement(db, null, next);
            show('광고를 추가했어요');
            await reload();
          }} />
      </Card>
    </div>
  );
}

function AdForm({ initial, thisSunday, label, submitLabel, primary = false, resetAfter = false, onSubmit }: {
  initial?: AdInput;
  thisSunday: string;
  /** 폼 이름(화면 읽기) */
  label: string;
  submitLabel: string;
  primary?: boolean;
  /** 저장 뒤 빈 폼으로(새 광고) */
  resetAfter?: boolean;
  /** 실패하면 던진다 → 오류 토스트, 입력은 그대로 */
  onSubmit(a: AdInput): Promise<void>;
}) {
  const { show } = useToast();
  const blank: AdInput = { title: '', body: '', startDate: thisSunday, endDate: thisSunday, pinned: false };
  const [v, setV] = useState<AdInput>(() => initial
    ? { title: initial.title, body: initial.body, startDate: initial.startDate, endDate: initial.endDate, pinned: initial.pinned }
    : blank);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next = { ...v, title: v.title.trim(), body: v.body.trim() };
    if (!next.title) {
      setTitleError('제목을 적어 주세요');
      titleRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      await onSubmit(next);
      if (resetAfter) { setV(blank); titleRef.current?.focus(); }
    } catch (err) {
      show(describeError(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={s.form} onSubmit={submit} noValidate aria-label={label}>
      <Field ref={titleRef} label="제목" autoComplete="off" maxLength={60} value={v.title} error={titleError}
        onChange={(e) => { setTitleError(null); setV({ ...v, title: e.target.value }); }} />
      <TextArea label="내용" rows={3} maxLength={300} showCount value={v.body} hint="비워 둬도 돼요"
        onChange={(e) => setV({ ...v, body: e.target.value })} />
      <div className={s.dates}>
        <SundayStepper label="시작" showLabel compact value={v.startDate} thisSunday={thisSunday}
          onChange={(d) => setV({ ...v, startDate: d, endDate: d > v.endDate ? d : v.endDate })} />
        <SundayStepper label="끝" showLabel compact value={v.endDate} thisSunday={thisSunday} earliest={v.startDate}
          onChange={(d) => setV({ ...v, endDate: d })} />
        <p className={s.muted}>시작부터 끝 주일까지 학생 홈과 주보에 보여요.</p>
      </div>
      <ChoiceChips legend="고정" multiple options={[{ value: 'pin', label: '맨 위에 고정' }]}
        value={v.pinned ? ['pin'] : []} onChange={(xs) => setV({ ...v, pinned: xs.includes('pin') })}
        hint="고정한 광고는 다른 광고보다 먼저 보여요" />
      <Button type="submit" variant={primary ? 'primary' : 'secondary'} block busy={busy}
        icon={primary ? <Icon name="plus" size={20} /> : undefined}>
        {submitLabel}
      </Button>
    </form>
  );
}
