import { useCallback } from 'react';
import { studentHref } from '../app/router';
import { useLoader } from '../app/useLoader';
import { getSermon, listSermons } from '../data/content';
import { formatMonthDay, isDateId } from '../lib/dates';
import { db } from '../lib/firebase';
import { LinkButton } from '../ui/Button';
import { PageIntro } from '../ui/PageIntro';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/icons';
import { LoadError } from '../ui/LoadError';
import { Loading } from '../ui/Loading';
import type { Sermon } from '../types';
import type { StudentTabProps } from './types';
import s from './SermonTab.module.css';

/** 말씀: 설교 목록 → 상세(제목·본문·요약·내용·적용 질문). 상세는 주소에 날짜(`#/s/토큰/sermon/날짜`). */
export function SermonTab(props: StudentTabProps) {
  const { sub } = props;
  return sub && isDateId(sub) ? <SermonDetail {...props} date={sub} /> : <SermonList {...props} />;
}

function SermonList({ token, sundayId }: StudentTabProps) {
  const { data, error, reload } = useLoader(useCallback(() => listSermons(db), []));
  if (data === undefined)
    return error ? <LoadError error={error} onRetry={reload} audience="student" /> : <Loading />;
  // 미리 써 둔 다음 주 설교는 그 주가 되면 보인다
  const sermons = data.filter((x) => x.date <= sundayId);
  if (sermons.length === 0) {
    return (
      <EmptyState icon="sermon" title="아직 올라온 말씀이 없어요">
        설교 요약이 올라오면 여기서 다시 읽을 수 있어요.
      </EmptyState>
    );
  }
  return (
    <>
      <PageIntro title="말씀을 다시 마음에 담아요" icon="sermon" tone="gold">
        주일 말씀을 읽고, 한 주의 삶에 이어 가요.
      </PageIntro>
      <ul className={s.list}>
        {sermons.map((x) => (
          <li key={x.date}>
            <a className={s.row} href={studentHref(token, 'sermon', x.date)}>
              <span className={s.rowDate}>
                <span>{Number(x.date.slice(5, 7))}월</span>
                <strong>{Number(x.date.slice(8))}</strong>
                {x.date === sundayId && <span className={s.badge}>이번 주</span>}
              </span>
              <span className={s.rowCopy}>
                <span className={s.rowTitle}>{x.title}</span>
                {x.scripture && <span className={s.rowScripture}>{x.scripture}</span>}
                {x.summary && <span className={s.rowSummary}>{x.summary}</span>}
              </span>
              <Icon name="chevronRight" size={20} />
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

function SermonDetail({ token, date }: StudentTabProps & { date: string }) {
  const { data, error, reload } = useLoader(useCallback(() => getSermon(db, date), [date]));
  const back = (
    <div className={s.back}>
      <LinkButton
        href={studentHref(token, 'sermon')}
        variant="ghost"
        size="sm"
        icon={<Icon name="back" size={18} />}
      >
        말씀 목록
      </LinkButton>
    </div>
  );
  if (data === undefined)
    return (
      <>
        {back}
        {error ? <LoadError error={error} onRetry={reload} audience="student" /> : <Loading />}
      </>
    );
  if (data === null) {
    return (
      <>
        {back}
        <EmptyState icon="sermon" title={`${formatMonthDay(date)} 말씀이 없어요`}>
          목록에서 다른 말씀을 골라 보세요.
        </EmptyState>
      </>
    );
  }
  return (
    <>
      {back}
      <SermonArticle sermon={data} />
    </>
  );
}

/** 빈 줄로 문단을 나누고, 문단 안 줄바꿈은 그대로 둔다. */
const paragraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

function SermonArticle({ sermon }: { sermon: Sermon }) {
  const questions = sermon.questions.filter(Boolean);
  return (
    <article className={s.article} data-reading-columns="single">
      <header className={s.head}>
        <p className={s.meta}>{formatMonthDay(sermon.date)} 주일</p>
        <h2 className={s.title}>{sermon.title}</h2>
        {sermon.scripture && <p className={s.scripture}>{sermon.scripture}</p>}
      </header>
      {sermon.summary && <p className={s.summary}>{sermon.summary}</p>}
      {sermon.body && (
        <div className={s.body}>
          {paragraphs(sermon.body).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}
      {questions.length > 0 && (
        <section className={s.questions} aria-labelledby={`${sermon.date}-q`}>
          <h3 id={`${sermon.date}-q`}>생각해 볼 질문</h3>
          <ol>
            {questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}
