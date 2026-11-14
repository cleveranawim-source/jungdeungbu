import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { describeError, useToast } from '../app/Toast';
import { useLoader } from '../app/useLoader';
import { addPrayer, deleteClassPrayer, listClassPrayers } from '../data/prayers';
import { db } from '../lib/firebase';
import { formatMonthDay, toDateId } from '../lib/dates';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { ChoiceChips, type Choice } from '../ui/ChoiceChips';
import { ConfirmAction } from '../ui/ConfirmAction';
import { TextArea } from '../ui/Field';
import { Icon } from '../ui/icons';
import { LoadError } from '../ui/LoadError';
import { Loading } from '../ui/Loading';
import type { Prayer, WithId } from '../types';
import type { StudentTabProps } from './types';
import s from './PrayerTab.module.css';

type Visibility = 'class' | 'teachers';
const MAX = 500;

const VISIBILITY: readonly Choice<Visibility>[] = [
  { value: 'class', label: '우리 반' },
  { value: 'teachers', label: '선생님만' },
];

const VISIBILITY_HINT: Record<Visibility, string> = {
  class: '우리 반 친구들과 선생님이 함께 봐요.',
  teachers: '중등부 선생님들만 봐요. 아래 목록에는 나오지 않아요.',
};

/** flag 가 ms 동안 계속 참일 때만 참(잠깐 스치는 상태에 안내 문구가 깜빡이지 않게). */
function useLasting(flag: boolean, ms: number): boolean {
  const [lasting, setLasting] = useState(false);
  useEffect(() => {
    if (!flag) {
      setLasting(false);
      return;
    }
    const t = setTimeout(() => setLasting(true), ms);
    return () => clearTimeout(t);
  }, [flag, ms]);
  return lasting;
}

/** 기도: 올리기 폼(500자, 우리 반 / 선생님만) + 우리 반 기도 제목 목록(내 글은 삭제). */
export function PrayerTab({
  student,
  classId,
  myUid,
  sessionState,
  retrySession,
}: StudentTabProps) {
  const { show } = useToast();
  const list = useLoader(useCallback(() => listClassPrayers(db, classId), [classId]));
  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('class');
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const teacherDevice = sessionState === 'teacher';
  // 연결을 기다리는 중이면 이유를 알려 준다(첫 로딩의 짧은 pending 에는 띄우지 않는다)
  const waitingSession = useLasting(sessionState === 'pending', 1500);
  const waitingUpload = useLasting(busy, 2000);
  const waitingText = waitingUpload
    ? '연결되면 올라가요'
    : waitingSession
      ? '연결되면 올릴 수 있어요'
      : '';

  // 올리기를 눌렀다가 "잠시 뒤 다시 시도해 주세요"를 본 학생에게, 다시 연결되면 알려 준다.
  // 적어 둔 글은 그대로 남아 있고, 저절로 올리지는 않는다(한 번 더 눌러 올린다).
  const retryAsked = useRef(false);
  useEffect(() => {
    if (retryAsked.current && sessionState === 'ready') {
      retryAsked.current = false;
      show('이제 올릴 수 있어요');
    }
  }, [sessionState, show]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) {
      setFieldError('기도 제목을 적어 주세요');
      return;
    }
    if (sessionState !== 'ready' || !myUid) {
      show('잠시 뒤 다시 시도해 주세요', 'error');
      retryAsked.current = true;
      void retrySession();
      return;
    }
    setBusy(true);
    try {
      await addPrayer(db, myUid, { studentName: student.name, classId, text: body, visibility });
      setText('');
      if (visibility === 'teachers') {
        show('선생님께 전했어요');
      } else {
        show('올렸어요');
        void list.reload();
      }
    } catch (err) {
      show(describeError(err, 'student'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: WithId<Prayer>) {
    await deleteClassPrayer(db, classId, p.id);
    show('삭제했어요');
    await list.reload();
  }

  return (
    <div className={s.layout}>
      <Card title="작은 마음도 함께 나눠요">
        <form className={s.form} onSubmit={submit} noValidate>
          <p className={s.hint}>기도 제목을 적고, 함께 볼 사람을 골라요.</p>
          <fieldset className={s.fields} disabled={teacherDevice || busy}>
            <TextArea
              label="기도 제목"
              placeholder="예) 이번 주 시험을 차분하게 볼 수 있게"
              value={text}
              maxLength={MAX}
              showCount
              rows={4}
              error={fieldError}
              hint={`${MAX}자까지 쓸 수 있어요`}
              onChange={(e) => {
                setText(e.target.value);
                if (fieldError) setFieldError(null);
              }}
            />
            <ChoiceChips<Visibility>
              legend="누가 볼까요"
              options={VISIBILITY}
              value={visibility}
              multiple={false}
              onChange={setVisibility}
              hint={VISIBILITY_HINT[visibility]}
            />
          </fieldset>
          {teacherDevice ? (
            <p className={s.note}>
              <Icon name="info" size={18} />
              선생님 계정으로 로그인된 기기예요
            </p>
          ) : (
            waitingText && (
              <p className={s.note} aria-hidden="true">
                <Icon name="offline" size={18} />
                {waitingText}
              </p>
            )
          )}
          {/* 늘 있는 알림 영역이라야 화면 읽기가 바뀐 문구를 읽어 준다 */}
          <span className="sr-only" role="status">
            {teacherDevice ? '' : waitingText}
          </span>
          <Button
            type="submit"
            block
            busy={busy}
            disabled={teacherDevice || sessionState === 'pending'}
            icon={<Icon name="prayer" size={20} />}
          >
            올리기
          </Button>
        </form>
      </Card>

      <Card title="우리 반 기도 제목">
        {list.data === undefined ? (
          list.error ? (
            <LoadError error={list.error} onRetry={list.reload} audience="student" />
          ) : (
            <Loading />
          )
        ) : list.data.length === 0 ? (
          <div className={s.empty}>
            <Icon name="prayer" size={20} />
            <div>
              <h3>아직 올라온 기도 제목이 없어요</h3>
              <p>기도 제목을 올리면 우리 반이 함께 볼 수 있어요.</p>
            </div>
          </div>
        ) : (
          <ul className={s.list}>
            {list.data.map((p) => {
              const mine = myUid !== null && p.authorUid === myUid;
              return (
                <li key={p.id} className={s.item}>
                  <p className={s.who}>
                    <span className={s.name}>{p.studentName}</span>
                    {mine && <span className={s.mine}>내 글</span>}
                    <span className={s.when}>{formatMonthDay(toDateId(p.createdAt.toDate()))}</span>
                  </p>
                  <p className={s.text}>{p.text}</p>
                  {mine && (
                    <div className={s.actions}>
                      <ConfirmAction
                        label="삭제"
                        icon="trash"
                        message="이 기도 제목을 지울까요? 지운 글은 되돌릴 수 없어요."
                        confirmLabel="삭제하기"
                        onConfirm={() => remove(p)}
                        errorAudience="student"
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
