import { expect, test } from 'vitest';
import { DEFAULT_ORDER } from '../../src/types';
import {
  birthdaysInMonth, displayOrder, formatBirthdayLines, isFirstAttendance, nextIssue, parseBirthdayLines,
  parseLines, parseTally, safeHttpUrl, summarizeAttendance, telHref,
} from '../../src/lib/bulletin';

const st = (id: string, classId: string, extra: object = {}) =>
  ({ id, name: id, classId, birthday: null, active: true, streak: 0, lastPresent: null, ...extra });
const cls = (id: string, name: string, order: number) => ({ id, name, grade: 1, order });

test('기본 예배 순서는 종이 주보와 같다', () => {
  expect(DEFAULT_ORDER.map((o) => `${o.standing ? '*' : ''}${o.type}`)).toEqual([
    '경배와 찬양', '*신앙고백', '*영광찬송', '*합심기도', '*기도', '봉헌', '성경봉독', '설교', '*찬송', '*축복기도', '소식나눔', '축하나눔',
  ]);
  const by = (t: string) => DEFAULT_ORDER.find((o) => o.type === t)!;
  expect(by('신앙고백')).toMatchObject({ title: '사도신경', detail: '다함께' });
  expect(by('경배와 찬양').detail).toBe('리조이스 찬양팀');
  expect(by('소식나눔').detail).toBe('김형준 부장님');
  expect(by('축하나눔').detail).toBe('학생임원');
  for (const t of ['영광찬송', '합심기도', '성경봉독', '찬송']) expect(by(t).detail).toBe('다함께');
  for (const t of ['기도', '봉헌', '설교', '축복기도']) expect(by(t)).toMatchObject({ title: '', detail: '' });
});

test('nextIssue: 끝 숫자만 1 올린다', () => {
  expect(nextIssue('2026-41호')).toBe('2026-42호');
  expect(nextIssue('제9호')).toBe('제10호');
  expect(nextIssue('2026-09호')).toBe('2026-10호');
  expect(nextIssue('')).toBe('');
  expect(nextIssue('가을호')).toBe('');
});

test('displayOrder: 비어 있는 성경봉독·설교 줄을 본문·설교 제목으로 채운다', () => {
  const order = [
    { type: '성경 봉독', title: '', detail: '다함께' },
    { type: ' 설교 ', title: '', detail: '이승열 목사님' },
    { type: '찬송', title: '주님 말씀 앞에 선', detail: '다함께', standing: true },
  ];
  const v = displayOrder(order, '누가복음 17장 11-19절', '지금의 자리에서 감사');
  expect(v.rows[0]).toMatchObject({ title: '누가복음 17장 11-19절', from: 'scripture' });
  expect(v.rows[1]).toMatchObject({ title: '지금의 자리에서 감사', from: 'sermon' });
  expect(v.rows[2].from).toBeUndefined();
  expect(v).toMatchObject({ showsScripture: true, showsSermon: true });
});

test('displayOrder: 직접 적은 내용은 그대로, 순서 이름이 없으면 채우지 않는다', () => {
  const v = displayOrder([{ type: '설교', title: '직접 적은 제목', detail: '' }], '요 3:16', '다른 제목');
  expect(v.rows[0].title).toBe('직접 적은 제목');
  expect(v.rows[0].from).toBeUndefined();
  expect(v).toMatchObject({ showsScripture: false, showsSermon: false });
  // 값이 없으면 채울 것도 없다
  expect(displayOrder([{ type: '설교', title: '', detail: '' }], '', '').showsSermon).toBe(false);
  // 완전히 빈 줄은 뺀다(지금 보기와 같게)
  expect(displayOrder([{ type: '', title: '', detail: '' }], '', '').rows).toEqual([]);
});

test('summarizeAttendance: 활성 학생 기준, 반 순서대로, 죽은 토큰은 세지 않는다', () => {
  const students = [st('a1', 'A'), st('a2', 'A'), st('b1', 'B')];
  const classes = [cls('B', '1-2', 2), cls('A', '1-1', 1), cls('C', '1-3', 3)];
  const present = new Map([['a1', true], ['a2', false], ['b1', true], ['dead', true]]);
  expect(summarizeAttendance('2026-11-08', students, classes, present)).toEqual({
    sunday: '2026-11-08',
    classes: [
      { classId: 'A', name: '1-1', present: 1, total: 2 },
      { classId: 'B', name: '1-2', present: 1, total: 1 },
    ], // 학생이 0명인 반(C)은 뺀다
    students: { present: 2, total: 3 },
    teachers: null,
  });
});

test('summarizeAttendance: 활성 학생의 출석 기록이 하나도 없으면 null', () => {
  expect(summarizeAttendance('2026-11-08', [st('a1', 'A')], [cls('A', '1-1', 1)], new Map([['dead', true]]))).toBeNull();
  expect(summarizeAttendance('2026-11-08', [], [], new Map())).toBeNull();
});

test('birthdaysInMonth: 주보 날짜의 달, 날짜순 → 이름순', () => {
  const students = [
    st('나', 'A', { birthday: '11-20' }), st('가', 'A', { birthday: '11-20' }), st('다', 'A', { birthday: '11-03' }),
    st('라', 'A', { birthday: '12-01' }), st('마', 'A'),
  ];
  expect(birthdaysInMonth(students, '2026-11-15')).toEqual([
    { name: '다', date: '11-03' }, { name: '가', date: '11-20' }, { name: '나', date: '11-20' },
  ]);
});

test('isFirstAttendance: 그 주일에 나왔고 그 전 출석이 없을 때만', () => {
  expect(isFirstAttendance([{ date: '2026-11-08', present: true }], '2026-11-08')).toBe(true);
  expect(isFirstAttendance([{ date: '2026-11-01', present: false }, { date: '2026-11-08', present: true }], '2026-11-08')).toBe(true);
  expect(isFirstAttendance([{ date: '2026-11-01', present: true }, { date: '2026-11-08', present: true }], '2026-11-08')).toBe(false);
  expect(isFirstAttendance([{ date: '2026-11-08', present: false }], '2026-11-08')).toBe(false);
  expect(isFirstAttendance([], '2026-11-08')).toBe(false);
});

test('parseTally: 둘 다 비면 null, 0 이상 정수이고 출석<=전체만', () => {
  expect(parseTally('', ' ')).toBeNull();
  expect(parseTally('13', '15')).toEqual({ present: 13, total: 15 });
  expect(parseTally('0', '0')).toEqual({ present: 0, total: 0 });
  for (const [p, t] of [['13', ''], ['', '15'], ['-1', '15'], ['16', '15'], ['1.5', '15'], ['열', '15']]) {
    expect(parseTally(p, t)).toBe('invalid');
  }
});

test('줄 파싱: 빈 줄·앞뒤 공백 정리, 생일 줄은 "mm-dd 이름"', () => {
  expect(parseLines(' 윤새봄 \n\n문하람\n')).toEqual(['윤새봄', '문하람']);
  expect(parseBirthdayLines('11-03 김하늘\n\n 11-20  이바다 ')).toEqual([
    { name: '김하늘', date: '11-03' }, { name: '이바다', date: '11-20' },
  ]);
  expect(parseBirthdayLines('')).toEqual([]);
  expect(parseBirthdayLines('13-40 김하늘')).toBe('invalid');
  expect(parseBirthdayLines('김하늘')).toBe('invalid');
  expect(formatBirthdayLines([{ name: '김하늘', date: '11-03' }])).toBe('11-03 김하늘');
});

test('safeHttpUrl: https·http 주소만 링크로 쓴다', () => {
  expect(safeHttpUrl(' https://naver.me/abc ')).toBe('https://naver.me/abc');
  expect(safeHttpUrl('http://example.com')).toBe('http://example.com');
  for (const bad of ['', 'javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', 'naver.me/abc', '//evil.example']) {
    expect(safeHttpUrl(bad)).toBeNull();
  }
});

test('telHref: 숫자와 맨 앞 +만 남긴다', () => {
  expect(telHref('02-303-2501')).toBe('tel:023032501');
  expect(telHref('+82 10-1234-5678')).toBe('tel:+821012345678');
  expect(telHref('문의')).toBeNull();
});
