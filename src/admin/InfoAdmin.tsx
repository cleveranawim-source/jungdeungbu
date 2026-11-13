import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { describeError, useToast } from '../app/Toast';
import { useLoader } from '../app/useLoader';
import { useLeaveGuard } from '../app/leaveGuard';
import { getChurchInfo, getMemberInfo, saveInfo } from '../data/info';
import { parseLines, safeHttpUrl } from '../lib/bulletin';
import { db } from '../lib/firebase';
import type { ChurchInfo, MemberInfo } from '../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Field, TextArea } from '../ui/Field';
import { LoadError } from '../ui/LoadError';
import { Loading } from '../ui/Loading';
import { EditorBar } from './EditorBar';
import { fromPairs, PairRows, toPairs, type Pair } from './PairRows';
import s from './InfoAdmin.module.css';

const MAP_ERROR = 'https:// 로 시작하는 주소를 붙여 넣어 주세요';

// 화면용 폼(줄 목록은 key 를 붙인 Pair, 에티켓은 한 줄에 하나인 긴 글)
interface Form {
  title: string; subtitle: string; verse: string; ref: string;
  servants: Pair[];
  etiquette: string;
  placeName: string; address: string; mapUrl: string; churchPhone: string;
  contacts: Pair[];
}

// ---------- 폼 ↔ 저장값 ----------

function fromSaved(church: ChurchInfo, members: MemberInfo | null): Form {
  return {
    title: church.motto.title, subtitle: church.motto.subtitle, verse: church.motto.verse, ref: church.motto.ref,
    servants: toPairs(members?.servants ?? [], (x) => x.role, (x) => x.names),
    etiquette: church.etiquette.join('\n'),
    placeName: church.place.name, address: church.place.address, mapUrl: church.place.mapUrl,
    churchPhone: church.churchPhone,
    contacts: toPairs(members?.contacts ?? [], (x) => x.label, (x) => x.phone),
  };
}

/**
 * 폼 → 저장할 두 문서. settings/info(공개)에는 표어·에티켓·장소·교회 전화만,
 * 사람 이름·개인 번호는 memberInfo/main 에만 나뉘어 담긴다.
 */
function readForm(f: Form): { church: ChurchInfo; members: MemberInfo; mapInvalid: boolean } {
  const mapUrl = f.mapUrl.trim();
  return {
    church: {
      motto: { title: f.title.trim(), subtitle: f.subtitle.trim(), verse: f.verse.trim(), ref: f.ref.trim() },
      etiquette: parseLines(f.etiquette),
      place: { name: f.placeName.trim(), address: f.address.trim(), mapUrl },
      churchPhone: f.churchPhone.trim(),
    },
    members: {
      servants: fromPairs(f.servants).map((p) => ({ role: p.a, names: p.b })),
      contacts: fromPairs(f.contacts).map((p) => ({ label: p.a, phone: p.b })),
    },
    mapInvalid: mapUrl !== '' && safeHttpUrl(mapUrl) === null,
  };
}

/** 저장할 모양으로 다듬은 값(바뀐 것이 있는지 비교용) */
const snapshot = (f: Form): string => {
  const { church, members } = readForm(f);
  return JSON.stringify({ church, members });
};

/**
 * 관리 → 중등부 안내. 표어·섬기는 분들·예배 에티켓·오시는 길·연락처를 한 번에 저장한다.
 * 공개 안내(settings/info)와 이름·번호(memberInfo/main)는 다른 문서지만 한 번에(한 배치로) 저장한다.
 * 저장 안 한 내용이 있으면 앱 안 메뉴로 나가려 할 때 그 자리에서 묻는다.
 */
export function InfoAdmin() {
  const { show } = useToast();
  const loaded = useLoader(useCallback(async () => {
    const [church, members] = await Promise.all([getChurchInfo(db), getMemberInfo(db)]);
    return { church, members };
  }, []));
  const [form, setForm] = useState<Form | null>(null);
  // 마지막으로 불러오거나 저장한 값(이것과 같으면 저장 버튼이 잠긴다)
  const [base, setBase] = useState('');
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
  }, [data]);

  useEffect(() => {
    if (focusBad) rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusBad]);

  const dirty = form !== null && snapshot(form) !== base;
  useLeaveGuard(useMemo(() => (dirty ? (go: () => void) => setPending({ go }) : null), [dirty]));

  if (!form) {
    if (loaded.error && !loaded.loading) return <LoadError error={loaded.error} onRetry={loaded.reload} />;
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
      const saved = fromSaved(read.church, read.members);
      setForm(saved);
      setBase(snapshot(saved));
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
      <Card title="올해 표어">
        <div className={s.fields}>
          <Field label="표어" autoComplete="off" value={form.title} placeholder="예: 동행하는 자"
            onChange={(e) => update({ title: e.target.value })} />
          <Field label="설명" autoComplete="off" value={form.subtitle}
            onChange={(e) => update({ subtitle: e.target.value })} />
          <TextArea label="말씀" rows={3} value={form.verse}
            onChange={(e) => update({ verse: e.target.value })} />
          <Field label="말씀 출처" autoComplete="off" value={form.ref} placeholder="예: 미가 6:8"
            onChange={(e) => update({ ref: e.target.value })} />
        </div>
      </Card>

      <Card title="섬기는 분들">
        <div className={s.fields}>
          <PairRows legend="섬기는 분들" labelA="직분" labelB="이름" addLabel="한 줄 추가"
            rows={form.servants} onChange={(servants) => update({ servants })} />
          <p className={s.hint}>학생 링크를 받은 사람과 선생님만 볼 수 있어요</p>
        </div>
      </Card>

      <Card title="예배 에티켓">
        <TextArea label="예배 에티켓" rows={5} value={form.etiquette}
          hint="한 줄에 하나씩 적어요"
          onChange={(e) => update({ etiquette: e.target.value })} />
      </Card>

      <Card title="오시는 길·연락처">
        <div className={s.fields}>
          <Field label="장소 이름" autoComplete="off" value={form.placeName}
            onChange={(e) => update({ placeName: e.target.value })} />
          <Field label="주소" autoComplete="off" value={form.address}
            onChange={(e) => update({ address: e.target.value })} />
          <Field label="지도 링크" autoComplete="off" inputMode="url" value={form.mapUrl} error={mapError}
            onChange={(e) => update({ mapUrl: e.target.value })} />
          <Field label="교회 전화" type="tel" inputMode="tel" autoComplete="off" value={form.churchPhone}
            onChange={(e) => update({ churchPhone: e.target.value })} />
          <PairRows legend="연락처" labelA="이름" labelB="전화번호" addLabel="연락처 추가" inputModeB="tel"
            rows={form.contacts} onChange={(contacts) => update({ contacts })} />
          <p className={s.hint}>개인 번호는 학생 링크를 받은 사람과 선생님만 볼 수 있어요</p>
        </div>
      </Card>

      <EditorBar dirty={dirty}
        leave={pending ? {
          onStay: () => setPending(null),
          onLeave: () => { const { go } = pending; setPending(null); go(); },
        } : null}>
        <Button busy={busy} disabled={!dirty} onClick={save}>저장</Button>
      </EditorBar>
    </div>
  );
}
