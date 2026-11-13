import { useCallback, type ReactNode } from 'react';
import { teacherHref } from '../app/router';
import { useToast } from '../app/Toast';
import { useLoader, type Loaded } from '../app/useLoader';
import {
  deleteClassPrayer,
  deleteTeacherPrayer,
  listClassPrayers,
  listTeacherPrayers,
} from '../data/prayers';
import { formatMonthDay, toDateId } from '../lib/dates';
import { db } from '../lib/firebase';
import type { Prayer, WithId } from '../types';
import { LinkButton } from '../ui/Button';
import { Card } from '../ui/Card';
import { ConfirmAction } from '../ui/ConfirmAction';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/icons';
import { LoadError } from '../ui/LoadError';
import { Loading } from '../ui/Loading';
import { ClassPicker } from './ClassPicker';
import type { TeacherTabProps } from './types';
import { useClassChoice, useMyClasses } from './useClassChoice';
import s from './TeacherPrayerTab.module.css';

/**
 * 기도: 반 고르기 → "우리 반에 나눈 기도"(반 친구들도 보는 글) · "선생님께만"(교사만 보는 글).
 * 교사는 어느 글이든 지울 수 있다(줄 안 확인 뒤). 숨기기는 없다.
 */
export function TeacherPrayerTab({ teacher }: TeacherTabProps) {
  const classes = useMyClasses(teacher);
  const [current, choose] = useClassChoice(classes.data);

  if (classes.data === undefined) {
    return classes.error ? (
      <LoadError error={classes.error} onRetry={classes.reload} />
    ) : (
      <Loading />
    );
  }
  if (current === null) {
    return teacher.role === 'admin' ? (
      <EmptyState
        icon="class"
        title="아직 반이 없어요"
        action={
          <LinkButton href={teacherHref('admin', 'classes')} variant="secondary" size="sm">
            반 만들기
          </LinkButton>
        }
      >
        반·교사에서 반을 먼저 만들어 주세요.
      </EmptyState>
    ) : (
      <EmptyState icon="class" title="담당 반이 없어요">
        관리자에게 담당 반을 정해 달라고 해 주세요.
      </EmptyState>
    );
  }
  const klass = classes.data.find((c) => c.id === current)!;
  return (
    <>
      <ClassPicker classes={classes.data} value={current} onChange={choose} />
      <ClassPrayers key={current} classId={current} className={klass.name} />
    </>
  );
}

function ClassPrayers({ classId, className }: { classId: string; className: string }) {
  const { show } = useToast();
  const shared = useLoader(useCallback(() => listClassPrayers(db, classId), [classId]));
  const privates = useLoader(useCallback(() => listTeacherPrayers(db, [classId]), [classId]));

  return (
    <div className={s.columns}>
      <PrayerSection
        title="우리 반에 나눈 기도"
        hint={`${className} 친구들과 선생님이 함께 보는 기도예요.`}
        empty="아직 나눈 기도 제목이 없어요"
        loaded={shared}
        confirmMessage="이 기도 제목을 지울까요? 학생 화면에서도 사라지고, 되돌릴 수 없어요."
        onDelete={async (p) => {
          await deleteClassPrayer(db, classId, p.id);
          show('삭제했어요');
          await shared.reload();
        }}
      />
      <PrayerSection
        private
        title="선생님께만"
        hint={
          <>
            학생이 선생님께만 보낸 기도예요.
            <br />
            소중히 다뤄 주세요.
          </>
        }
        empty="선생님께만 보낸 기도가 아직 없어요"
        loaded={privates}
        confirmMessage="이 기도 제목을 지울까요? 지운 글은 되돌릴 수 없어요."
        onDelete={async (p) => {
          await deleteTeacherPrayer(db, p.id);
          show('삭제했어요');
          await privates.reload();
        }}
      />
    </div>
  );
}

interface PrayerSectionProps {
  title: string;
  hint: ReactNode;
  empty: string;
  /** 선생님께만: 편지 아이콘과 공개 범위 문장 */
  private?: boolean;
  loaded: Loaded<WithId<Prayer>[]>;
  confirmMessage: string;
  /** 실패하면 던진다(ConfirmAction 이 오류 토스트) */
  onDelete(p: WithId<Prayer>): Promise<void>;
}

function PrayerSection({
  title,
  hint,
  empty,
  private: isPrivate = false,
  loaded,
  confirmMessage,
  onDelete,
}: PrayerSectionProps) {
  const list = loaded.data;
  const heading = (
    <span className={s.heading}>
      <Icon name={isPrivate ? 'mail' : 'prayer'} size={22} />
      <span>{title}</span>
      {list !== undefined && list.length > 0 && (
        <span className={s.count}>
          {list.length}
          <span className="sr-only">개</span>
        </span>
      )}
    </span>
  );

  let body;
  if (list === undefined) {
    body = loaded.error ? <LoadError error={loaded.error} onRetry={loaded.reload} /> : <Loading />;
  } else if (list.length === 0) {
    body = (
      <p className={s.empty}>
        <Icon name="prayer" size={20} />
        {empty}
      </p>
    );
  } else {
    body = (
      <ul className={s.list} aria-label={title}>
        {list.map((p) => (
          <li key={p.id} className={s.item}>
            <p className={s.who}>
              <span className={s.name}>{p.studentName}</span>
              <span className={s.when}>{formatMonthDay(toDateId(p.createdAt.toDate()))}</span>
            </p>
            <p className={s.text}>{p.text}</p>
            <div className={s.actions}>
              <ConfirmAction
                quiet
                label="삭제"
                icon="trash"
                message={confirmMessage}
                confirmLabel="삭제하기"
                onConfirm={() => onDelete(p)}
              />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Card title={heading} tone={isPrivate ? 'gold' : 'sage'}>
      <p className={s.hint}>{hint}</p>
      {body}
    </Card>
  );
}
