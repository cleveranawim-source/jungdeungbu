# 종이 주보 맞추기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 앱 주보의 예배 순서를 종이 주보와 같은 모양으로 맞추고, 종이 주보에만 있던 정보(헌금 명단 제외)를 앱에서 볼 수 있게 한다.

**Architecture:** 매주 바뀌는 공개 정보는 `bulletins/{date}` 문서에 칸을 더하고, 이름이 들어가는 비공개 정보는 `bulletins/{date}/members/main`과 `memberInfo/main`에 따로 두어 "선생님 또는 활성 학생 세션"만 읽게 규칙으로 잠근다. 거의 안 바뀌는 공개 정보는 `settings/info`. 출석 인원·새 친구·생일은 관리자가 "불러오기"를 누를 때 계산해 폼에 채우고, 저장된 값이 정본이다.

**Tech Stack:** Vite 8 · React 19 · TypeScript strict · CSS Modules(토큰은 `src/ui/theme.css`) · Firestore + rules · Vitest · Playwright(에뮬레이터)

**Spec:** `docs/superpowers/specs/2026-11-13-paper-bulletin-parity-design.md` (실행자는 이 문서와 `docs/design.md`, `firestore.rules`를 함께 읽는다)

## Global Constraints

- 브랜치 `feat/paper-bulletin`에서 작업한다(main에 직접 커밋 금지). 운영(`mjc-jungdeungbu`)에는 아무것도 배포하지 않는다 — 규칙 배포·main 푸시는 사용자 몫.
- **헌금 명단은 어디에도 저장하지 않는다.** 그런 칸·타입을 만들지 않는다.
- 개인 전화번호·새 친구 이름·생일 명단·섬기는 분들은 **`bulletins/{date}` 문서와 `settings/*` 문서에 절대 넣지 않는다**(둘 다 로그인 없이 읽힌다).
- 학생 화면에 반별 **학생 이름 명단을 싣지 않는다**. 반별 출석은 숫자만.
- 디자인은 `docs/design.md` 그대로: 색은 `theme.css` 토큰만(모듈 CSS에 hex 금지 — `tests/unit/design-guard.test.ts`), 구역 제목은 `var(--font-display)`, 숫자는 `var(--font-body)`, 새 색·새 글꼴·종이 주보의 청록색 금지. 화면에 자물쇠 아이콘을 그리지 않는다.
- 터치 대상 44px 이상(`--touch-min`), 360px 폭에서 가로 스크롤 없음.
- 화면 글은 한국어 "~해요" 말투(기존 화면과 같게).
- 규칙을 바꾸면 반드시 `tests/rules`에 시험을 더한다. 학생 페이지 e2e는 새 브라우저 컨텍스트(`openStudent`, `tests/e2e/helpers.ts`)로 연다.
- 시험 명령: `npm run test:unit` · `npm run test:rules`(규칙+data, 에뮬레이터) · `npm run test:e2e` · `npm run build`. 한 파일만: `npm run test:unit -- tests/unit/x.test.ts`, `npm run test:rules -- tests/rules/x.test.ts`(따옴표 안 명령 뒤에 붙지 않으면 `bash scripts/with-java.sh npx firebase emulators:exec --only firestore --project demo-jungdeungbu "vitest run --no-file-parallelism tests/rules/x.test.ts"`), `npm run test:e2e -- tests/e2e/x.spec.ts`.
- 커밋 메시지는 한국어, 끝에 `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.

## Review Focus

1. **옛 모양 문서**: 새 칸이 없는 주보 문서·`standing` 없는 템플릿·`newcomer` 없는 학생 문서를 읽어도 화면이 깨지지 않고 빈 값으로 보인다. → Task 3 `normalizeBulletin` 시험.
2. **지도 링크에 `javascript:`·http 아닌 값**: 버튼을 그리지 않는다(링크로 실행되지 않는다). → Task 1 `safeHttpUrl` 시험.
3. **학생 세션이 아직 준비 중이거나 실패**: 잠긴 구역만 조용히 빠지고(오류 문구 없음) 공개 부분은 그대로 보인다. 세션이 준비되면 나타난다. → Task 4 e2e.
4. **출석 기록이 없거나 반에 학생이 0명**: "0/0" 줄이나 NaN 없이 출석 구역 자체가 빠지거나 그 반이 "0/0" 대신 빠진다. 재발급으로 죽은 옛 토큰의 출석은 세지 않는다. → Task 1 `summarizeAttendance` 시험, Task 3 `loadBulletinExtras` 시험.
5. **출석 숫자 칸에 빈칸·음수·글자·출석>전체**: 저장을 막고 그 칸에 안내를 보인다(조용히 0으로 바꾸지 않는다). → Task 1 `parseTally` 시험, Task 5 e2e.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `src/types.ts` (수정) | 새 타입·`DEFAULT_ORDER` |
| `src/lib/bulletin.ts` (새) | 순수 함수: 호수 +1, 순서표 표시용 채움, 출석 요약, 생일, 새 친구 판정, 숫자·줄 파싱, 안전한 URL·전화 |
| `firestore.rules` (수정) | `isMember()`, `members`·`memberInfo` 잠금, 주보 허용 키 |
| `src/data/content.ts` (수정) | 주보 정규화, 주보+members 한 배치 저장, members 읽기 |
| `src/data/info.ts` (새) | `settings/info`·`memberInfo/main` 읽기/쓰기 |
| `src/data/bulletinExtras.ts` (새) | "불러오기": Firestore에서 읽어 `src/lib/bulletin.ts`로 계산 |
| `src/data/students.ts` (수정) | `newcomer` 생성·재발급 복사 |
| `src/ui/BulletinView.tsx`·`.module.css` (수정) | 세 칸 순서표, 새 구역들 |
| `src/ui/InfoCard.tsx`·`.module.css` (새) | "중등부 안내" 카드 |
| `src/app/useMemberData.ts` (새) | 잠긴 문서 두 개를 세션 상태에 맞춰 불러오는 훅 |
| `src/student/BulletinTab.tsx`, `src/teacher/BulletinTab.tsx` (수정) | 새 자료 불러와 넘기기 |
| `src/admin/PairRows.tsx`·`.module.css` (새) | 두 칸짜리 줄 편집(예배위원·섬기는 분들·연락처 공용) |
| `src/admin/BulletinEditor.tsx` (수정), `src/admin/BulletinExtrasEditor.tsx` (새) | 주보 편집 새 칸 / 출석·새 친구·생일 편집 부분 |
| `src/admin/InfoAdmin.tsx`·`.module.css` (새), `sections.ts`·`AdminTab.tsx` (수정) | 관리 → 중등부 안내 |
| `src/admin/RosterAdmin.tsx` (수정) | "새 친구" 체크칸 |
| `scripts/shots.mjs`, `docs/design.md` (수정) | 화면 점검 시드, 디자인 기록 |

---

### Task 1: 타입과 순수 계산

**Files:**
- Modify: `src/types.ts`
- Create: `src/lib/bulletin.ts`
- Test: `tests/unit/bulletin-lib.test.ts`
- Modify: `tests/data/content.test.ts:107` (DEFAULT_ORDER 모양이 바뀌어도 통과하는지 확인만)

**Interfaces:**
- Produces (`src/types.ts`):
  ```ts
  export interface OrderItem { type: string; title: string; detail: string; standing?: boolean }
  export interface OpeningVerse { text: string; ref: string }
  export interface ServerRole { role: string; name: string }
  export interface Tally { present: number; total: number }
  export interface ClassCount extends Tally { classId: string; name: string }
  export interface AttendanceSummary { sunday: string; classes: ClassCount[]; students: Tally; teachers: Tally | null }
  export interface Bulletin { /* 기존 칸 + */ issue: string; leader: string; opening: OpeningVerse; nextServers: ServerRole[]; attendance: AttendanceSummary | null }
  export interface Birthday { name: string; date: string /* mm-dd */ }
  export interface BulletinMembers { newFriends: string[]; birthdays: Birthday[] }
  export interface ChurchInfo {
    motto: { title: string; subtitle: string; verse: string; ref: string };
    etiquette: string[];
    place: { name: string; address: string; mapUrl: string };
    churchPhone: string;
  }
  export interface MemberInfo { servants: { role: string; names: string }[]; contacts: { label: string; phone: string }[] }
  export interface Student { /* 기존 칸 + */ newcomer?: boolean }
  export const EMPTY_CHURCH_INFO: ChurchInfo; // 모든 글자 '' · etiquette []
  export const EMPTY_BULLETIN_EXTRAS: Pick<Bulletin, 'issue' | 'leader' | 'opening' | 'nextServers' | 'attendance'>; // '', '', {text:'',ref:''}, [], null
  ```
- Produces (`src/lib/bulletin.ts`):
  ```ts
  export function nextIssue(prev: string): string;
  export interface OrderRowView extends OrderItem { from?: 'scripture' | 'sermon' }
  export function displayOrder(order: OrderItem[], scripture: string, sermonTitle: string):
    { rows: OrderRowView[]; showsScripture: boolean; showsSermon: boolean };
  export function summarizeAttendance(sunday: string, students: WithId<Student>[], classes: WithId<ClassDoc>[], present: Map<string, boolean>): AttendanceSummary | null;
  export function birthdaysInMonth(students: WithId<Student>[], dateId: string): Birthday[];
  export function isFirstAttendance(records: Pick<AttendanceDoc, 'date' | 'present'>[], sunday: string): boolean;
  export function parseTally(present: string, total: string): Tally | null | 'invalid';
  export function parseLines(text: string): string[];
  export function parseBirthdayLines(text: string): Birthday[] | 'invalid';
  export function formatBirthdayLines(list: Birthday[]): string;
  export function safeHttpUrl(url: string): string | null;
  export function telHref(phone: string): string | null;
  ```

- [ ] **Step 1: 실패하는 시험 쓰기** — `tests/unit/bulletin-lib.test.ts`

```ts
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
```

- [ ] **Step 2: 실패 확인** — `npm run test:unit -- tests/unit/bulletin-lib.test.ts` → FAIL(모듈 없음).

- [ ] **Step 3: `src/types.ts` 고치기** — 위 Interfaces의 타입을 더하고, `DEFAULT_ORDER`를 시험이 요구하는 12줄로 바꾼다(`standing`은 true인 줄에만 넣는다). `EMPTY_CHURCH_INFO`, `EMPTY_BULLETIN_EXTRAS`를 내보낸다.

- [ ] **Step 4: `src/lib/bulletin.ts` 구현** — 순수 함수만(Firestore import 금지, 타입 import만). 정한 것:
  - `nextIssue`: 마지막 숫자 묶음을 +1, 원래 자릿수보다 짧아지지 않게 0 채움 유지(`09`→`10`). 숫자가 없으면 `''`.
  - `displayOrder`: 순서 이름 비교는 모든 공백을 지운 뒤 `'성경봉독'`/`'설교'`와 같은지. 같은 이름 줄이 여럿이면 **첫 줄만** 채운다. `type`·`title`·`detail`이 모두 빈 줄은 뺀다.
  - `summarizeAttendance`: `present.get(id) === true`만 출석. `teachers`는 항상 `null`.
  - `parseBirthdayLines`: 줄마다 `^(\d{2})-(\d{2})\s+(.+)$`, 월 01–12·일 01–31. 한 줄이라도 어긋나면 `'invalid'`.
  - `telHref`: 숫자가 하나도 없으면 `null`.

- [ ] **Step 5: 통과 확인** — `npm run test:unit` 전체 PASS, `npm run typecheck`는 이 시점에 `Bulletin`을 만드는 곳들(`BulletinEditor`의 `saveBulletin` 호출, 시험 시드)에서 실패할 수 있다 → 이 태스크에서는 **`Bulletin`의 새 칸 다섯 개를 일단 선택(`?`)으로 두지 말고**, 대신 `saveBulletin`의 인자 타입이 깨지는 곳(`src/admin/BulletinEditor.tsx`의 `save`)에 `...EMPTY_BULLETIN_EXTRAS`를 펼쳐 넣어 타입만 맞춘다(Task 5에서 진짜 값으로 바뀐다). `npm run typecheck` PASS.

- [ ] **Step 6: Commit** — `git commit -m "주보: 종이 주보 순서 기본값과 계산 함수(호수·순서표 채움·출석 요약·생일)"`

---

### Task 2: 보안 규칙 — 잠긴 문서와 주보 허용 키

**Files:**
- Modify: `firestore.rules`
- Test: `tests/rules/members.test.ts` (새), `tests/rules/content.test.ts` (추가)

**Interfaces:**
- Produces: 경로와 접근
  - `bulletins/{date}/members/{id}` — get: 선생님, 또는 활성 학생 세션이면서 부모 주보 `published == true`. 쓰기: 관리자 + `isDateId(date)` + `id == 'main'` + 키 `['newFriends','birthdays']`만. list 없음.
  - `memberInfo/{id}` — get: 선생님 또는 활성 학생 세션. 쓰기: 관리자 + `id == 'main'` + 키 `['servants','contacts']`만. list 없음.
  - `bulletins/{date}` create/update: 기존 조건 + 문서 키가 `['date','order','hymns','scripture','sermonTitle','published','updatedBy','updatedAt','issue','leader','opening','nextServers','attendance']` 안에만.
  - `settings/{id}`: `id == 'info'`일 때 키가 `['motto','etiquette','place','churchPhone']` 안에만(다른 settings 문서는 지금 그대로).

- [ ] **Step 1: 실패하는 시험 쓰기** — `tests/rules/members.test.ts`. `tests/rules/setup.ts`의 `useRulesEnv, seed, asUser, asStudent, asAnon, ADMIN, TEACHER_A, OUTSIDER, STUDENT_A_UID, TOKEN_A`를 쓴다. `DATE = '2026-11-15'`. 준비: 규칙을 끄고 `bulletins/${DATE}`(published:true), `bulletins/${DATE}/members/main = { newFriends: ['윤새봄'], birthdays: [] }`, `memberInfo/main = { servants: [], contacts: [{ label: '이승열 목사님', phone: '010-0000-0000' }] }`.

  시험 이름과 단언(각각 `assertSucceeds`/`assertFails`로 `getDoc`):
  - `'로그인 없는 사람은 members·memberInfo 를 못 읽는다'` — `asAnon`: 둘 다 fail.
  - `'세션 없는 익명 로그인도 못 읽는다'` — `asStudent(env, 'noSession')`: 둘 다 fail.
  - `'활성 학생 세션은 읽는다'` — `asStudent(env, STUDENT_A_UID)`: 둘 다 succeed.
  - `'링크가 죽은(비활성) 학생 세션은 못 읽는다'` — `students/${TOKEN_A}`를 `active:false`로 시드한 뒤 둘 다 fail.
  - `'임시저장 주보의 members 는 학생이 못 읽고 선생님은 읽는다'` — 주보를 `published:false`로 시드: 학생 fail, `asUser(env, TEACHER_A)` succeed. `memberInfo`는 학생 succeed 그대로.
  - `'초대 없는 Google 계정은 못 읽는다'` — `asUser(env, OUTSIDER)`: 둘 다 fail.
  - `'쓰기는 관리자만, main 문서에 정해진 키만'` — 관리자 `setDoc(members/main, {newFriends:[],birthdays:[]})` succeed; 교사 A fail; 학생 fail; 관리자 `members/other` fail; 관리자 `{newFriends:[],birthdays:[],offerings:['x']}` fail; 관리자 `memberInfo/main {servants:[],contacts:[]}` succeed; 관리자 `memberInfo/main {servants:[],contacts:[],x:1}` fail; 교사 A `memberInfo/main` fail.
  - `'members·memberInfo 는 목록 질의가 안 된다'` — 학생·교사 모두 `getDocs(collection(db,'memberInfo'))` fail, `getDocs(collection(db, 'bulletins', DATE, 'members'))` fail.

  `tests/rules/content.test.ts`에 추가:
  - `'주보 문서에는 정해진 칸만 — 이름·번호 칸은 거절'` — 관리자가 기존 `bulletin()`에 `issue:'2026-41호', leader:'정한결 선생님', opening:{text:'t',ref:'요 4:24'}, nextServers:[], attendance:null`을 더해 `setDoc` succeed; 같은 문서에 `newFriends:['x']`를 더하면 fail; `contacts:[]`를 더하면 fail; `offerings:[]`를 더하면 fail.
  - `'settings/info 에는 공개 칸만'` — 관리자 `setDoc(settings/info, {motto:{title:'',subtitle:'',verse:'',ref:''}, etiquette:[], place:{name:'',address:'',mapUrl:''}, churchPhone:''})` succeed; `contacts:[]`를 더하면 fail; `servants:[]`를 더하면 fail. 기존 `settings/bulletinTemplate` 시험은 그대로 통과해야 한다.

- [ ] **Step 2: 실패 확인** — `bash scripts/with-java.sh npx firebase emulators:exec --only firestore --project demo-jungdeungbu "vitest run --no-file-parallelism tests/rules/members.test.ts tests/rules/content.test.ts"` → 새 시험 FAIL.

- [ ] **Step 3: `firestore.rules` 구현** — 헬퍼 추가:

```
// 활성 학생 세션: 학생 링크를 연 기기(익명 로그인)이고 그 링크의 학생이 활성. 조회: 세션 1 + 학생 1.
function isMember() {
  return request.auth != null
    && exists(/databases/$(database)/documents/studentSessions/$(request.auth.uid))
    && studentOf(sessionOf(request.auth.uid).data.token).data.active == true;
}
```

  `members`는 `match /bulletins/{date}` 블록 **안**에 중첩해 둔다. 부모 주보 확인은 `get(/databases/$(database)/documents/bulletins/$(date)).data.published == true`. `isTeacher() ||`를 앞에 둬서 선생님은 주보 조회 없이 통과한다. 주석으로 "이름이 들어가는 정보는 여기(잠긴 문서)에만" 이유를 한 줄 남긴다.

- [ ] **Step 4: 통과 확인** — `npm run test:rules` 전체 PASS(기존 130 + 새 시험).

- [ ] **Step 5: Commit** — `git commit -m "규칙: 학생 세션·선생님만 읽는 잠긴 문서(members·memberInfo), 주보·안내 허용 칸"`

---

### Task 3: 데이터 계층

**Files:**
- Modify: `src/data/content.ts`, `src/data/students.ts`
- Create: `src/data/info.ts`, `src/data/bulletinExtras.ts`
- Test: `tests/data/content.test.ts`(추가), `tests/data/students.test.ts`(추가), `tests/data/info.test.ts`(새), `tests/data/bulletin-extras.test.ts`(새)

**Interfaces:**
- Consumes: Task 1 타입·`src/lib/bulletin.ts`, Task 2 규칙.
- Produces:
  ```ts
  // src/data/content.ts
  export function normalizeBulletin(raw: Partial<Bulletin> & Pick<Bulletin, 'date'>): Bulletin; // 없는 새 칸을 EMPTY_BULLETIN_EXTRAS 로 채움
  export async function getBulletin(db, dateId): Promise<Bulletin | null>;      // 정규화해서 돌려줌
  export async function listBulletins(db, max?): Promise<Bulletin[]>;            // 정규화
  export async function listAllBulletins(db): Promise<Bulletin[]>;               // 정규화
  export async function saveBulletin(db, uid, b: Omit<Bulletin,'updatedBy'|'updatedAt'>, members: BulletinMembers): Promise<void>; // 한 배치로 두 문서
  export async function getBulletinMembers(db, dateId): Promise<BulletinMembers | null>; // 없거나 permission-denied 면 null
  // src/data/info.ts
  export async function getChurchInfo(db): Promise<ChurchInfo>;                  // 없으면 EMPTY_CHURCH_INFO, 빠진 칸은 빈 값으로 채움
  export async function saveChurchInfo(db, info: ChurchInfo): Promise<void>;
  export async function getMemberInfo(db): Promise<MemberInfo | null>;           // 없거나 permission-denied 면 null
  export async function saveMemberInfo(db, info: MemberInfo): Promise<void>;
  // src/data/bulletinExtras.ts
  export const LOOKBACK_WEEKS = 8;
  export async function loadBulletinExtras(db, dateId: string): Promise<{ attendance: AttendanceSummary | null; members: BulletinMembers }>;
  // src/data/students.ts
  type NewStudent = { name: string; classId: string; birthday: string | null; newcomer?: boolean };
  ```

- [ ] **Step 1: 실패하는 시험 쓰기**

  `tests/data/content.test.ts`에 추가(기존 파일의 `env()`, `asUser`, `ADMIN` 등 그대로):
  - `'옛 모양 주보(새 칸 없음)도 빈 값으로 채워 읽는다'` — 규칙을 끄고 `{date, order:[{type:'설교',title:'t',detail:''}], hymns:[], scripture:'', sermonTitle:'', published:true, updatedBy:'x', updatedAt: <Timestamp>}`만 넣고 `getBulletin(asAnon)` → `issue === ''`, `leader === ''`, `opening` = `{text:'',ref:''}`, `nextServers` = `[]`, `attendance === null`.
  - `'saveBulletin 은 주보와 잠긴 문서를 함께 쓴다'` — 관리자로 `saveBulletin(db, ADMIN.uid, {...기존 주보, ...새 칸, published:true}, { newFriends:['윤새봄'], birthdays:[{name:'김하늘',date:'11-03'}] })` → `getBulletinMembers(asStudent(env(), STUDENT_A_UID), DATE)`가 그 값, `getBulletinMembers(asAnon(env()), DATE)`는 `null`, `getDoc(bulletins/DATE)` 데이터에 `newFriends` 키가 **없다**.
  - `'교사(관리자 아님)의 saveBulletin 은 두 문서 모두 쓰이지 않는다'` — reject, 그리고 규칙 끄고 읽었을 때 `members/main` 없음.
  - 기존 `getTemplate` 기본값 시험(107행)은 새 `DEFAULT_ORDER`로 통과.

  `tests/data/info.test.ts`:
  - `'안내가 없으면 빈 값'` — `getChurchInfo(asAnon)` → `EMPTY_CHURCH_INFO`와 같음; `getMemberInfo(asStudent(STUDENT_A_UID))` → `null`.
  - `'관리자가 저장한 것을 학생 세션은 읽고, 로그인 없는 사람은 공개 칸만'` — `saveChurchInfo`/`saveMemberInfo` 뒤: `getChurchInfo(asAnon)` 값 일치, `getMemberInfo(asAnon)` → `null`, `getMemberInfo(asStudent)` 값 일치.
  - `'빠진 칸이 있는 안내 문서도 읽힌다'` — 규칙 끄고 `settings/info = { churchPhone: '02-303-2501' }`만 → `getChurchInfo`의 `motto.title === ''`, `etiquette` = `[]`, `churchPhone` 그대로.

  `tests/data/students.test.ts`에 추가:
  - `'새 친구 표시는 켰을 때만 저장되고, 링크를 다시 만들어도 따라간다'` — `createStudent(admin, {name:'새봄',classId:'classA',birthday:null,newcomer:true})` → 문서 `newcomer === true`; `newcomer` 없이 만들면 문서에 키 없음; `reissueToken` 뒤 새 문서 `newcomer === true`.

  `tests/data/bulletin-extras.test.ts` (날짜: 주보 `2026-11-15`, 앞선 주일 `11-08`, `11-01`):
  - 준비(규칙 끔): `seedBase`의 학생 A(classA, birthday '03-15')·B(classB). 추가 학생 `NEW`(classA, `newcomer:true`, birthday `'11-20'`), `OLDNEW`(classB, `newcomer:true`), 죽은 토큰 `DEAD`(`active:false`). 출석: `11-01` — A present, OLDNEW present. `11-08` — A present, B absent(false), NEW present, OLDNEW present, DEAD present.
  - `'가장 최근 출석 주일로 반별 인원·새 친구·이번 달 생일을 채운다'` — `loadBulletinExtras(asUser(ADMIN), '2026-11-15')` →
    `attendance` = `{ sunday:'2026-11-08', classes:[{classId:'classA',name:'1학년 1반',present:2,total:2},{classId:'classB',name:'1학년 2반',present:1,total:2}], students:{present:3,total:4}, teachers:null }`;
    `members.newFriends` = `['NEW 학생 이름']`(OLDNEW는 11-01에 이미 나왔으므로 빠짐); `members.birthdays` = `[{name: NEW 이름, date:'11-20'}]`.
  - `'바로 앞 주일에 기록이 없으면 그 앞 주일을 쓴다'` — `11-08` 출석을 넣지 않은 준비 → `attendance.sunday === '2026-11-01'`.
  - `'8주 안에 출석 기록이 없으면 출석은 null, 새 친구는 빈 목록, 생일은 그대로'` — 출석 없이 → `attendance === null`, `newFriends` = `[]`, `birthdays`는 채워짐.
  - `'주보 날짜 당일·이후의 출석은 세지 않는다'` — `11-15`에만 출석이 있으면 `attendance === null`.

- [ ] **Step 2: 실패 확인** — `npm run test:rules` → 새 시험 FAIL.

- [ ] **Step 3: 구현**
  - `content.ts`: `normalizeBulletin`을 세 읽기 함수에 적용. `saveBulletin`은 `writeBatch`로 `bulletins/{date}`(`{...b, updatedBy, updatedAt: serverTimestamp()}`)와 `bulletins/{date}/members/main`(`members` 그대로)을 한 번에. `getBulletinMembers`는 `getBulletin`과 같은 `isPermissionDenied` → `null` 패턴.
  - `info.ts`: 경로 상수 `settings/info`, `memberInfo/main`. `getChurchInfo`는 `EMPTY_CHURCH_INFO` 위에 문서 값을 칸별로 덮어 빠진 칸을 메운다(`motto`·`place`는 안쪽 칸까지).
  - `students.ts`: `freshStudent`는 `data.newcomer === true`일 때만 `newcomer: true`를 넣는다. `reissueToken`의 `nextStudent`에도 같은 조건으로 복사.
  - `bulletinExtras.ts`: `listStudents(db)`, `listClasses`(`src/data/classes.ts`의 기존 목록 함수 이름을 확인해 쓴다), 그리고 `shiftDateId(dateId, -7 * n)`(n = 1…`LOOKBACK_WEEKS`)로 `listAttendanceByDate`를 **차례로** 불러 `summarizeAttendance`가 null이 아닌 첫 주일에서 멈춘다. 새 친구: 활성·`newcomer === true`·그 주일 출석인 학생마다 `listStudentAttendance` → `isFirstAttendance`. 이름순(`localeCompare(…, 'ko')`). 생일: `birthdaysInMonth(students, dateId)`.

- [ ] **Step 4: 통과 확인** — `npm run test:rules` 전체 PASS, `npm run typecheck` PASS(`BulletinEditor`의 `saveBulletin` 호출에 임시로 `{ newFriends: [], birthdays: [] }`를 넘겨 타입을 맞춘다 — Task 5에서 진짜 값으로).

- [ ] **Step 5: Commit** — `git commit -m "데이터: 주보 새 칸·잠긴 문서 저장/읽기, 중등부 안내, 출석·새 친구·생일 불러오기"`

---

### Task 4: 보는 화면 — 세 칸 순서표, 새 구역, 중등부 안내 카드

**Files:**
- Modify: `src/ui/BulletinView.tsx`, `src/ui/BulletinView.module.css`, `src/student/BulletinTab.tsx`, `src/teacher/BulletinTab.tsx`, `docs/design.md`
- Create: `src/ui/InfoCard.tsx`, `src/ui/InfoCard.module.css`, `src/app/useMemberData.ts`
- Test: `tests/e2e/paper-bulletin.spec.ts`(새), `tests/e2e/bulletin.spec.ts`(기존 단언 손보기), `tests/unit/design-guard.test.ts`(추가)

**Interfaces:**
- Consumes: Task 1 `displayOrder`, `safeHttpUrl`, `telHref`; Task 3 `getBulletinMembers`, `getChurchInfo`, `getMemberInfo`.
- Produces:
  ```ts
  // src/ui/BulletinView.tsx — props 에 추가
  members: BulletinMembers | null;   // 못 읽었거나 아직이면 null → 새 친구·생일 구역을 그리지 않는다
  // src/ui/InfoCard.tsx
  export function InfoCard(props: { info: ChurchInfo; members: MemberInfo | null }): JSX.Element | null; // 보일 것이 하나도 없으면 null
  // src/app/useMemberData.ts
  /** canRead 가 true 가 되면(또는 date 가 바뀌면) 잠긴 문서 둘을 읽는다. 실패·거절은 null 로 삼킨다(오류 화면 없음). */
  export function useMemberData(date: string, canRead: boolean): { bulletin: BulletinMembers | null; info: MemberInfo | null };
  ```

**화면 규칙(이 태스크가 정하는 것):**
- 주보 카드 구역 순서: 머리 → **주일예배** → 찬양 → 말씀 → 광고 → 다음 주 예배위원 → 지난 주 출석 → 새 친구 → 이번 달 생일. 비어 있는 구역은 그리지 않는다.
- 머리: `{월 일} 주일` + (있으면) 호수 `2026-41호`를 날짜 아래 `--muted` 작은 글씨로. 기존 "중등부 예배" 줄은 유지.
- 주일예배 구역: 제목 `주일예배`(h3, 고운바탕). 그 오른쪽/아래 `인도: {leader}`(없으면 생략). 여는 말씀은 `{opening.text} ({opening.ref})` 한 문단(둘 다 비면 생략, ref만 비면 괄호 생략). 순서표는 `<ol>`, 줄마다 **순서 | 내용 | 맡은 사람** 3칸 그리드(`grid-template-columns: minmax(5.5em, auto) 1fr auto`). 화면 폭 `max-width: 420px`에서는 순서·맡은 사람이 첫 줄, 내용이 둘째 줄 전체 폭으로 내려간다. 기존 점선 이음(`.leader`)은 없앤다.
- 일어서는 줄: 순서 이름 앞에 `<span aria-hidden="true">*</span>` + `<span class="sr-only">일어서서 </span>`. 하나라도 있으면 순서표 아래 `*표는 일어서서` 안내(`--muted`, `--text-sm`). `sr-only` 클래스는 `base.css`에 이미 있다.
- `displayOrder` 결과의 `from: 'sermon'` 줄 내용은 설교가 있고 `sermonHref`가 있으면 링크(`.sermonLink` 재사용). 말씀 구역: `showsScripture`면 본문 항목 생략, `showsSermon`이면 설교 항목 생략, 둘 다 생략되면 구역을 그리지 않는다.
- 다음 주 예배위원: 제목 `다음 주 예배위원`, `<dl>`로 `인도 — 한가람 학생`.
- 지난 주 출석: 제목 `지난 주 출석`, 한 줄 `{M.D} 주일 · 학생 33/55 · 교사 13/15`(교사는 `teachers`가 있을 때만), 아래 반별 `<ul>` `1-1 5/8`를 줄바꿈되는 칩 나열로. 숫자는 `var(--font-body)`, `font-variant-numeric: tabular-nums`.
- 새 친구: 제목 `새 친구`, 이름 나열 + `환영해요`는 붙이지 않는다(제목만). 이번 달 생일: 제목 `이번 달 생일`, `11.20 김하늘` 나열.
- `InfoCard`(Card `title="중등부 안내"`): 표어(제목 고운바탕 `--text-lg`, 부제, 말씀 본문 + ref) → 섬기는 분들(`members`가 있고 `servants`가 비지 않을 때, `<dl>` 역할/이름) → 예배 에티켓(`<ul>`) → 오시는 길(이름·주소, `safeHttpUrl(place.mapUrl)`이 있으면 `지도 열기` 링크 버튼 `target="_blank" rel="noopener noreferrer"`) → 연락처(교회 `churchPhone`, 그리고 `members.contacts`; 번호는 `telHref`가 있으면 `tel:` 링크, 없으면 글자만).
- 학생 `BulletinTab`: `useMemberData(date, sessionState === 'ready' || sessionState === 'teacher')`. `getChurchInfo`는 별도 `useLoader`(실패해도 주보는 보인다 — 실패 시 InfoCard만 생략). 배치: 주보(또는 빈 상태) → `InfoCard` → 지난 주보.
- 교사 `BulletinTab`: `useMemberData(date, true)`, 같은 배치.

- [ ] **Step 1: 실패하는 e2e 쓰기** — `tests/e2e/paper-bulletin.spec.ts`. `tests/e2e/bulletin.spec.ts`의 준비 방식(상수 `THIS_SUNDAY` 계산, `seed`, `openStudent`, 학생 토큰 시드)을 그대로 본뜬다. 시드: 반 1개, 학생 1명(토큰), 설교 문서(`title: '지금의 자리에서 감사'`), 게시 주보:

  ```ts
  {
    date: THIS_SUNDAY, published: true, updatedBy: 'seed', updatedAt: new Date(),
    issue: '2026-41호', leader: '정한결 선생님',
    opening: { text: '하나님은 영이시니 예배하는 자가 영과 진리로 예배할지니라', ref: '요 4:24' },
    order: [
      { type: '경배와 찬양', title: '', detail: '리조이스 찬양팀' },
      { type: '신앙고백', title: '사도신경', detail: '다함께', standing: true },
      { type: '성경봉독', title: '', detail: '다함께' },
      { type: '설교', title: '', detail: '이승열 목사님' },
    ],
    hymns: [], scripture: '누가복음 17장 11-19절', sermonTitle: '지금의 자리에서 감사',
    nextServers: [{ role: '인도', name: '한가람 학생' }, { role: '기도', name: '서다온 학생' }],
    attendance: { sunday: LAST_SUNDAY, classes: [{ classId: 'classA', name: '1-1', present: 5, total: 8 }],
      students: { present: 33, total: 55 }, teachers: { present: 13, total: 15 } },
  }
  ```
  `bulletins/{THIS_SUNDAY}/members/main = { newFriends: ['윤새봄', '문하람'], birthdays: [{ name: '김하늘', date: '11-20' }] }`,
  `settings/info = { motto: { title: '동행하는 자', subtitle: '하나님과 동행하며 내 이웃과 동행하는 사람', verse: '사람아 주께서 선한 것이 무엇임을 네게 보이셨나니', ref: '미가 6:8' }, etiquette: ['예배시작은 9:30이며, 9:15부터 찬양이 시작됩니다.'], place: { name: '명지대학교교회', address: '서울 서대문구', mapUrl: 'https://example.com/map' }, churchPhone: '02-303-2501' }`,
  `memberInfo/main = { servants: [{ role: '담당', names: '이승열 목사' }], contacts: [{ label: '이승열 목사님', phone: '010-0000-0000' }] }`.

  시험:
  - `'학생 주보: 종이 주보와 같은 순서표와 덧붙임이 보인다'` — 학생으로 주보 탭:
    - `getByRole('heading', { name: '주일예배' })` 보임, `getByText('2026-41호')`, `getByText('인도: 정한결 선생님')`, `getByText(/요 4:24/)`.
    - 순서표 `const order = page.getByRole('list', { name: '예배 순서' })`; `order.getByRole('listitem')` 4개; 둘째 줄에 `일어서서`(sr-only 글 포함)와 `사도신경`, `다함께`; `getByText('*표는 일어서서')` 보임.
    - 설교 줄 안에 `getByRole('link', { name: '지금의 자리에서 감사' })`; 성경봉독 줄에 `누가복음 17장 11-19절`.
    - `getByRole('heading', { name: '말씀' })` 개수 0(순서표에 다 나왔으므로).
    - `다음 주 예배위원` 제목과 `한가람 학생`; `지난 주 출석` 제목과 `학생 33/55`, `교사 13/15`, `1-1`, `5/8`.
    - `새 친구` 제목과 `윤새봄`; `이번 달 생일` 제목과 `김하늘`(세션 준비 뒤 나타나므로 기본 대기로 충분).
    - `getByRole('heading', { name: '중등부 안내' })`, `동행하는 자`, `담당`, `이승열 목사`, `getByRole('link', { name: '지도 열기' })`의 `href`가 `https://example.com/map`, `getByRole('link', { name: /02-303-2501/ })`의 `href`가 `tel:023032501`, `getByRole('link', { name: /010-0000-0000/ })` 보임.
  - `'세션을 못 만든 기기: 잠긴 구역만 빠지고 나머지는 보인다'` — 새 컨텍스트에서 `page.route('**/identitytoolkit.googleapis.com/**', r => r.abort())`와 에뮬레이터 Auth 주소(`**/127.0.0.1:9099/**`)도 abort한 뒤 학생 링크 열기 → 주보 탭: `주일예배`·`지난 주 출석`·`02-303-2501` 보임; `새 친구`·`이번 달 생일`·`010-0000-0000`·`섬기는 분들` 개수 0; 화면에 `문제가 생겼어요`류 오류 카드(`LoadError`)가 없다(`getByRole('button', { name: '다시 시도' })` 개수 0).
  - `'선생님 주보 탭에서도 같은 내용이 보인다'` — `loginAsEmu` 뒤 주보 탭: `새 친구`, `윤새봄`, `010-0000-0000` 보임.
  - `'비어 있는 덧붙임은 구역을 그리지 않는다'` — 새 칸이 전부 빈 값(`issue:''`, `leader:''`, `opening:{text:'',ref:''}`, `nextServers:[]`, `attendance:null`)이고 `members`·`settings/info`·`memberInfo`가 없는 주보: `다음 주 예배위원`·`지난 주 출석`·`새 친구`·`중등부 안내`·`인도:` 개수 0, `*표는 일어서서` 개수 0.

  `tests/unit/design-guard.test.ts`에 추가:
  ```ts
  test('순서표·출석 숫자는 프리텐다드, 중등부 안내 표어는 고운바탕', () => {
    expect(rule('src/ui/BulletinView.module.css', '.counts')).toContain('var(--font-body)');
    expect(rule('src/ui/InfoCard.module.css', '.motto')).toContain('var(--font-display)');
  });
  ```

- [ ] **Step 2: 실패 확인** — `npm run test:e2e -- tests/e2e/paper-bulletin.spec.ts` → FAIL.

- [ ] **Step 3: 구현** — 위 화면 규칙대로. 순서표 `<ol>`에 `aria-label="예배 순서"`. CSS 클래스 이름 `.counts`(출석 숫자 묶음), `.motto`(표어 제목)는 시험이 본다. `useMemberData`는 `canRead`가 false인 동안 두 값 모두 null, true가 되면 `Promise.all([getBulletinMembers(db, date), getMemberInfo(db)])`, 어떤 오류든 null(뒤늦게 도착한 옛 날짜 결과는 버린다).

- [ ] **Step 4: 기존 e2e 손보기** — `tests/e2e/bulletin.spec.ts`에서 순서표 모양·"말씀" 구역에 기대던 단언(74–83행 부근, 그리고 `설교` 줄 링크)을 새 모양에 맞게 고친다. 단언의 **뜻**(학생이 순서의 맡은 사람·찬양·설교 링크를 본다)은 유지하고, 지우기만 해서 통과시키지 않는다.

- [ ] **Step 5: 통과 확인** — `npm run test:e2e` 전체 PASS, `npm run test:unit` PASS, `npm run build` PASS.

- [ ] **Step 6: `docs/design.md`에 기록** — "주보" 절에 세 칸 순서표·일어서기 표시·출석 숫자 칩, 새 절 "중등부 안내 카드"를 각각 3–5줄로(쓰는 토큰 이름 포함).

- [ ] **Step 7: Commit** — `git commit -m "주보 화면: 종이 주보 같은 세 칸 순서표, 예배위원·출석·새 친구·생일, 중등부 안내 카드"`

---

### Task 5: 주보 편집 — 새 칸과 "불러오기"

**Files:**
- Modify: `src/admin/BulletinEditor.tsx`, `src/admin/BulletinEditor.module.css`
- Create: `src/admin/PairRows.tsx`, `src/admin/PairRows.module.css`, `src/admin/BulletinExtrasEditor.tsx`
- Test: `tests/e2e/bulletin-editor-extras.spec.ts`(새)

**Interfaces:**
- Consumes: Task 1 `nextIssue`, `parseTally`, `parseLines`, `parseBirthdayLines`, `formatBirthdayLines`; Task 3 `saveBulletin(…, members)`, `getBulletinMembers`, `loadBulletinExtras`.
- Produces:
  ```ts
  // src/admin/PairRows.tsx — 두 칸짜리 줄 목록(추가·삭제). Task 6도 쓴다.
  export interface Pair { k: string; a: string; b: string }
  export function PairRows(props: {
    legend: string;            // fieldset 이름(예: "다음 주 예배위원")
    labelA: string; labelB: string; // 칸 라벨(예: "맡은 일", "이름") — 줄 번호를 sr-only 로 앞에 붙인다
    addLabel: string;          // 예: "예배위원 추가"
    rows: Pair[]; onChange(rows: Pair[]): void;
    maxLengthA?: number; maxLengthB?: number;
    inputModeB?: 'text' | 'tel';
  }): JSX.Element;
  export const toPairs: <T>(list: T[], a: (x: T) => string, b: (x: T) => string) => Pair[];
  export const fromPairs: (rows: Pair[]) => { a: string; b: string }[]; // trim, 둘 다 빈 줄 제거
  ```

**편집 화면 규칙:**
- 폼(`Form`)에 추가: `issue`, `leader`, `openingText`, `openingRef`: string; 순서 줄에 `standing: boolean`; `servers: Pair[]`; `att: { sunday: string; classes: { classId: string; name: string; present: string; total: string }[]; teachersPresent: string; teachersTotal: string } | null`; `newFriends: string`(한 줄에 한 명); `birthdays: string`(한 줄에 `mm-dd 이름`).
- `isForm`(sessionStorage 복구 검사)을 새 모양에 맞춘다 — 옛 모양 복구본은 버려진다.
- 카드 배치: [예배 순서] 카드 맨 위에 `호수`·`인도자` 두 칸(나란히), `여는 말씀`·`말씀 출처`(예: 요 4:24) 두 칸 → 순서 줄(줄마다 `일어서서` 체크칸, 라벨은 `<span class="sr-only">{n}번 </span>일어서서`) → 기존 도구 버튼들. [찬양]·[말씀] 카드는 그대로, 단 [말씀] 카드의 설교 제목 힌트에 한 줄 추가: `순서표의 성경봉독·설교 줄을 비워 두면 여기 적은 본문과 제목이 그 줄에 보여요`. 새 카드 [다음 주 예배위원](`PairRows`, 라벨 `맡은 일`/`이름`, 추가 버튼 `예배위원 추가`). 새 카드 [지난 주 출석·새 친구·생일] = `BulletinExtrasEditor`.
- `BulletinExtrasEditor`: 맨 위 버튼 **`출석·새 친구·생일 불러오기`**(누르면 `loadBulletinExtras(db, date)` → 폼의 `att`(교사 칸은 기존 입력 유지)·`newFriends`·`birthdays`를 덮어쓰고 토스트 `{M.D} 주일 출석을 불러왔어요`, 출석이 null이면 토스트 `최근 8주 안에 출석 기록이 없어요`(생일은 채움)). `att`가 있으면: `센 주일`(읽기 전용 글자), 반별 줄(반 이름 + `출석`·`전체` 숫자칸 `inputMode="numeric"`), `교사 출석`·`교사 전체` 숫자칸, `출석 지우기` 버튼(→ `att = null`). `새 친구`(textarea, 힌트 `한 줄에 한 명. 학생 링크를 받은 사람만 볼 수 있어요`), `이번 달 생일`(textarea, 힌트 `한 줄에 "11-20 이름". 학생 링크를 받은 사람만 볼 수 있어요`).
- 새 주보(문서 없음)를 열 때: `issue` = `nextIssue(바로 앞 게시 주보의 issue)`(없으면 `''`), `servers`·`att`·`newFriends`·`birthdays`는 빈 값. **자동 불러오기는 하지 않는다**(버튼만).
- 기존 주보를 열 때: `getBulletinMembers(db, date)`도 함께 읽어 폼에 채운다(null이면 빈 값).
- 저장(`임시저장`·`게시` 공통): `parseTally`가 `'invalid'`인 칸(반별·교사)이나 `parseBirthdayLines`가 `'invalid'`이면 저장하지 않고 그 칸에 오류 글(숫자: `0 이상의 숫자로, 출석은 전체보다 많을 수 없어요` / 생일: `한 줄에 "11-20 이름"처럼 적어 주세요`)을 보이고 토스트 `고칠 곳이 있어요`. 반별 칸은 둘 다 비면 그 반을 0/0으로 저장하지 않고 **오류**로 본다(불러온 뒤 지웠다면 `출석 지우기`를 쓰라는 뜻). `students` 합계는 반별 값의 합으로 다시 계산해 저장한다.
- `지난 주보 복사`는 순서(일어서기 포함)·찬양만 가져온다(지금과 같음). `예배 순서 템플릿으로 저장`은 `standing`까지 저장.
- `toDoc`의 순서 줄: `standing`이 true일 때만 키를 넣는다(false는 생략 — 저장 안 한 변경 판정이 흔들리지 않게).

- [ ] **Step 1: 실패하는 e2e 쓰기** — `tests/e2e/bulletin-editor-extras.spec.ts`. 준비: 관리자 초대, 반 `classA`(`1-1`), 학생 3명(토큰 시드: `가`=기존, `나`=기존, `새봄`=`newcomer:true`, birthday는 이번 주보 달로 `MM-20` 계산), 지난 주일 출석(가 present, 나 absent, 새봄 present), 지난주 게시 주보(`issue: '2026-41호'`, 새 칸 빈 값).
  - `'새 주보: 종이 주보 순서와 다음 호수로 시작한다'` — 관리 → 주보 작성: `getByLabel('호수')` 값 `2026-42호`; `getByRole('list', { name: '예배 순서 줄' }).getByRole('listitem')` 12개; `getByLabel('2번 일어서서')` checked; `getByLabel('1번 일어서서')` not checked.
  - `'불러오기 → 고치기 → 게시하면 학생에게 보인다'` — `인도자`=`정한결 선생님`, `여는 말씀`·`말씀 출처` 입력, `예배위원 추가` → `1번 맡은 일`=`인도`, `1번 이름`=`한가람 학생`. `출석·새 친구·생일 불러오기` 클릭 → 토스트(`expectToast`) `주일 출석을 불러왔어요` 포함; `getByLabel('1-1 출석')` 값 `2`, `getByLabel('1-1 전체')` 값 `3`; `getByLabel('새 친구')` 값 `새봄`; `getByLabel('이번 달 생일')` 값에 `새봄` 포함. `교사 출석`=`13`, `교사 전체`=`15`. `게시` → `게시했어요`. 학생(`openStudent`) 주보 탭: `인도: 정한결 선생님`, `한가람 학생`, `학생 2/3`, `교사 13/15`, `새봄`(새 친구 구역).
  - `'숫자가 틀리면 저장하지 않고 그 칸에 알려 준다'` — 불러온 뒤 `1-1 출석`에 `9`(전체 3보다 큼) → `임시저장` → 토스트 `고칠 곳이 있어요`, `getByText('0 이상의 숫자로, 출석은 전체보다 많을 수 없어요')` 보임, 상태 배지가 `새 주보` 그대로(저장 안 됨). `2`로 고치고 `교사 출석`=`열` → 다시 막힘. `교사 출석`·`교사 전체`를 둘 다 비우면 `임시저장` 성공.
  - `'다시 열어도 그대로이고, 출석 지우기로 뺄 수 있다'` — 게시 뒤 새로고침 → `새 친구` 값 유지, `1-1 출석` 값 유지 → `출석 지우기` → `게시` → 학생 화면에 `지난 주 출석` 개수 0, `새 친구`는 그대로.

- [ ] **Step 2: 실패 확인** — `npm run test:e2e -- tests/e2e/bulletin-editor-extras.spec.ts` → FAIL.

- [ ] **Step 3: 구현** — 위 규칙대로. `BulletinEditor.tsx`가 이미 338줄이므로 출석·새 친구·생일 부분은 `BulletinExtrasEditor.tsx`로 뺀다(폼 조각과 `onChange`, 오류 표시용 `errors` prop을 받는 제어 컴포넌트). Task 1·3에서 임시로 넣은 `EMPTY_BULLETIN_EXTRAS`·빈 members 인자를 진짜 값으로 바꾼다.

- [ ] **Step 4: 통과 확인** — `npm run test:e2e` 전체 PASS(기존 `bulletin.spec.ts`의 편집 시험 포함), `npm run build` PASS.

- [ ] **Step 5: Commit** — `git commit -m "주보 작성: 호수·인도자·여는 말씀·일어서기·예배위원, 출석·새 친구·생일 불러오기"`

---

### Task 6: 관리 → 중등부 안내

**Files:**
- Create: `src/admin/InfoAdmin.tsx`, `src/admin/InfoAdmin.module.css`
- Modify: `src/admin/sections.ts`, `src/admin/AdminTab.tsx`
- Test: `tests/e2e/info-admin.spec.ts`(새), `tests/unit/router.test.ts` 또는 sections를 보는 기존 단위 시험이 있으면 그 목록 갱신

**Interfaces:**
- Consumes: Task 3 `getChurchInfo`, `saveChurchInfo`, `getMemberInfo`, `saveMemberInfo`; Task 5 `PairRows`, `toPairs`, `fromPairs`; Task 1 `parseLines`, `safeHttpUrl`.
- Produces: `AdminSectionKey`에 `'info'`; `ADMIN_SECTIONS`에 `{ key: 'info', label: '중등부 안내', desc: '표어·섬기는 분들·연락처를 고쳐요', icon: 'info', ready: true }`를 `announcements` 다음에. `export function InfoAdmin(): JSX.Element`.

**화면 규칙:**
- 한 화면에 카드 네 장, 맨 아래 `저장` 버튼 하나(바뀐 것이 없으면 비활성). 저장은 `saveChurchInfo`와 `saveMemberInfo`를 `Promise.all`로, 성공 토스트 `저장했어요`. 초안 복구(sessionStorage)는 만들지 않는다.
- [올해 표어] `표어`(예: 동행하는 자), `설명`, `말씀`(textarea), `말씀 출처`.
- [섬기는 분들] `PairRows` 라벨 `직분`/`이름`, 추가 `한 줄 추가`. 카드 아래 안내: `학생 링크를 받은 사람과 선생님만 볼 수 있어요`.
- [예배 에티켓] textarea(한 줄에 하나, 저장 때 `parseLines`).
- [오시는 길·연락처] `장소 이름`, `주소`, `지도 링크`(값이 있는데 `safeHttpUrl`이 null이면 저장을 막고 칸 오류 `https:// 로 시작하는 주소를 붙여 넣어 주세요`), `교회 전화`, 그리고 `PairRows` 라벨 `이름`/`전화번호`(`inputModeB="tel"`), 추가 `연락처 추가`, 안내 `개인 번호는 학생 링크를 받은 사람과 선생님만 볼 수 있어요`.

- [ ] **Step 1: 실패하는 e2e 쓰기** — `tests/e2e/info-admin.spec.ts`. 준비: 관리자, 반, 학생 토큰 1개, 이번 주 게시 주보(새 칸 빈 값).
  - `'관리자가 안내를 저장하면 학생 주보 탭에 보인다'` — 관리 탭 → `getByRole('link', { name: /^중등부 안내/ })` → `표어`=`동행하는 자`, `말씀 출처`=`미가 6:8`, 섬기는 분들 `한 줄 추가` → `1번 직분`=`담당`, `1번 이름`=`이승열 목사`, 예배 에티켓 두 줄, `교회 전화`=`02-303-2501`, `연락처 추가` → `1번 이름`(연락처 fieldset 안)=`이승열 목사님`, `1번 전화번호`=`010-0000-0000` → `저장` → `저장했어요`. 학생 주보 탭: `중등부 안내` 카드에 `동행하는 자`, `담당`, 에티켓 첫 줄, `02-303-2501`, `010-0000-0000`. 새로고침한 관리 화면에 값 유지.
  - `'지도 링크가 https 주소가 아니면 저장하지 않는다'` — `지도 링크`=`javascript:alert(1)` → `저장` → 칸 오류 글 보임, 토스트 `저장했어요` 없음; `https://example.com/map`로 고치면 저장되고 학생 화면에 `지도 열기`.
  - `'반 교사에게는 관리 메뉴가 없다'`는 기존 시험이 지키므로 추가하지 않는다.
  같은 이름 라벨이 여러 fieldset에 있으므로 로케이터는 `page.getByRole('group', { name: '섬기는 분들' })`처럼 legend로 범위를 좁힌다.

- [ ] **Step 2: 실패 확인** — `npm run test:e2e -- tests/e2e/info-admin.spec.ts` → FAIL.

- [ ] **Step 3: 구현** — `AdminTab.tsx`의 구역 분기에 `section.key === 'info' && <InfoAdmin />` 추가. 불러오기는 `useLoader`로 두 문서를 함께(관리자는 둘 다 읽힌다), 실패 시 `LoadError`.

- [ ] **Step 4: 통과 확인** — `npm run test:e2e` 전체 PASS, `npm run test:unit` PASS, `npm run build` PASS.

- [ ] **Step 5: Commit** — `git commit -m "관리: 중등부 안내(표어·섬기는 분들·에티켓·오시는 길·연락처)"`

---

### Task 7: 학생 명단 — "새 친구" 체크

**Files:**
- Modify: `src/admin/RosterAdmin.tsx`, `src/admin/RosterAdmin.module.css`
- Test: `tests/e2e/roster.spec.ts`(추가)

**Interfaces:**
- Consumes: Task 3 `createStudent(db, { …, newcomer })`, `updateStudent(db, token, { newcomer })`.
- Produces: 화면만.

**화면 규칙:**
- `학생 추가` 폼(`NewStudent`)에 체크칸 `새 친구`(기본 꺼짐) + 힌트 `처음 출석한 주의 주보에 새 친구로 올라가요`. 추가 뒤 체크는 다시 꺼진다.
- 학생 줄 수정 폼(`StudentRow`)에 같은 체크칸. 저장 때 켜면 `newcomer: true`, 끄면 `newcomer: false`를 `updateStudent`로(키 삭제 대신 false — 규칙·읽기 모두 `=== true`만 본다). "바뀐 것 없음" 판정에 포함.
- 명단 줄의 보조 글(meta)에 `newcomer`면 `새 친구`를 덧붙인다.
- 여러 명 한꺼번에 등록(`BulkRegister`)에는 넣지 않는다.
- 체크칸은 네이티브 `<input type="checkbox">` + `<label>`, 줄 높이 `--touch-min` 이상, 체크 색 `accent-color: var(--accent)`.

- [ ] **Step 1: 실패하는 e2e 쓰기** — `tests/e2e/roster.spec.ts`에 추가:
  - `'새 친구로 등록한 학생은 처음 출석한 주의 주보에 올라간다'` — 관리자: 학생 명단에서 `학생 추가` 폼에 이름 `새봄`, `새 친구` 체크 → 추가 → 명단 줄에 `새 친구` 글 보임. 규칙을 끄고(`seed`) 그 학생의 지난 주일 출석(`present:true`)을 넣는다(토큰은 `seed` 안에서 `getDocs(collection(db,'students'))`로 이름으로 찾는다). 주보 작성 → `출석·새 친구·생일 불러오기` → `getByLabel('새 친구')` 값 `새봄`.
  - `'새 친구 표시는 나중에 끄고 켤 수 있다'` — 줄을 열어 `새 친구` 체크 해제 → `저장` → 줄에서 `새 친구` 글 사라짐; 새로고침해도 유지.

- [ ] **Step 2: 실패 확인** — `npm run test:e2e -- tests/e2e/roster.spec.ts` → 새 시험 FAIL.

- [ ] **Step 3: 구현** — 위 규칙대로.

- [ ] **Step 4: 통과 확인** — `npm run test:e2e` 전체 PASS, `npm run build` PASS.

- [ ] **Step 5: Commit** — `git commit -m "학생 명단: 새 친구 표시(처음 출석한 주의 주보에 자동으로)"`

---

### Task 8: 화면 점검과 마무리

**Files:**
- Modify: `scripts/shots.mjs`

- [ ] **Step 1: `scripts/shots.mjs` 시드 갱신** — 주보 시드(43행 부근)를 실제 종이 주보(2026-41호) 내용으로: 12줄 순서(내용·맡은 사람 포함: 영광찬송 `주님 큰 영광받으소서`, 봉헌 `주를 향한 나의 사랑을` / `윤가온 서이든`, 성경봉독 내용 비움, 설교 내용 비움, 찬송 `주님 말씀 앞에 선`, 기도 `오세린 선생님`, 축복기도 `이승열 목사님`), `issue`, `leader: '정한결 선생님'`, `opening`, `scripture: '누가복음 17장 11-19절'`, `sermonTitle: '지금의 자리에서 감사'`, `nextServers`, `attendance`(반 7개: 1-1 5/8, 1-2 4/9, 1-3 4/7, 2-1 4/6, 2-2 4/6, 3-1 6/12, 3-2 6/7, 학생 33/55, 교사 13/15), `members/main`(새 친구 3명 — **가짜 이름**을 쓴다: 실제 학생 이름을 저장소에 넣지 않는다), `settings/info`(표어·에티켓 4줄 + 자기 점검 6줄·오시는 길·`02-303-2501`), `memberInfo/main`(섬기는 분들은 직분만 실제와 같게 하고 이름·번호는 가짜). 찍는 화면 목록에 학생 주보 탭 전체(긴 화면 fullPage), 관리 → 주보 작성, 관리 → 중등부 안내를 더한다.

- [ ] **Step 2: 화면 찍어 확인** — 터미널 둘에 `npm run emu`, `VITE_USE_EMULATOR=1 npm run dev`를 띄우고 `node scripts/shots.mjs <scratchpad>/shots-paper`. 확인할 것: 360px에서 순서표가 가로로 넘치지 않는다 / 긴 내용(`"지금의 자리에서 감사"`)이 맡은 사람과 겹치지 않는다 / 밝은·어두운 모드 모두 글자 대비 / 출석 칩 줄바꿈 / 중등부 안내 카드 간격 / 편집 화면의 체크칸·숫자칸이 44px 이상. 어긋난 곳은 CSS를 고치고 다시 찍는다. 끝나면 띄운 서버를 끈다.

- [ ] **Step 3: 전체 시험** — `npm run test:unit && npm run test:rules && npm run test:e2e && npm run build` 모두 PASS. 결과 숫자를 기록한다.

- [ ] **Step 4: 실패 조건 점검(스펙 "실패로 볼 것")** —
  - `grep -rn "offering\|헌금" src firestore.rules` → 예배 순서의 글자 `봉헌` 말고는 헌금 명단을 다루는 코드가 없다.
  - `firestore.rules`에서 `bulletins/{date}`·`settings/info` 허용 키에 `newFriends|birthdays|contacts|servants`가 없다.
  - `npm run test:unit -- tests/unit/design-guard.test.ts` PASS(모듈 CSS에 hex 없음).

- [ ] **Step 5: Commit** — `git commit -m "화면 점검 시드: 종이 주보(2026-41호) 내용으로"`
