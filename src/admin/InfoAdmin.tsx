import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { describeError, useToast } from '../app/Toast';
import { useLoader } from '../app/useLoader';
import { useLeaveGuard } from '../app/leaveGuard';
import { getChurchInfo, getMemberInfo, saveInfo } from '../data/info';
import { db } from '../lib/firebase';
import { Button } from '../ui/Button';
import { InfoCard } from '../ui/InfoCard';
import { Field, TextArea } from '../ui/Field';
import { LoadError } from '../ui/LoadError';
import { Loading } from '../ui/Loading';
import { EditorBar, EditorErrorLink } from './EditorBar';
import { InfoPairRows } from './InfoPairRows';
import { savedPairRows } from './infoPairRowsState';
import { EditorLayout, EditorSection } from './EditorLayout';
import { MAP_ERROR, fromSaved, readForm, snapshot, type Form } from './infoAdminForm';
import s from './InfoAdmin.module.css';

/**
 * 관리 → 중등부 안내. 표어·섬기는 분들·예배 에티켓·오시는 길·연락처를 한 번에 저장한다.
 * 공개 안내(settings/info)와 이름·번호(memberInfo/main)는 다른 문서지만 한 번에(한 배치로) 저장한다.
 * 저장 안 한 내용이 있으면 앱 안 메뉴로 나가려 할 때 그 자리에서 묻는다.
 */
export function InfoAdmin() {
  const { show } = useToast();
  const loaded = useLoader(
    useCallback(async () => {
      const [church, members] = await Promise.all([getChurchInfo(db), getMemberInfo(db)]);
      return { church, members };
    }, []),
  );
  const [form, setForm] = useState<Form | null>(null);
  // 마지막으로 불러오거나 저장한 값(이것과 같으면 저장 버튼이 잠긴다)
  const [base, setBase] = useState('');
  const [savedRows, setSavedRows] = useState<Pick<Form, 'servants' | 'contacts'>>({ servants: [], contacts: [] });
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  const [focusBad, setFocusBad] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  // 저장 안 한 내용이 있을 때 붙잡아 둔 이동(묻는 중이면 그 이동, 아니면 null)
  const [pending, setPending] = useState<{ go(): void } | null>(null);

  const data = loaded.data;
  useEffect(() => {
    if (!data) return;
    const f = fromSaved(data.church, data.members);
    setForm(f);
    setBase(snapshot(f));
    setSavedRows(f);
  }, [data]);

  useEffect(() => {
    if (focusBad) rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusBad]);

  const dirty = form !== null && snapshot(form) !== base;
  useLeaveGuard(useMemo(() => (dirty ? (go: () => void) => setPending({ go }) : null), [dirty]));

  if (!form) {
    if (loaded.error && !loaded.loading)
      return <LoadError error={loaded.error} onRetry={loaded.reload} />;
    return <Loading />;
  }

  const update = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const mapError = checked && readForm(form).mapInvalid ? MAP_ERROR : null;

  async function save() {
    const read = readForm(form!);
    if (read.mapInvalid) {
      setChecked(true);
      setFocusBad((n) => n + 1);
      show('고칠 곳이 있어요', 'error');
      return;
    }
    setBusy(true);
    try {
      await saveInfo(db, read.church, read.members);
      const saved = {
        ...fromSaved(read.church, read.members),
        servants: savedPairRows(form!.servants),
        contacts: savedPairRows(form!.contacts),
      };
      setForm((current) => (current && snapshot(current) === snapshot(form!) ? saved : current));
      setBase(snapshot(saved));
      setSavedRows(saved);
      setChecked(false);
      setPending(null);
      show('저장했어요');
    } catch (e) {
      show(describeError(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.stack} ref={rootRef}>
      <div className={s.intro}>
        <p className={s.kicker}>우리 중등부를 소개해요</p>
        <h2>한 번 고치면, 모든 주보에</h2>
        <p>저장하면 지난 주보를 포함한 모든 주보의 안내가 바뀌어요.</p>
      </div>
      <EditorLayout
        sections={[
          { id: 'info-motto', title: '올해 표어' },
          { id: 'info-etiquette', title: '예배 시간과 에티켓' },
          { id: 'info-place', title: '오시는 길' },
          { id: 'info-servants', title: '섬기는 분들' },
          { id: 'info-contacts', title: '연락처' },
        ]}
        preview={
          <>
            <h2 className={s.previewTitle}>학생에게 보일 안내</h2>
            <p className={s.hint}>고치는 내용이 바로 보여요. 저장해야 실제 주보에 반영돼요.</p>
            <InfoCard info={readForm(form).church} members={readForm(form).members} />
          </>
        }
      >
        <EditorSection
          id="info-motto"
          title="올해 표어"
          description="누구나 볼 수 있어요"
          tone="gold"
        >
          <div className={s.fields}>
            <Field
              label="표어"
              autoComplete="off"
              value={form.title}
              placeholder="예: 동행하는 자"
              onChange={(e) => update({ title: e.target.value })}
            />
            <TextArea
              label="설명"
              rows={2}
              value={form.subtitle}
              onChange={(e) => update({ subtitle: e.target.value })}
            />
            <TextArea
              label="말씀"
              rows={3}
              value={form.verse}
              onChange={(e) => update({ verse: e.target.value })}
            />
            <Field
              label="말씀 출처"
              autoComplete="off"
              value={form.ref}
              placeholder="예: 미가 6:8"
              onChange={(e) => update({ ref: e.target.value })}
            />
          </div>
        </EditorSection>

        <EditorSection
          id="info-etiquette"
          title="예배 시간과 에티켓"
          description="누구나 볼 수 있어요"
        >
          <TextArea
            label="예배 에티켓"
            rows={5}
            value={form.etiquette}
            hint="한 줄에 하나씩 적어요. 예배 시간도 여기에 함께 안내해요."
            onChange={(e) => update({ etiquette: e.target.value })}
          />
        </EditorSection>

        <EditorSection id="info-place" title="오시는 길" description="누구나 볼 수 있어요">
          <div className={s.fields}>
            <Field
              label="장소 이름"
              autoComplete="off"
              value={form.placeName}
              onChange={(e) => update({ placeName: e.target.value })}
            />
            <Field
              label="주소"
              autoComplete="off"
              value={form.address}
              onChange={(e) => update({ address: e.target.value })}
            />
            <Field
              label="지도 링크"
              autoComplete="off"
              inputMode="url"
              value={form.mapUrl}
              error={mapError}
              onChange={(e) => update({ mapUrl: e.target.value })}
            />
            <Field
              label="교회 전화"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={form.churchPhone}
              hint="누구나 볼 수 있어요"
              onChange={(e) => update({ churchPhone: e.target.value })}
            />
          </div>
        </EditorSection>
        <EditorSection
          id="info-servants"
          title="섬기는 분들"
          description="학생 링크를 받은 사람과 선생님만 볼 수 있어요"
          tone="sage"
        >
          <InfoPairRows
            legend="섬기는 분들"
            labelA="직분"
            labelB="이름"
            addLabel="한 줄 추가"
            multilineB
            rows={form.servants}
            savedRows={savedRows.servants}
            onChange={(servants) => update({ servants })}
          />
        </EditorSection>
        <EditorSection
          id="info-contacts"
          title="연락처"
          description="학생 링크를 받은 사람과 선생님만 볼 수 있어요"
        >
          <InfoPairRows
            legend="연락처"
            labelA="이름"
            labelB="전화번호"
            addLabel="연락처 추가"
            inputModeB="tel"
            rows={form.contacts}
            savedRows={savedRows.contacts}
            onChange={(contacts) => update({ contacts })}
          />
        </EditorSection>
      </EditorLayout>
      <EditorBar
        dirty={dirty}
        note="모든 주보의 중등부 안내에 반영돼요."
        validation={
          mapError ? (
            <EditorErrorLink onClick={() => setFocusBad((n) => n + 1)}>
              지도 링크를 확인해 주세요 — 고칠 곳으로
            </EditorErrorLink>
          ) : undefined
        }
        leave={
          pending
            ? {
                onStay: () => setPending(null),
                onLeave: () => {
                  const { go } = pending;
                  setPending(null);
                  go();
                },
              }
            : null
        }
      >
        <Button busy={busy} disabled={!dirty} onClick={save}>
          저장
        </Button>
      </EditorBar>
    </div>
  );
}
