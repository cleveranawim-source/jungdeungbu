import { useCallback, useMemo, useState } from 'react';
import { describeError, useToast } from '../app/Toast';
import { useLoader } from '../app/useLoader';
import { listAttendanceByDate } from '../data/attendance';
import { listClasses } from '../data/classes';
import { listStudents } from '../data/students';
import { attendanceCsv } from '../lib/csv';
import { formatMonthDay, semesterStart, sundaysBetween, weeksBetween } from '../lib/dates';
import { db } from '../lib/firebase';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/icons';
import { LoadError } from '../ui/LoadError';
import { Loading } from '../ui/Loading';
import { SundayStepper } from '../ui/SundayStepper';
import { computeStats, type Stats } from './stats';
import s from './StatsAdmin.module.css';

/** 한 번에 읽을 수 있는 주일 수(읽기 횟수 = 주일 수) */
export const MAX_WEEKS = 30;

function Meter({ rate }: { rate: number | null }) {
  return (
    <span className={s.track} aria-hidden="true">
      <span className={s.fill} style={{ width: `${rate ?? 0}%` }} />
    </span>
  );
}

const pct = (rate: number | null) => (rate === null ? '-' : `${rate}%`);

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** 관리 → 출석 현황: 기간(시작·끝 주일) → 주일별 전체 출석률 · 반별 평균 · 학생별, CSV 내보내기. */
export function StatsAdmin({ thisSunday }: { thisSunday: string }) {
  const { show } = useToast();
  const [from, setFrom] = useState(() => sundaysBetween(semesterStart(thisSunday), thisSunday)[0] ?? thisSunday);
  const [to, setTo] = useState(thisSunday);
  const [showStudents, setShowStudents] = useState(false);

  const roster = useLoader(useCallback(async () => {
    const [students, classes] = await Promise.all([listStudents(db), listClasses(db)]);
    return { students, classes };
  }, []));
  const dates = useMemo(() => sundaysBetween(from, to), [from, to]);
  const att = useLoader(useCallback(async () => {
    const maps = await Promise.all(dates.map((d) => listAttendanceByDate(db, d)));
    return new Map(dates.map((d, i) => [d, maps[i]]));
  }, [dates]));

  const stats: Stats | null = useMemo(
    () => (roster.data && att.data ? computeStats(roster.data.students, roster.data.classes, att.data, dates) : null),
    [roster.data, att.data, dates],
  );

  const pick = (nextFrom: string, nextTo: string) => {
    if (weeksBetween(nextFrom, nextTo) + 1 > MAX_WEEKS) { show('한 번에 30주까지 볼 수 있어요'); return; }
    setFrom(nextFrom);
    setTo(nextTo);
  };

  const failed = roster.error || att.error;
  if (!roster.data || !att.data || !stats) {
    if (failed) return <LoadError error={failed} onRetry={() => { void roster.reload(); void att.reload(); }} />;
    return <Loading />;
  }
  const { students, classes } = roster.data;

  const exportCsv = () => {
    try {
      download(`출석_${from}_${to}.csv`, attendanceCsv(students, classes, att.data!, dates));
      show('CSV를 내려받았어요');
    } catch (e) {
      show(describeError(e), 'error');
    }
  };

  return (
    <div className={s.stack} aria-busy={att.loading || undefined}>
      <Card title="기간">
        <SundayStepper label="시작 주일" showLabel compact value={from} thisSunday={thisSunday}
          latest={to} onChange={(v) => pick(v, to)} />
        <SundayStepper label="끝 주일" showLabel compact value={to} thisSunday={thisSunday}
          earliest={from} latest={thisSunday} onChange={(v) => pick(from, v)} />
        <p className={s.summary} role="status">
          {dates.length}주 동안 전체 평균 출석률 <strong>{pct(stats.overall)}</strong>
        </p>
      </Card>

      {students.length === 0 ? (
        <EmptyState icon="list" title="등록된 학생이 없어요">학생 명단에서 학생을 먼저 등록해 주세요.</EmptyState>
      ) : (
        <>
          <Card title="주일별 출석">
            <ul className={s.rows} aria-label="주일별 출석">
              {stats.perDate.map((d) => (
                <li key={d.date} className={s.row}>
                  <span className={s.name}>{formatMonthDay(d.date)}</span>
                  <span className={s.value}>{d.present}/{d.total}명 · <strong>{pct(d.rate)}</strong></span>
                  <Meter rate={d.rate} />
                </li>
              ))}
            </ul>
          </Card>

          <Card title="반별 평균">
            <ul className={s.rows} aria-label="반별 평균 출석률">
              {stats.perClass.map((c) => (
                <li key={c.id} className={s.row}>
                  <span className={s.name}>{c.name}</span>
                  <span className={s.value}>학생 {c.students}명 · <strong>{pct(c.rate)}</strong></span>
                  <Meter rate={c.rate} />
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <Button variant="ghost" aria-expanded={showStudents} onClick={() => setShowStudents((v) => !v)}
              icon={<Icon name={showStudents ? 'chevronUp' : 'chevronDown'} />}>
              학생별 출석 {showStudents ? '접기' : `보기 (${stats.perStudent.length}명)`}
            </Button>
            {showStudents && (
              <ul className={s.rows} aria-label="학생별 출석">
                {stats.perStudent.map((st) => (
                  <li key={st.id} className={s.row}>
                    <span className={s.name}>{st.name} <span className={s.cls}>{st.className}</span></span>
                    <span className={s.value}><strong>{st.present}</strong>/{st.weeks}주</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <Button block icon={<Icon name="download" />} onClick={exportCsv} disabled={students.length === 0}>
        CSV 내보내기
      </Button>
    </div>
  );
}
