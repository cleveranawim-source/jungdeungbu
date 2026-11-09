# 중등부 앱 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 명지대학교교회 중등부가 매주 쓰는 모바일 웹앱(주보·출석·설교 요약·광고·기도 제목·축하)을 GitHub Pages + Firebase로 만든다.

**Architecture:** Vite + React 정적 앱 하나가 해시 라우팅으로 학생(`#/s/{token}`)·교사(`#/t`) 화면을 나눈다. 데이터는 Firestore 한 곳이며 화면은 `src/data/*`의 함수를 통해서만 접근한다. 권한은 학생 = 추측 불가능한 문서 ID(토큰·반 ID)를 아는 것, 교사 = Google 로그인 UID와 `teachers/{uid}` 문서다.

**Tech Stack:** Node 26, Vite 8, React 19, TypeScript, firebase 13(modular), Vitest 5, @firebase/rules-unit-testing 6, Playwright 1.65, firebase-tools 15(`npx`), Firestore 에뮬레이터(Java 필요).

**Spec:** `docs/superpowers/specs/2026-11-09-jungdeungbu-app-design.md`

## Global Constraints

- 저장소 `~/Claude/jungdeungbu/`, GitHub `cleveranawim-source/jungdeungbu`, Pages base `/jungdeungbu/`.
- 해시 라우팅만 쓴다(`#/`, `#/s/{token}`, `#/t`). 서버 라우팅 없음.
- 토큰 = 128비트 난수의 base64url 22자. 정규식 `^[A-Za-z0-9_-]{22}$`. 반 ID도 같은 형식.
- 날짜 ID = 주일 `yyyy-mm-dd`. "이번 주" = 가장 가까운 주일(토요일 → 다음 날, 월~금 → 지난 주일, 일요일 → 당일).
- 생일 형식 `MM-DD`.
- 화면 컴포넌트는 `firebase/firestore`를 직접 import하지 않는다. `src/data/*`만 쓴다.
- 모든 `data/` 함수는 첫 인자로 `db: Firestore`(쓰기에 UID가 필요하면 `uid: string`)를 받는다. 규칙 시험이 `RulesTestContext.firestore()`를 그대로 넘기기 위해서다.
- 에뮬레이터 프로젝트 ID는 `demo-jungdeungbu`. 앱은 `VITE_USE_EMULATOR=1`일 때만 에뮬레이터에 붙고, 이때만 이메일 지정 로그인 버튼이 보인다.
- 한국어 UI. 따뜻하고 격려하는 톤. 정죄·강압 표현 금지.
- 공개 페이지는 `robots.txt` Disallow + `<meta name="robots" content="noindex">`.
- 잘못된 학생 링크 안내 문구는 "선생님께 링크를 다시 받아주세요" 하나. 없음/비활성 구분 금지.

## Review Focus

1. **토요일 밤 11시 59분과 일요일 0시 사이 날짜 경계**: `nearestSunday`가 로컬 시간 기준으로 토요일은 다음 날, 일요일은 당일을 돌려야 한다 → Task 2 시험에 포함.
2. **연속출석 중 결석 표시(`present: false`)가 끊김으로 계산되는지**: 결석 문서가 있어도 "없음"과 같게 취급해야 한다 → Task 3 시험에 포함.
3. **일괄 등록 붙여넣기의 빈 줄·앞뒤 공백·생일 생략**: 빈 줄은 건너뛰고 생일 없는 줄도 등록되어야 한다 → Task 4 시험에 포함.
4. **같은 날짜 출석을 두 교사가 거의 동시에 토글**: 마지막 쓰기가 이기되 `streak`이 그 학생 출석 기록 전체로 재계산되므로 어느 순서든 같은 값으로 수렴 → Task 7 시험에 포함.
5. **학생이 `hidden` 외 필드를 바꾸는 업데이트**: `hidden`만 허용되고 `text` 수정은 거부되어야 한다 → Task 6d 시험에 포함.

---

## 파일 구조

```
jungdeungbu/
├─ index.html                     noindex 메타, manifest 링크
├─ vite.config.ts                 base '/jungdeungbu/', vitest 설정
├─ firebase.json                  에뮬레이터(firestore 8080, auth 9099), rules·indexes 경로
├─ firestore.rules
├─ firestore.indexes.json         attendance.date 컬렉션 그룹 인덱스
├─ playwright.config.ts           webServer: vite dev + VITE_USE_EMULATOR=1
├─ public/  manifest.json, icons/, robots.txt
├─ src/
│  ├─ main.tsx
│  ├─ types.ts                    모든 문서 타입
│  ├─ lib/
│  │  ├─ dates.ts                 nearestSunday, toDateId, isDateId, isBirthdayWeek, weekContains
│  │  ├─ token.ts                 newToken, isToken
│  │  ├─ streak.ts                computeStreak
│  │  ├─ roster.ts                parseRoster
│  │  └─ firebase.ts              app/auth/db 초기화, 에뮬레이터 연결
│  ├─ data/
│  │  ├─ teachers.ts  classes.ts  students.ts  attendance.ts  content.ts  prayers.ts
│  ├─ app/
│  │  ├─ App.tsx                  해시 라우터 → Landing / StudentApp / TeacherApp
│  │  ├─ router.ts                parseHash(): Route
│  │  ├─ TabBar.tsx  Toast.tsx  OfflineBar.tsx
│  │  └─ useAuthRole.ts           로그인 상태 + Teacher 문서
│  ├─ student/  StudentApp.tsx HomeTab.tsx BulletinTab.tsx SermonTab.tsx PrayerTab.tsx MeTab.tsx
│  ├─ teacher/  TeacherApp.tsx AttendanceTab.tsx ClassTab.tsx TeacherPrayerTab.tsx
│  ├─ admin/    AdminTab.tsx BulletinEditor.tsx SermonEditor.tsx AnnouncementsAdmin.tsx
│  │            RosterAdmin.tsx ClassesTeachersAdmin.tsx StatsAdmin.tsx
│  └─ ui/       theme.css Card.tsx Button.tsx Field.tsx BulletinView.tsx AttendanceCalendar.tsx
├─ tests/
│  ├─ unit/      dates.test.ts token.test.ts streak.test.ts roster.test.ts
│  ├─ rules/     setup.ts teachers.test.ts students.test.ts attendance.test.ts content.test.ts prayers.test.ts
│  ├─ data/      attendance.test.ts students.test.ts  (에뮬레이터 상대 data 계층 시험)
│  └─ e2e/       seed.ts roster-to-student.spec.ts attendance.spec.ts prayer.spec.ts bulletin.spec.ts
└─ .github/workflows/pages.yml
```

---

### Task 1: 스캐폴드 · 에뮬레이터 · 시험 러너

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/app/App.tsx`(임시 "중등부" 텍스트), `firebase.json`, `.firebaserc`, `firestore.rules`(전부 거부), `firestore.indexes.json`, `tests/rules/setup.ts`, `tests/rules/smoke.test.ts`, `.gitignore`

**Interfaces:**
- Produces: npm 스크립트 `dev`, `build`, `test:unit`(vitest `tests/unit`), `test:rules`(`firebase emulators:exec --only firestore --project demo-jungdeungbu "vitest run tests/rules tests/data"`), `test:e2e`(`firebase emulators:exec --only firestore,auth --project demo-jungdeungbu "playwright test"`), `emu`(`firebase emulators:start --project demo-jungdeungbu`).
- Produces: `tests/rules/setup.ts` → `export async function makeEnv(): Promise<RulesTestEnvironment>` (`initializeTestEnvironment({ projectId: 'demo-jungdeungbu', firestore: { rules: readFileSync('firestore.rules','utf8'), host: '127.0.0.1', port: 8080 } })`), `export const ADMIN = { uid: 'admin1', email: 'admin@example.com' }`, `TEACHER_A = { uid: 'tA', email: 'a@example.com' }`(반 `classA` 담당), `TEACHER_B = { uid: 'tB', email: 'b@example.com' }`(반 `classB` 담당), `export function asUser(env, u)` → `env.authenticatedContext(u.uid, { email: u.email, email_verified: true }).firestore()`, `export function asAnon(env)`, `export async function seed(env, writer: (db) => Promise<void>)` → `withSecurityRulesDisabled`.
- Produces: `firestore.indexes.json`에 `attendance` 컬렉션 그룹 `date` ASC 단일 필드 인덱스(`fieldOverrides`, `queryScope: COLLECTION_GROUP`).

- [ ] **Step 1: Java 설치 확인·설치**

Run: `java -version` → 실패하면 `brew install --cask temurin` 후 다시 확인.
Expected: `openjdk version "21..."` 또는 그 이상.

- [ ] **Step 2: 프로젝트 생성**

`npm create vite@latest . -- --template react-ts` 뒤 `npm i firebase@13` · `npm i -D vitest@5 @firebase/rules-unit-testing@6 @playwright/test@1.65 firebase-tools@15 jsdom @testing-library/react`. `vite.config.ts`에 `base: '/jungdeungbu/'`와 vitest `test: { environment: 'node', include: ['tests/**/*.test.ts'] }`.

- [ ] **Step 3: 전부 거부 규칙과 스모크 시험 작성**

`firestore.rules`: `rules_version = '2'; ... match /{document=**} { allow read, write: if false; }`.
`tests/rules/smoke.test.ts`:
```ts
it('익명은 아무것도 못 읽는다', async () => {
  const env = await makeEnv();
  await assertFails(getDoc(doc(asAnon(env), 'bulletins/2026-11-15')));
  await env.cleanup();
});
```

- [ ] **Step 4: 실행**

Run: `npm run test:rules`
Expected: 에뮬레이터가 뜨고 1 passed.

- [ ] **Step 5: 빌드 확인 후 커밋**

Run: `npm run build` → `dist/index.html` 생성.
```bash
git add -A && git commit -m "스캐폴드: Vite+React, Firestore 에뮬레이터, 규칙 시험 러너"
```

---

### Task 2: 날짜 유틸 `lib/dates.ts`

**Files:**
- Create: `src/lib/dates.ts`, `tests/unit/dates.test.ts`

**Interfaces:**
- Produces:
  - `nearestSunday(now: Date): Date` — 로컬 시간 기준. 일 → 당일 0시, 토 → 다음 날, 월~금 → 지난 일요일.
  - `toDateId(d: Date): string` — `yyyy-mm-dd`(로컬).
  - `isDateId(s: string): boolean`
  - `addDays(d: Date, n: number): Date`
  - `weekContains(dateId: string, startDate: string, endDate: string): boolean` — 문자열 비교 포함 범위.
  - `isBirthdayWeek(birthday: string /*MM-DD*/, sundayId: string): boolean` — 그 주일 포함 ±3일 안에 생일이 있으면 true(연말·연초 넘김 포함).
  - `semesterStart(sundayId: string): string` — 3~8월이면 그 해 `03-01`, 9~2월이면 `09-01`(1·2월은 전년도 9월).

- [ ] **Step 1: 시험 작성**

```ts
test('토요일 23:59는 다음 날 주일', () => expect(toDateId(nearestSunday(new Date(2026,10,14,23,59)))).toBe('2026-11-15'));
test('일요일은 당일', () => expect(toDateId(nearestSunday(new Date(2026,10,15,10)))).toBe('2026-11-15'));
test('수요일은 지난 주일', () => expect(toDateId(nearestSunday(new Date(2026,10,18)))).toBe('2026-11-15'));
test('isDateId', () => { expect(isDateId('2026-11-15')).toBe(true); expect(isDateId('2026-1-5')).toBe(false); });
test('weekContains 양끝 포함', () => expect(weekContains('2026-11-15','2026-11-15','2026-11-15')).toBe(true));
test('생일 주간: 12-31 생일, 주일 01-03', () => expect(isBirthdayWeek('12-31','2027-01-03')).toBe(true));
test('생일 주간 아님', () => expect(isBirthdayWeek('03-10','2026-11-15')).toBe(false));
test('semesterStart 1월은 전년도 9월', () => expect(semesterStart('2027-01-10')).toBe('2026-09-01'));
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run tests/unit/dates.test.ts` → FAIL(모듈 없음)
- [ ] **Step 3: 구현** — 위 시그니처대로 `src/lib/dates.ts`.
- [ ] **Step 4: 통과 확인** — 같은 명령 → 8 passed
- [ ] **Step 5: 커밋** — `git commit -am "lib/dates: 주일·생일 주간·학기 계산"`

---

### Task 3: 토큰 · 연속출석 `lib/token.ts` `lib/streak.ts`

**Files:**
- Create: `src/lib/token.ts`, `src/lib/streak.ts`, `tests/unit/token.test.ts`, `tests/unit/streak.test.ts`

**Interfaces:**
- Produces:
  - `newToken(): string` — `crypto.getRandomValues(new Uint8Array(16))` → base64url 22자(패딩 제거).
  - `isToken(s: unknown): s is string` — `^[A-Za-z0-9_-]{22}$`.
  - `TOKEN_RE` 상수(규칙 파일과 같은 패턴).
  - `computeStreak(records: { date: string; present: boolean }[], asOf: string): { streak: number; lastPresent: string | null }` — `asOf`(주일 ID)부터 7일씩 거슬러 `present: true`가 이어지는 수. `asOf`에 출석이 없으면 0. `present: false` 문서는 없는 것과 같다. `lastPresent`는 가장 늦은 `present: true` 날짜.

- [ ] **Step 1: 시험 작성**

```ts
test('newToken 형식', () => { const t = newToken(); expect(t).toHaveLength(22); expect(isToken(t)).toBe(true); });
test('newToken 중복 없음(1000개)', () => expect(new Set(Array.from({length:1000}, newToken)).size).toBe(1000));
test('isToken 거부', () => { expect(isToken('abc')).toBe(false); expect(isToken('a'.repeat(22)+'=')).toBe(false); expect(isToken(null)).toBe(false); });

const r = (date: string, present = true) => ({ date, present });
test('3주 연속', () => expect(computeStreak([r('2026-11-01'), r('2026-11-08'), r('2026-11-15')], '2026-11-15')).toEqual({ streak: 3, lastPresent: '2026-11-15' }));
test('중간 결석 문서(present:false)는 끊김', () => expect(computeStreak([r('2026-11-01'), r('2026-11-08', false), r('2026-11-15')], '2026-11-15').streak).toBe(1));
test('이번 주 미출석이면 0, lastPresent는 유지', () => expect(computeStreak([r('2026-11-08')], '2026-11-15')).toEqual({ streak: 0, lastPresent: '2026-11-08' }));
test('기록 없음', () => expect(computeStreak([], '2026-11-15')).toEqual({ streak: 0, lastPresent: null }));
test('순서 뒤섞여도 같다', () => expect(computeStreak([r('2026-11-15'), r('2026-11-01'), r('2026-11-08')], '2026-11-15').streak).toBe(3));
```

- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/token.test.ts tests/unit/streak.test.ts` → FAIL
- [ ] **Step 3: 구현** — `token.ts`, `streak.ts`(`addDays`는 Task 2에서 import).
- [ ] **Step 4: 통과 확인** — 8 passed
- [ ] **Step 5: 커밋** — `git commit -am "lib/token, lib/streak"`

---

### Task 4: 일괄 등록 파서 `lib/roster.ts`

**Files:**
- Create: `src/lib/roster.ts`, `tests/unit/roster.test.ts`

**Interfaces:**
- Produces: `parseRoster(text: string, classNames: string[]): { rows: RosterRow[]; errors: { line: number; message: string }[] }`
  - `RosterRow = { name: string; className: string; birthday: string | null }`
  - 줄 단위. 구분자는 탭 또는 쉼표. 빈 줄·공백만인 줄은 건너뛴다. 각 칸 `trim()`.
  - 생일은 `MM-DD`, `M-D`, `MM/DD`, `MMDD`(4자리) 모두 받아 `MM-DD`로 정규화. 비어 있으면 `null`.
  - `className`이 `classNames`에 없으면 그 줄은 `errors`에 `"{line}줄: 반 '{x}'을(를) 찾을 수 없어요"`.
  - 이름이 비면 `"{line}줄: 이름이 없어요"`.

- [ ] **Step 1: 시험 작성**

```ts
const classes = ['1반', '2반'];
test('탭·쉼표·빈 줄·공백', () => {
  const { rows, errors } = parseRoster('김하늘\t1반\t03-05\n\n  이바다 , 2반 , 1207 \n', classes);
  expect(errors).toEqual([]);
  expect(rows).toEqual([{ name: '김하늘', className: '1반', birthday: '03-05' }, { name: '이바다', className: '2반', birthday: '12-07' }]);
});
test('생일 생략', () => expect(parseRoster('박별\t1반', classes).rows[0].birthday).toBeNull());
test('M/D 정규화', () => expect(parseRoster('박별\t1반\t3/5', classes).rows[0].birthday).toBe('03-05'));
test('없는 반', () => expect(parseRoster('박별\t3반', classes).errors[0]).toEqual({ line: 1, message: "1줄: 반 '3반'을(를) 찾을 수 없어요" }));
test('이름 없음', () => expect(parseRoster('\t1반', classes).errors[0].message).toBe('1줄: 이름이 없어요'));
```

- [ ] **Step 2: 실패 확인** → FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** → 5 passed
- [ ] **Step 5: 커밋** — `git commit -am "lib/roster: 일괄 등록 파서"`

---

### Task 5: 문서 타입 `src/types.ts`

**Files:**
- Create: `src/types.ts`

**Interfaces:**
- Produces (모두 export):
```ts
type Role = 'admin' | 'teacher';
interface Teacher { email: string; name: string; role: Role; classIds: string[] }
interface Invite  { name: string; role: Role; classIds: string[] }
interface ClassDoc { name: string; grade: number; order: number }
interface Student { name: string; classId: string; birthday: string | null; active: boolean; streak: number; lastPresent: string | null }
interface AttendanceDoc { date: string; present: boolean; by: string; at: Timestamp }
interface OrderItem { type: string; title: string; detail: string }
interface Bulletin { date: string; order: OrderItem[]; hymns: string[]; scripture: string; sermonTitle: string; published: boolean; updatedBy: string; updatedAt: Timestamp }
interface Sermon { date: string; title: string; scripture: string; summary: string; body: string; questions: string[] }
interface Announcement { title: string; body: string; startDate: string; endDate: string; pinned: boolean; createdAt: Timestamp }
interface Prayer { studentToken: string; studentName: string; text: string; hidden: boolean; createdAt: Timestamp; classId?: string }
interface BulletinTemplate { order: OrderItem[] }
type WithId<T> = T & { id: string }
```
- 기본 예배 순서 상수 `DEFAULT_ORDER: OrderItem[]` = 묵도 · 찬양 · 기도 · 성경 봉독 · 설교 · 헌금 · 광고 · 주기도문(각 `type`은 그 이름, `title`·`detail`은 빈 문자열).

- [ ] **Step 1: 작성 후 `npx tsc --noEmit` 통과**
- [ ] **Step 2: 커밋** — `git commit -am "types: Firestore 문서 타입"`

---

### Task 6a: 보안 규칙 — teachers · invites · classes · students

**Files:**
- Modify: `firestore.rules`
- Create: `tests/rules/teachers.test.ts`, `tests/rules/students.test.ts`

**Interfaces:**
- Produces(규칙 함수, 이후 Task에서 재사용): `isSignedIn()`, `teacherDoc()`, `isTeacher()`, `isAdmin()`, `teachesClass(classId)`(관리자 포함), `isToken(s)`, `isDateId(s)`, `studentOf(token)`.
- 규칙:
  - `teachers/{uid}`: get 본인 또는 admin · list admin · create `request.auth.uid == uid` && `email == request.auth.token.email` && `name·role·classIds`가 `invites/{request.auth.token.email}`과 같음 && 키 `hasOnly(['email','name','role','classIds'])` · update/delete admin.
  - `invites/{email}`: get 본인 이메일 또는 admin · list/write admin.
  - `classes/{classId}`: get 누구나 · list teacher · write admin.
  - `students/{token}`: get 누구나 · list teacher · create/delete admin · update admin, 또는 `teachesClass(resource.data.classId)`이고 `affectedKeys().hasOnly(['streak','lastPresent'])`.

- [ ] **Step 1: 시험 작성** (`seed`로 `invites/a@example.com` = teacher classA, `invites/admin@example.com` = admin, `teachers/admin1`, `teachers/tA`, `teachers/tB`, `classes/classA`, `classes/classB`, `students/{TOKEN_A}`(classA), `students/{TOKEN_B}`(classB)를 미리 넣는 `seedBase(env)` 헬퍼를 `setup.ts`에 추가)

teachers.test.ts:
```ts
test('초대된 이메일은 자기 teachers 문서를 만들 수 있다', ...)   // 새 uid 'tNew' + invites/new@example.com 시드 → assertSucceeds(setDoc(...일치 데이터))
test('초대 없는 계정은 만들 수 없다', ...)                       // invites 없음 → assertFails
test('초대 role이 teacher인데 admin으로 만들면 거부', ...)
test('다른 uid 문서는 만들 수 없다', ...)
test('교사는 다른 교사 문서를 못 읽고 admin은 읽는다', ...)
test('invites는 본인 이메일만 get, list는 admin만', ...)
```
students.test.ts:
```ts
test('익명도 토큰으로 학생 get 가능', ...)
test('익명·교사 아닌 로그인은 students list 불가, 교사는 가능', ...)
test('학생 생성·삭제는 admin만', ...)
test('반 교사는 자기 반 학생의 streak·lastPresent만 수정', ...)   // name 수정 → assertFails
test('반 교사는 다른 반 학생 streak 수정 불가', ...)
test('classes get 누구나, list 교사만, write admin만', ...)
```

- [ ] **Step 2: 실패 확인** — `npm run test:rules` → 새 시험 FAIL
- [ ] **Step 3: 규칙 구현**
- [ ] **Step 4: 통과 확인** → 전부 passed
- [ ] **Step 5: 커밋** — `git commit -am "rules: teachers·invites·classes·students"`

---

### Task 6b: 보안 규칙 — attendance

**Files:**
- Modify: `firestore.rules`
- Create: `tests/rules/attendance.test.ts`

**Interfaces:**
- 규칙:
  - `students/{token}/attendance/{date}`: read 누구나(경로에 토큰) · create/update `teachesClass(studentOf(token).data.classId)` && `isDateId(date)` && `request.resource.data.date == date` && `request.resource.data.by == request.auth.uid` && `present is bool` && `at == request.time` && 키 `hasOnly(['date','present','by','at'])` · delete `teachesClass(...)`.
  - `match /{path=**}/attendance/{date}`: read `isTeacher()`.

- [ ] **Step 1: 시험 작성**
```ts
test('반 교사는 자기 반 학생 출석 기록', ...)                    // tA → TOKEN_A 성공
test('다른 반 교사는 거부', ...)                                 // tB → TOKEN_A 실패
test('admin은 어느 반이든 가능', ...)
test('by가 본인 uid가 아니면 거부', ...)
test('date 필드와 문서 ID가 다르면 거부', ...)
test('익명은 토큰 경로로 출석 목록을 읽는다', ...)               // getDocs(collection(anon, `students/${TOKEN_A}/attendance`)) 성공
test('컬렉션 그룹 질의는 교사만', ...)                            // collectionGroup where date== : tA 성공, anon 실패
```
- [ ] **Step 2: 실패 확인** → FAIL
- [ ] **Step 3: 규칙 구현**
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `git commit -am "rules: attendance"`

---

### Task 6c: 보안 규칙 — bulletins · sermons · announcements · settings

**Files:**
- Modify: `firestore.rules`
- Create: `tests/rules/content.test.ts`

- 규칙: 네 컬렉션 모두 read 누구나 · write admin. `bulletins/{date}`·`sermons/{date}`는 `isDateId(date)` 추가.

- [ ] **Step 1: 시험 작성**
```ts
test('익명이 주보·설교·광고·settings를 읽는다', ...)
test('반 교사는 주보를 못 쓴다, admin은 쓴다', ...)
test('bulletins 문서 ID가 날짜 형식이 아니면 거부', ...)
```
- [ ] **Step 2–5**: 실패 확인 → 구현 → 통과 → `git commit -am "rules: 콘텐츠 컬렉션"`

---

### Task 6d: 보안 규칙 — prayers

**Files:**
- Modify: `firestore.rules`
- Create: `tests/rules/prayers.test.ts`

- 규칙 함수 `validPrayer(d, classId, extraKeys)`: `isToken(d.studentToken)` && `exists(students/d.studentToken)` && `studentOf(d.studentToken).data.classId == classId` && `d.studentName == studentOf(...).data.name` && `d.text is string && d.text.size() >= 1 && d.text.size() <= 500` && `d.hidden == false` && `d.createdAt == request.time` && 키 `hasOnly(['studentToken','studentName','text','hidden','createdAt'] + extraKeys)`.
  - `classes/{classId}/prayers/{id}`: read 누구나 · create `validPrayer(request.resource.data, classId, [])` · update `affectedKeys().hasOnly(['hidden'])` · delete teacher.
  - `prayers/{id}`: read teacher · create `validPrayer(d, d.classId, ['classId'])` · update 없음 · delete teacher.

- [ ] **Step 1: 시험 작성**
```ts
test('학생 토큰으로 자기 반 기도 생성', ...)
test('다른 반 경로에 생성하면 거부', ...)                        // TOKEN_A 로 classes/classB/prayers
test('이름이 학생 문서와 다르면 거부', ...)
test('500자 초과 거부', ...)
test('hidden 만 바꾸는 업데이트는 누구나, text 수정은 거부', ...)
test('교사 전용 prayers는 익명 읽기 거부, 교사 읽기 성공', ...)
test('교사 전용 prayers 생성 시 classId가 학생 반과 다르면 거부', ...)
```
- [ ] **Step 2–5**: 실패 확인 → 구현 → 통과 → `git commit -am "rules: prayers"`

---

### Task 7: Firebase 초기화와 `data/` 계층

**Files:**
- Create: `src/lib/firebase.ts`, `src/data/teachers.ts`, `src/data/classes.ts`, `src/data/students.ts`, `src/data/attendance.ts`, `src/data/content.ts`, `src/data/prayers.ts`, `tests/data/attendance.test.ts`, `tests/data/students.test.ts`, `tests/data/teachers.test.ts`, `.env.example`

**Interfaces:**
- `lib/firebase.ts`: `export const app`, `export const auth`, `export const db`. `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`. `import.meta.env.VITE_USE_EMULATOR === '1'`이면 `connectFirestoreEmulator(db,'127.0.0.1',8080)`·`connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true})`이고 projectId는 `demo-jungdeungbu`. `export const USING_EMULATOR: boolean`. Firebase 설정값은 `VITE_FIREBASE_*` 환경변수에서 읽는다(`.env.example`에 키 이름 나열, 값은 비움).
- `data/teachers.ts`:
  - `signInWithGoogle(auth): Promise<void>` — `signInWithPopup(auth, new GoogleAuthProvider())`.
  - `signInAsEmulatorUser(auth, email: string, name: string): Promise<void>` — `signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true, name })))`. `USING_EMULATOR`가 아니면 throw.
  - `ensureTeacher(db, user: { uid: string; email: string }): Promise<Teacher | null>` — `teachers/{uid}` 있으면 반환. 없으면 `invites/{email 소문자}` 읽어 있으면 `teachers/{uid}` 생성 후 반환, 없으면 `null`.
  - `listTeachers(db)`, `listInvites(db)`, `saveInvite(db, email, invite: Invite)`, `deleteInvite(db, email)`, `updateTeacher(db, uid, patch: Partial<Teacher>)`.
- `data/classes.ts`: `listClasses(db): Promise<WithId<ClassDoc>[]>`(order 정렬), `createClass(db, data: ClassDoc): Promise<string>`(ID = `newToken()`), `updateClass(db, id, patch)`.
- `data/students.ts`: `getStudent(db, token): Promise<Student | null>`, `listStudents(db, classId?: string): Promise<WithId<Student>[]>`(active만), `createStudent(db, data: { name; classId; birthday: string | null }): Promise<string>`(token 반환, `active: true, streak: 0, lastPresent: null`), `updateStudent(db, token, patch)`, `deactivateStudent(db, token)`, `reissueToken(db, token): Promise<string>`(새 문서 생성 + attendance 전부 복사 + 옛 문서 `active:false`, 한 배치), `bulkCreateStudents(db, rows: { name; classId; birthday }[]): Promise<string[]>`.
- `data/attendance.ts`:
  - `setAttendance(db, uid, token, dateId, present): Promise<{ streak: number; lastPresent: string | null }>` — 그 학생 attendance 전체 읽기 → 새 상태 반영한 배열로 `computeStreak(records, dateId)` → `writeBatch`: attendance 문서 `{ date, present, by: uid, at: serverTimestamp() }` + 학생 문서 `{ streak, lastPresent }`.
  - `listStudentAttendance(db, token): Promise<AttendanceDoc[]>`
  - `listAttendanceByDate(db, dateId): Promise<Map<string /*token*/, boolean>>` — 컬렉션 그룹 질의, 문서 경로의 부모 ID로 토큰 추출.
- `data/content.ts`: `getBulletin(db, dateId)`, `saveBulletin(db, uid, b: Omit<Bulletin,'updatedBy'|'updatedAt'>)`, `listBulletins(db, max = 20)`(published만, 날짜 내림차순; `listAllBulletins`는 admin용 전체), `getSermon`, `saveSermon`, `listSermons(db, max = 20)`, `listAnnouncements(db)`, `activeAnnouncements(db, dateId)`(`weekContains` 필터 후 pinned 우선), `saveAnnouncement(db, id | null, a)`, `deleteAnnouncement(db, id)`, `getTemplate(db): Promise<BulletinTemplate>`(없으면 `DEFAULT_ORDER`), `saveTemplate(db, t)`.
- `data/prayers.ts`: `addPrayer(db, p: { token; name; classId; text; visibility: 'class' | 'teachers' })`, `listClassPrayers(db, classId)`(hidden 제외, 최신순, 최대 50), `listTeacherPrayers(db, classIds: string[])`(`prayers` where classId in … 최신순), `hidePrayer(db, classId, id)`, `deletePrayer(db, path: string)`.

- [ ] **Step 1: 시험 작성** (`tests/data/*`는 `asUser(env, TEACHER_A)` 등으로 받은 Firestore 인스턴스를 data 함수에 그대로 넘긴다)

attendance.test.ts:
```ts
test('3주 연속 출석 뒤 streak 3', ...)                            // setAttendance 세 번 → getStudent(...).streak === 3
test('이번 주 취소하면 streak 0, lastPresent는 지난 주', ...)
test('두 교사가 순서 바꿔 토글해도 같은 streak', ...)             // admin이 11-08, tA가 11-15 / 반대 순서 → 같은 결과
test('listAttendanceByDate는 토큰→present 맵', ...)
test('다른 반 교사의 setAttendance는 permission-denied로 거부', ...)
```
students.test.ts:
```ts
test('createStudent는 22자 토큰을 돌려주고 getStudent로 읽힌다', ...)
test('reissueToken은 출석 기록을 옮기고 옛 토큰을 비활성화한다', ...)
test('bulkCreateStudents 3명', ...)
```
teachers.test.ts:
```ts
test('ensureTeacher: 초대된 새 uid는 teachers 문서가 생긴다', ...)
test('ensureTeacher: 초대 없으면 null', ...)
```

- [ ] **Step 2: 실패 확인** — `npm run test:rules` → FAIL
- [ ] **Step 3: 구현** — `lib/firebase.ts`는 시험에서 import되지 않게 data 함수는 `db`를 인자로만 받는다.
- [ ] **Step 4: 통과 확인**, `npx tsc --noEmit` 통과
- [ ] **Step 5: 커밋** — `git commit -am "data 계층: teachers·classes·students·attendance·content·prayers"`

---

### Task 8: 앱 셸 — 라우터 · 역할 · 탭 · 토스트 · 오프라인 띠 · 테마

**Files:**
- Create: `src/app/router.ts`, `src/app/App.tsx`(교체), `src/app/useAuthRole.ts`, `src/app/TabBar.tsx`, `src/app/Toast.tsx`, `src/app/OfflineBar.tsx`, `src/app/Landing.tsx`, `src/ui/theme.css`, `src/ui/Card.tsx`, `src/ui/Button.tsx`, `src/ui/Field.tsx`, `tests/unit/router.test.ts`

**Interfaces:**
- `router.ts`: `type Route = { kind: 'landing' } | { kind: 'student'; token: string; tab: StudentTab } | { kind: 'teacher'; tab: string } | { kind: 'invalid' }`, `parseHash(hash: string): Route`, `studentHref(token, tab?)`, `StudentTab = 'home' | 'bulletin' | 'sermon' | 'prayer' | 'me'`. 형식: `#/s/{token}/{tab?}`, `#/t/{tab?}`. 토큰이 `isToken` 실패면 `invalid`.
- `useAuthRole()`: `{ status: 'loading' | 'signedOut' | 'notInvited' | 'ready'; user: { uid; email; name } | null; teacher: Teacher | null; signIn(): Promise<void>; signInEmu(email, name): Promise<void>; signOut(): Promise<void> }`. `onAuthStateChanged` → `ensureTeacher`.
- `Toast.tsx`: `ToastProvider`, `useToast(): { show(message: string, kind?: 'info' | 'error'): void }`. 권한 오류용 헬퍼 `describeError(e: unknown): string` — `permission-denied` → "권한이 없어요. 담당 반이 맞는지 확인해 주세요", `unavailable` → "연결이 끊겼어요. 다시 연결되면 저장돼요", 그 외 `e.message`.
- `OfflineBar.tsx`: `navigator.onLine` + `online/offline` 이벤트. 문구 "오프라인이에요. 연결되면 저장됩니다".
- `TabBar.tsx`: `items: { key; label; icon }[]`, `current`, `onChange`. 하단 고정, 높이 56px, 터치 영역 최소 44px.
- `Landing.tsx`: 제목 "명지대학교교회 중등부", 버튼 "선생님 로그인"(→ `#/t`), 안내 "학생은 선생님이 보내준 링크로 들어와요". `USING_EMULATOR`면 이메일·이름 입력 + "에뮬레이터 로그인" 버튼.
- `theme.css`: CSS 변수 `--bg`, `--card`, `--ink`, `--muted`, `--accent`(따뜻한 주황 계열), `--accent-ink`, `--ok`, `--danger`; 다크 모드 `prefers-color-scheme` 대응; 본문 글꼴 시스템 산세리프(`-apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`); 기본 글자 크기 17px; 좌우 여백 16px; `max-width: 640px` 가운데 정렬.
- `App.tsx`: `parseHash` 결과로 `Landing` / `StudentApp`(Task 9) / `TeacherApp`(Task 10) 분기. `hashchange` 구독. `invalid` → 안내 화면 "선생님께 링크를 다시 받아주세요".

- [ ] **Step 1: 라우터 시험 작성**
```ts
test('학생 경로', () => expect(parseHash('#/s/' + T + '/me')).toEqual({ kind: 'student', token: T, tab: 'me' }));
test('탭 생략은 home', ...)
test('토큰 형식 틀리면 invalid', () => expect(parseHash('#/s/abc').kind).toBe('invalid'));
test('교사 경로 기본 탭 attendance', () => expect(parseHash('#/t')).toEqual({ kind: 'teacher', tab: 'attendance' }));
test('빈 해시는 landing', ...)
```
- [ ] **Step 2: 실패 확인** → FAIL
- [ ] **Step 3: 구현** — 라우터 → 셸 컴포넌트. `StudentApp`·`TeacherApp`는 "준비 중" 플레이스홀더로 두되 파일은 다음 Task에서 만든다(여기서는 `App.tsx`에서 조건부 import 자리만).
- [ ] **Step 4: 확인** — 라우터 시험 통과, `npm run build` 통과, `VITE_USE_EMULATOR=1 npm run dev`로 랜딩이 뜨고 에뮬레이터 로그인 버튼이 보이는지 playwright MCP로 확인.
- [ ] **Step 5: 커밋** — `git commit -am "앱 셸: 라우터·역할·탭·토스트·오프라인·테마"`

---

### Task 9: 관리자 — 반·교사 · 학생 명단

**Files:**
- Create: `src/teacher/TeacherApp.tsx`, `src/admin/AdminTab.tsx`, `src/admin/ClassesTeachersAdmin.tsx`, `src/admin/RosterAdmin.tsx`, `src/ui/ShareLink.tsx`, `tests/e2e/seed.ts`, `tests/e2e/roster.spec.ts`, `playwright.config.ts`

**Interfaces:**
- `TeacherApp.tsx`: `useAuthRole()` 상태별 화면 — `signedOut` → 로그인 버튼(에뮬레이터면 이메일 로그인 폼), `notInvited` → "등록되지 않은 계정입니다. 관리자에게 이메일을 알려주세요"(로그아웃 버튼), `ready` → 탭. 탭 목록: 출석 · 우리 반 · 기도 · 주보, admin이면 + 관리. 아직 없는 탭은 "준비 중".
- `AdminTab.tsx`: 메뉴 목록(주보 작성 · 설교 작성 · 광고 · 학생 명단 · 반·교사 · 출석 현황) → 각 화면. 없는 것은 "준비 중".
- `ClassesTeachersAdmin.tsx`: 반 목록(이름·학년·순서 편집, 추가), 교사 초대 목록(`invites`: 이메일·이름·역할·담당 반 체크, 추가·삭제), 등록된 교사 목록(`teachers`: 역할·담당 반 수정).
- `RosterAdmin.tsx`: 반 필터 → 학생 목록(이름·생일·연속출석). 학생 추가 폼(이름·반·생일). 학생 행 열기 → 반 이동, 비활성화(확인 후), 링크 재발급(확인 후), `ShareLink`. "일괄 등록" 섹션: textarea + `parseRoster` 미리보기(오류 줄 빨강) → "n명 등록".
- `ShareLink.tsx`: `props { token; name }`. 버튼 "링크 공유": `navigator.share` 있으면 `{ text: \`${name}아, 중등부 앱이야 → ${url}\` }`, 없으면 클립보드 복사 후 토스트 "링크를 복사했어요". url = `location.origin + location.pathname + studentHref(token)`.
- `tests/e2e/seed.ts`: `seedAdmin(email)` — rules-unit-testing `withSecurityRulesDisabled`로 `invites/{email}` admin 생성(`projectId: 'demo-jungdeungbu'`). `clear()` — `clearFirestoreData`.
- `playwright.config.ts`: `webServer: { command: 'VITE_USE_EMULATOR=1 npm run dev', port: 5173 }`, `use: { baseURL: 'http://localhost:5173/jungdeungbu/', viewport: { width: 390, height: 844 } }`. 헬퍼 `loginAsEmu(page, email, name)`: `#/t` → 이메일·이름 입력 → "에뮬레이터 로그인".

- [ ] **Step 1: e2e 시험 작성** (`roster.spec.ts`)
```ts
test('관리자가 반·학생을 만들고 학생 링크가 열린다', async ({ page }) => {
  await clear(); await seedAdmin('admin@example.com');
  await loginAsEmu(page, 'admin@example.com', '관리자');
  // 관리 → 반·교사 → 반 추가 '1반'
  // 관리 → 학생 명단 → 추가 '김하늘' 1반 03-05
  // 학생 행의 링크 복사 → 클립보드 읽기(권한 grant) → 새 페이지에서 그 주소로 이동
  await expect(page2.getByText('김하늘')).toBeVisible();
  await expect(page2.getByRole('tab', { name: '나' })).toBeVisible();
});
test('초대 없는 계정은 안내 화면', ...)   // loginAsEmu('nobody@example.com') → '등록되지 않은 계정입니다' 보임
```
- [ ] **Step 2: 실패 확인** — `npm run test:e2e` → FAIL
- [ ] **Step 3: 구현** — `StudentApp`은 Task 10에서 만들므로 이 Task에서는 학생 이름과 탭 바(빈 탭 내용)만 보이는 최소 `StudentApp`을 `src/student/StudentApp.tsx`에 만든다(토큰으로 `getStudent`, 없거나 `active:false`면 안내 문구).
- [ ] **Step 4: 통과 확인** — e2e 2 passed. 화면은 playwright MCP로 한 번 눈으로 확인.
- [ ] **Step 5: 커밋** — `git commit -am "관리자: 반·교사·학생 명단, 학생 링크 공유, e2e 기반"`

---

### Task 10: 학생 화면

**Files:**
- Modify: `src/student/StudentApp.tsx`
- Create: `src/student/HomeTab.tsx`, `BulletinTab.tsx`, `SermonTab.tsx`, `PrayerTab.tsx`, `MeTab.tsx`, `src/ui/BulletinView.tsx`, `src/ui/AttendanceCalendar.tsx`, `src/ui/CelebrationBanner.tsx`

**Interfaces:**
- `StudentApp` props `{ token: string; tab: StudentTab }`. 학생 문서를 한 번 읽어 하위 탭에 `student`·`token` 전달. 하단 탭 라벨: 홈 · 주보 · 말씀 · 기도 · 나.
- `BulletinView.tsx`: `props { bulletin: Bulletin; sermon: Sermon | null; announcements: WithId<Announcement>[] }` — 예배 순서 → 찬양 → 본문 → 설교 제목(설교 있으면 링크) → 광고. 학생·교사 모두 재사용.
- `AttendanceCalendar.tsx`: `props { records: AttendanceDoc[]; from: string; to: string }` — 주일만 한 줄에 표시(날짜·출석 ○·결석/미기록 ·). 학기 범위 `semesterStart(sunday)`~이번 주일.
- `CelebrationBanner.tsx`: `props { student: Student; sundayId: string }` — `isBirthdayWeek` → "🎂 {name}, 생일 축하해!"; `streak`이 4의 배수이고 ≥4 → "🔥 {streak}주 연속 출석! 꾸준함이 멋져". 둘 다면 둘 다. 없으면 null.
- `HomeTab`: 이번 주 주보 요약 카드(날짜·설교 제목·본문, 주보 없으면 "이번 주 주보가 아직 없어요"), `CelebrationBanner`, 이번 주 광고 목록.
- `BulletinTab`: 이번 주 `BulletinView` + "지난 주보" 날짜 목록(`listBulletins`) → 선택 시 그 날짜로.
- `SermonTab`: `listSermons` 목록 → 상세(제목·본문·요약·`body`·적용 질문).
- `PrayerTab`: `listClassPrayers(classId)` 목록(이름·내용·내 글이면 "숨기기"), 작성 폼(textarea 500자 카운터, 라디오 "우리 반" / "선생님만", 버튼 "올리기"). 선생님만 → 성공 토스트 "선생님께 전했어요". 내 글 판정은 `studentToken === token`.
- `MeTab`: 이름·반 이름, `AttendanceCalendar`, "연속 출석 {streak}주", 생일.

- [ ] **Step 1: e2e 시험 보강** — `roster.spec.ts`에 이어, 시드로 주보·설교·광고를 넣고 학생 링크에서 홈 카드·주보 탭·말씀 탭에 그 내용이 보이는지 `bulletin.spec.ts`에 작성.
```ts
test('학생이 이번 주 주보·설교·광고를 본다', ...)   // 시드: bulletins/{thisSunday} published, sermons/{thisSunday}, announcements 1건 활성
test('주보 없는 주 안내', ...)
```
- [ ] **Step 2: 실패 확인** → FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — e2e 통과. playwright MCP로 5개 탭을 390px 폭에서 눈으로 확인.
- [ ] **Step 5: 커밋** — `git commit -am "학생 화면: 홈·주보·말씀·기도·나"`

---

### Task 11: 교사 — 출석 · 우리 반 · 주보

**Files:**
- Create: `src/teacher/AttendanceTab.tsx`, `src/teacher/ClassTab.tsx`, `src/teacher/BulletinTab.tsx`(학생 `BulletinView` 재사용), `tests/e2e/attendance.spec.ts`
- Modify: `src/teacher/TeacherApp.tsx`

**Interfaces:**
- `AttendanceTab`: 상단 날짜 선택(기본 `nearestSunday(now)`, ◀ ▶로 7일 이동), 반 선택(교사의 `classIds`, admin은 전체 반). 학생 버튼 그리드(이름 크게, 출석이면 accent 배경 + ✓). 터치 → `setAttendance(db, uid, token, dateId, !present)` → 성공 시 즉시 반영, 실패 시 `describeError` 토스트와 원상 복구. 상단 "출석 n / m".
- `ClassTab`: 반 선택 → 학생 목록(이름 · "{streak}주 연속" · 생일 주간 🎂). 학생 선택 → `AttendanceCalendar` + `ShareLink`.
- `TeacherApp`: 탭 연결.

- [ ] **Step 1: e2e 시험 작성**
```ts
test('교사가 출석을 찍으면 학생 "나" 탭에 보인다', async ({ page, context }) => {
  // 시드: invites/admin, classA '1반', students/{T} 김하늘 classA
  // 관리자 로그인 → 출석 탭 → '김하늘' 터치 → '출석 1 / 1'
  // 학생 링크 → 나 탭 → '연속 출석 1주', 달력에 오늘 주일 ○
  // 다시 터치(취소) → '출석 0 / 1'
});
```
- [ ] **Step 2: 실패 확인** → FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — e2e 통과 + playwright MCP로 출석 그리드 확인.
- [ ] **Step 5: 커밋** — `git commit -am "교사: 출석·우리 반·주보"`

---

### Task 12: 기도 제목 — 교사 탭과 학생 흐름 e2e

**Files:**
- Create: `src/teacher/TeacherPrayerTab.tsx`, `tests/e2e/prayer.spec.ts`
- Modify: `src/teacher/TeacherApp.tsx`

**Interfaces:**
- `TeacherPrayerTab`: 반 선택 → 두 섹션 "우리 반에 나눈 기도"(`listClassPrayers`, hidden 포함해 흐리게 표시) · "선생님께만"(`listTeacherPrayers([classId])`). 각 글 "삭제"(확인 후 `deletePrayer`).

- [ ] **Step 1: e2e 시험 작성**
```ts
test('학생이 올린 기도 제목이 교사 탭에 보인다', ...)        // 학생 '우리 반' 글 → 목록에 보임 → 교사 기도 탭 '우리 반에 나눈 기도'에 보임
test('선생님만 글은 학생 목록에 없고 교사에게만 보인다', ...)  // 토스트 '선생님께 전했어요' 확인
test('학생이 내 글 숨기기', ...)
```
- [ ] **Step 2–5**: 실패 확인 → 구현 → 통과 → `git commit -am "기도 제목: 교사 탭, e2e"`

---

### Task 13: 관리자 — 주보 · 설교 · 광고 편집

**Files:**
- Create: `src/admin/BulletinEditor.tsx`, `src/admin/SermonEditor.tsx`, `src/admin/AnnouncementsAdmin.tsx`
- Modify: `src/admin/AdminTab.tsx`, `tests/e2e/bulletin.spec.ts`

**Interfaces:**
- `BulletinEditor`: 날짜 선택(기본 이번 주일, 주일만) → 기존 주보 로드 또는 `getTemplate` 순서로 새로 시작. 예배 순서 행 편집(type·title·detail, 위/아래/삭제/추가), 찬양 목록, 본문, 설교 제목(같은 날짜 설교가 있으면 "설교 제목 가져오기"). 버튼 "임시저장"(`published:false`), "게시"(`published:true`), "지난 주보 복사"(가장 최근 published 주보의 order·hymns 복사). "○○님이 n분 전 저장" 표시(`updatedBy`·`updatedAt`). "예배 순서 템플릿으로 저장" → `saveTemplate`.
- `SermonEditor`: 날짜·제목·본문·요약(textarea)·`body`(textarea)·적용 질문(줄 단위). 저장.
- `AnnouncementsAdmin`: 목록(시작·종료·고정 표시) · 추가/수정 폼(title, body, startDate, endDate 기본 = 이번 주일, pinned) · 삭제.

- [ ] **Step 1: e2e 시험 추가** (`bulletin.spec.ts`)
```ts
test('관리자가 주보를 게시하면 학생 홈에 보인다', ...)   // 설교 제목 '함께 걷는 길' 입력 → 게시 → 학생 링크 홈 카드에 보임
test('임시저장 주보는 학생에게 안 보인다', ...)
test('광고 종료일이 지나면 주보 광고란에 없다', ...)
```
- [ ] **Step 2–5**: 실패 확인 → 구현 → 통과 → `git commit -am "관리자: 주보·설교·광고 편집"`

---

### Task 14: 관리자 — 출석 현황 · CSV

**Files:**
- Create: `src/admin/StatsAdmin.tsx`, `src/lib/csv.ts`, `tests/unit/csv.test.ts`

**Interfaces:**
- `lib/csv.ts`: `attendanceCsv(students: WithId<Student>[], classes: WithId<ClassDoc>[], byDate: Map<string /*dateId*/, Map<string /*token*/, boolean>>, dates: string[]): string` — 헤더 `반,이름,{date...},출석수`, UTF-8 BOM 포함, 쉼표·줄바꿈 들어간 값은 따옴표.
- `StatsAdmin`: 기간(시작·끝 주일, 기본 학기 시작~이번 주일) → 주일마다 `listAttendanceByDate` → 표: 날짜별 전체 출석률, 반별 숫자. "CSV 내보내기" → Blob 다운로드 `출석_{from}_{to}.csv`.

- [ ] **Step 1: 시험 작성**
```ts
test('CSV 헤더·BOM·출석수', () => { const s = attendanceCsv([...1명], [...1반], byDate, ['2026-11-08','2026-11-15']); expect(s.startsWith('﻿반,이름,2026-11-08,2026-11-15,출석수')).toBe(true); expect(s.split('\n')[1]).toBe('1반,김하늘,O,,1'); });
test('이름에 쉼표가 있으면 따옴표', ...)
```
- [ ] **Step 2–5**: 실패 확인 → 구현 → 통과 → `git commit -am "관리자: 출석 현황·CSV"`

---

### Task 15: PWA 메타 · robots · GitHub Actions · README

**Files:**
- Create: `public/manifest.json`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/robots.txt`, `.github/workflows/pages.yml`, `README.md`
- Modify: `index.html`

- `manifest.json`: `name` "명지대학교교회 중등부", `short_name` "중등부", `start_url` "./", `display` "standalone", `theme_color` = `--accent` 값, 아이콘 2개(단색 배경에 십자가·"중" 글자 정도의 단순 SVG를 PNG로 렌더).
- `index.html`: `<meta name="robots" content="noindex, nofollow">`, `<link rel="manifest">`, `apple-mobile-web-app-capable`, `viewport-fit=cover`.
- `robots.txt`: `User-agent: *` / `Disallow: /`.
- `pages.yml`: `main` 푸시 → `actions/checkout` → `actions/setup-node@v4`(node 22) → `npm ci` → `npm run build`(환경변수 `VITE_FIREBASE_*`는 리포지토리 Secrets에서) → `actions/upload-pages-artifact` → `actions/deploy-pages`.
- `README.md`: 사용 설명(교사 로그인·학생 링크), 초기 1회 작업(Firebase 프로젝트 생성, Firestore 서울 리전, Google 로그인 공급자, 승인 도메인 `cleveranawim-source.github.io`, 콘솔에서 `invites/{이메일}` `{ name, role: 'admin', classIds: [] }` 생성, `.env` 또는 Secrets에 `VITE_FIREBASE_*`, `npx firebase deploy --only firestore`), 개발 명령(`npm run emu`, `test:unit`, `test:rules`, `test:e2e`).

- [ ] **Step 1: 작성**
- [ ] **Step 2: 확인** — `npm run build` 뒤 `dist/manifest.json`·`dist/robots.txt` 존재, `grep noindex dist/index.html`.
- [ ] **Step 3: 커밋** — `git commit -am "PWA 메타·robots·Pages 배포·README"`

---

### Task 16: 실제 Firebase 연결과 첫 배포 (이승열 P와 함께)

**Files:** 없음(설정·배포만)

- [ ] **Step 1: Firebase 프로젝트** — 이승열 P가 콘솔(idreamstill)에서 프로젝트 생성 → Firestore(asia-northeast3) → Authentication Google 공급자 → 승인 도메인 추가 → 웹 앱 등록해 설정값 받기. 이 세션에서는 `! npx firebase login`으로 CLI 로그인.
- [ ] **Step 2: 규칙·인덱스 배포** — `.firebaserc`에 실제 프로젝트 ID 추가(`default`), `npx firebase deploy --only firestore`. Expected: rules·indexes released.
- [ ] **Step 3: 첫 관리자 초대** — 콘솔에서 `invites/{이메일}` 문서 생성.
- [ ] **Step 4: GitHub 저장소·Secrets** — `gh repo create cleveranawim-source/jungdeungbu --public --source . --push`, Pages 소스 = GitHub Actions, Secrets에 `VITE_FIREBASE_*` 6개.
- [ ] **Step 5: 배포 확인** — Actions 성공 → `https://cleveranawim-source.github.io/jungdeungbu/#/t` Google 로그인 → 관리 탭 열림. 반·학생 1명 등록 → 학생 링크를 본인 폰 카톡으로 보내 열어본다(수동 확인 항목).
- [ ] **Step 6: 커밋** — `.firebaserc` 변경 커밋·푸시.
