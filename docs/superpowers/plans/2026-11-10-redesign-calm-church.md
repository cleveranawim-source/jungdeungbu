# 디자인 재작업 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 앱의 시각 디자인을 "차분하고 단정한 교회"(고운바탕+프리텐다드, 남색·아이보리·금색, 부드러운 카드)로 바꾼다. 기능·문구·데이터는 그대로.

**Architecture:** 색·글꼴·모서리·그림자는 이미 `src/ui/theme.css` 토큰을 거쳐 쓰이므로, 토큰 값을 바꾸고 햇살 장식을 걷어낸 뒤, 토큰 의미가 바뀐 곳(특히 `--accent`가 밝은 귤색 → 진한 남색)을 쓰는 부품을 화면별로 점검한다. 대비·금지어는 단위 시험으로 고정한다.

**Tech Stack:** Vite 8 · React 19 · TS · CSS Modules · Vitest 5 · Playwright 1.65(스크린샷) · `pretendard@1.3.9` · `@fontsource/gowun-batang@5.3.0`

**Spec:** `docs/superpowers/specs/2026-11-10-redesign-calm-church-design.md`

## Global Constraints

- 화면 구성·기능·문구·접근성 이름(aria-label, 버튼 글자)·라우팅·데이터·`firestore.rules`는 바꾸지 않는다.
- 색은 `src/ui/theme.css` 토큰으로만. `*.module.css`에 hex 금지(기존 원칙 유지).
- 글꼴은 앱에 포함(외부 글꼴 서버 금지). Jua 제거.
- 토큰 이름은 유지하고 값만 바꾼다. 추가는 `--gold`, `--gold-text`. 삭제는 `--sun`, `--sun-halo`, `--dur-slow`.
- 대비: 본문 글자 4.5:1 이상, `--line-strong`·`--gold`(장식) 3:1 이상 — 밝은·어두운 모드 모두.
- 디자인 작업 때 `frontend-design` 스킬과 `~/.claude/skills/ui-ux-pro-max/scripts/search.py`(필요한 결정마다 `--domain ux|color|typography`)를 쓴다.
- 커밋 트레일러: `Co-Authored-By: <실제 작성 모델> <noreply@anthropic.com>`.

## Review Focus

1. **`--accent`가 연한 면으로 쓰이던 곳**: 귤색일 때 "밝은 강조 면"으로 쓰인 자리가 남색이 되면 화면이 무겁고 글자가 안 보일 수 있다 → Task 3 전 화면 스크린샷에서 확인, `--accent-soft`로 바꿀 곳을 고친다.
2. **어두운 모드의 금색 버튼 위 아이콘**: 아이콘이 `currentColor`가 아니라 `--ink`를 직접 쓰면 금색 위에서 안 보인다 → Task 3 어두운 모드 스크린샷.
3. **고운바탕에 없는 글자**: 이모지·숫자·영문이 제목에 섞이면 대체 글꼴로 보인다(예: "8주 연속 출석!"의 숫자) → Task 3에서 제목 속 숫자 확인, 필요하면 `--font-display`에 프리텐다드를 두 번째로 둔다.
4. **글꼴 로딩 전 깜빡임**: 고운바탕은 큰 파일이라 느린 망에서 제목이 늦게 바뀐다 → `font-display: swap` 유지(fontsource 기본), Task 1에서 확인만.
5. **테두리만 남은 카드의 위계**: 그림자를 없애면 카드와 바탕 구분이 약해진다 → Task 3에서 `--line` 대비를 눈으로 확인(아이보리 위 흰 카드 + `#E4DED3` 선).

---

### Task 1: 토큰과 글꼴

**Files:**
- Modify: `src/ui/theme.css`(전체 값), `src/ui/base.css`(제목 글꼴 규칙), `src/main.tsx`(글꼴 import), `package.json`
- Create: `tests/unit/theme-contrast.test.ts`

**Interfaces:**
- Produces: 스펙 3절 표의 토큰 값 그대로. `--font-body: "Pretendard Variable", "Pretendard", -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;` `--font-display: "Gowun Batang", "Noto Serif KR", serif;` `--radius-sm: 6px; --radius-md: 10px; --radius-lg: 14px;` `--shadow-card: none;`
- Produces(시험 도우미, 같은 파일 안): `readTokens(css: string, mode: 'light' | 'dark'): Record<string, string>` — `:root { }` 블록과 `@media (prefers-color-scheme: dark) { :root { } }` 블록을 읽어 어두운 모드는 밝은 값 위에 덮어쓴 결과.

- [ ] **Step 1: 대비 시험 작성** `tests/unit/theme-contrast.test.ts` — `src/ui/theme.css`를 읽어 두 모드 모두에서:
```ts
const BODY: [fg: string, bg: string][] = [
  ['--ink','--bg'], ['--ink','--card'], ['--muted','--bg'], ['--muted','--card'],
  ['--accent-ink','--accent'], ['--accent-ink','--accent-press'], ['--accent-text','--bg'],
  ['--accent-text','--card'], ['--accent-text','--accent-soft'], ['--ink','--accent-soft'],
  ['--notice-ink','--notice-bg'], ['--danger','--card'], ['--ok','--card'],
]
const UI: [string, string][] = [['--line-strong','--card'], ['--gold','--card']]
test.each(['light','dark'])('%s 본문 대비 4.5 이상', ...)   // 실패 메시지에 쌍과 값 표시
test.each(['light','dark'])('%s UI 대비 3 이상', ...)
test('삭제된 토큰이 없다', () => { for (const t of ['--sun','--sun-halo','--dur-slow']) expect(css).not.toContain(t + ':') })
test('금색 토큰이 있다', () => { expect(light['--gold']).toBe('#B08A43'); expect(light['--accent-text']).toBe('#7F6430') })
```
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/theme-contrast.test.ts` → 금색 토큰 없음·삭제 토큰 존재로 FAIL
- [ ] **Step 3: 토큰 교체** — 스펙 3절 표 값으로 `theme.css`를 고치고 머리 주석을 새 방향으로 바꾼다. `--gold-text`는 `var(--accent-text)`. 삭제 토큰을 쓰던 곳은 Task 2에서 지우므로 이 단계에서 빌드가 깨지지 않는지만 본다(CSS 변수는 없어도 빌드는 통과).
- [ ] **Step 4: 글꼴** — `npm uninstall @fontsource/jua && npm i pretendard@1.3.9 @fontsource/gowun-batang@5.3.0`; `src/main.tsx`의 Jua import를 `import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'`, `import '@fontsource/gowun-batang/400.css'`, `import '@fontsource/gowun-batang/700.css'`로 교체(theme/base CSS보다 먼저). `base.css`에서 제목 규칙이 `--font-display`, 굵기 700, `font-synthesis: none`인지 확인.
- [ ] **Step 5: 통과 확인** — `npx vitest run tests/unit/theme-contrast.test.ts` PASS, `npm run typecheck`, `npm run build` 통과, `grep -rn "jua\|Jua" src package.json` 0건.
- [ ] **Step 6: 커밋** — `디자인: 남색·아이보리·금색 토큰, 고운바탕+프리텐다드`

---

### Task 2: 햇살 장식 걷어내기와 공통 부품 모양

**Files:**
- Delete: `src/ui/Sunrise.tsx`, `src/ui/Sunrise.module.css`
- Modify: `src/app/Landing.tsx` + `.module.css`, `src/app/InvalidLink.tsx` + `.module.css`, `src/app/TabBar.module.css`(선택 표시 39·54행), `src/ui/Card.module.css`, `src/ui/Button.module.css`
- Create: `tests/unit/design-guard.test.ts`

**Interfaces:**
- Consumes: Task 1 토큰.
- Produces: 컴포넌트 props는 바뀌지 않음(Landing·InvalidLink·TabBar·Card·Button 공개 모양 그대로).

- [ ] **Step 1: 금지 시험 작성** `tests/unit/design-guard.test.ts` — `src/**`를 읽어:
```ts
test('햇살 장식과 Jua가 남지 않는다', () => expect(hits(/Sunrise|var\(--sun|Jua|--dur-slow/)).toEqual([]))
test('모듈 CSS에 hex 색이 없다', () => expect(hitsIn('**/*.module.css', /#[0-9a-fA-F]{3,8}\b/)).toEqual([]))
```
(`hits`는 파일 경로:줄 목록을 돌려주는 같은 파일 안 도우미, `node:fs` 재귀 읽기)
- [ ] **Step 2: 실패 확인** — `npx vitest run tests/unit/design-guard.test.ts` → Sunrise 참조로 FAIL
- [ ] **Step 3: 첫 화면** — 스펙 4절: "명지대학교교회"(고운바탕 400, 20px) / "중등부"(고운바탕 700, 56px, `--text-display`를 56px로) / 40×2px `--gold` 선 / 안내 문장 / 아래쪽 버튼들. 기존 문구·버튼·"내 화면 열기" 동작 그대로. 해돋이 애니메이션 삭제.
- [ ] **Step 4: 잘못된 링크 화면** — 같은 문법(제목 + 금색 짧은 선 + 안내), 문구 그대로.
- [ ] **Step 5: 탭 바** — 선택된 탭: 글자 `--ink` 700 + 아래 3px×18px `--gold` 밑줄(`--radius` 2px). 해 모양·알약 배경 삭제. 움직임은 `--dur-fast` scaleX 등장만.
- [ ] **Step 6: 카드·버튼** — Card: 그림자 없음, `.accent` 변형은 `--accent-soft` 면 유지. Button: `.secondary` = card 면 + `1.5px solid var(--line)` + ink 글자, `.ghost` 글자 `--accent-text`. 모서리는 토큰 그대로.
- [ ] **Step 7: Sunrise 파일 삭제 후 통과 확인** — design-guard PASS, `npm run typecheck`, `npm run build`, `npm run test:unit` 통과.
- [ ] **Step 8: 커밋** — `디자인: 햇살 장식 제거, 첫 화면·탭 바·카드·버튼 새 모양`

---

### Task 3: 화면별 점검과 다듬기 (밝은·어두운 모드)

**Files:**
- Modify(필요한 것만): `src/teacher/AttendanceTab.module.css`, `src/ui/CelebrationBanner.module.css`, `src/ui/ChoiceChips.module.css`, `src/ui/EmptyState.module.css`, `src/ui/AttendanceCalendar.module.css`, `src/student/PrayerTab.module.css`, `src/student/SermonTab.module.css`, `src/teacher/TeacherApp.module.css`, `src/teacher/BulletinTab.module.css`, `src/teacher/TeacherPrayerTab.module.css`, `src/admin/AdminTab.module.css`, `src/admin/editor.module.css`, `src/admin/EditorBar.module.css` — 모두 `--accent`/`--accent-soft`/`--shadow-card`/`--font-display`를 쓰는 파일
- Create: `scripts/shots.mjs`(일회성 스크린샷 스크립트, 커밋함 — 다음 디자인 점검에도 씀)

**Interfaces:**
- Consumes: Task 1·2.
- Produces: `node scripts/shots.mjs <outDir>` — 에뮬레이터가 켜진 상태(`npm run emu` + `VITE_USE_EMULATOR=1 npm run dev`)에서 시드 데이터를 넣고 아래 화면을 390×844, `colorScheme: 'light'`·`'dark'` 두 번 찍어 `<outDir>/<화면>-<mode>.png`로 저장: landing, invalid, student-home, student-bulletin, student-sermon, student-prayer, student-me, teacher-attendance, teacher-class, teacher-prayer, teacher-bulletin, admin-menu, admin-bulletin-editor, admin-roster, admin-stats. 시드는 `tests/e2e/seed.ts`의 `seed()`를 재사용.

- [ ] **Step 1: 스크린샷 스크립트 작성·실행** — 결과를 `/private/tmp/…/scratchpad/redesign-before-fix/`에 저장하고 모든 PNG를 눈으로 본다.
- [ ] **Step 2: 의미가 바뀐 곳 고치기** — Review Focus 1·2·3·5를 기준으로:
  - 출석 이름 체크됨 = `--accent` 채움 + `--accent-ink` 글자 + 체크 아이콘(스펙 4절).
  - 축하 띠 = `--accent-soft` 면, 모서리 12px, 강조 숫자 `--gold-text`.
  - 선택된 칩(ChoiceChips) = `--accent` 채움 + `--accent-ink` 글자.
  - 화면 제목·말씀 제목·섹션 제목(예배 순서, 우리 반에 나눈 기도 등)이 `--font-display`를 쓰는지.
  - "밝은 강조 면"으로 `--accent`를 쓰던 곳은 `--accent-soft`로.
  - 결정이 애매하면 `python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py "<terms>" --domain ux`로 근거를 찾고 커밋 메시지에 한 줄 남긴다.
- [ ] **Step 3: 다시 찍어 확인** — `redesign-after/`에 다시 찍어 모든 화면을 본다. 두 모드에서 글자가 묻히는 곳·햇살 흔적·귤색이 하나도 없어야 한다.
- [ ] **Step 4: 시험** — `npm run typecheck`, `npm run test:unit`, `npm run test:e2e`(문구·접근성 이름이 그대로라 수정 없이 통과해야 한다. 고쳐야 했다면 이유를 커밋 메시지에) 통과.
- [ ] **Step 5: 커밋** — `디자인: 화면별 강조색·제목 글꼴 정리, 스크린샷 스크립트`

---

### Task 4: 앱 아이콘·메타·디자인 문서

**Files:**
- Modify: `public/icons/icon.svg`, `public/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `public/manifest.json`, `index.html`, `docs/design.md`

- [ ] **Step 1: 아이콘** — `icon.svg`: 512 정사각, `rx="112"` 남색 `#1B2A41` 둥근 사각형 + 가운데 금색 `#B08A43` 가는 십자(세로 막대 폭 28 × 길이 260, 가로 막대 폭 28 × 길이 168, 가로 막대 중심은 위에서 40% 높이, 끝 둥글게 rx 14). `node scripts/render-icons.mjs`로 PNG 3개 재생성, 192px PNG를 눈으로 확인.
- [ ] **Step 2: 메타** — manifest `background_color` `#F7F5F0`, `theme_color` `#1B2A41`; index.html theme-color 밝은 `#F7F5F0`, 어두운 `#121A2B`.
- [ ] **Step 3: design.md 다시 쓰기** — 스펙 7절: 방향 5~10줄, 3절 토큰 표(밝은·어두운), 4절 규칙, 문구 톤(기존 유지), 점검표(기존 + "햇살 장식 금지", "금색은 장식과 강조 글자에만", "새 화면은 `node scripts/shots.mjs`로 두 모드 확인").
- [ ] **Step 4: 확인** — `npm run build` 후 `dist/manifest.json`의 두 색 확인, `grep -c "#ff8b3d\|#fff9f3" public/manifest.json index.html` 0.
- [ ] **Step 5: 커밋** — `디자인: 남색·금색 십자 아이콘, 메타 색, design.md 개정`

---

### Task 5: 전체 검증

- [ ] **Step 1:** `npm run typecheck && npm run test:unit && npm run build && npm run test:rules && npm run test:e2e` 모두 통과(출력 마지막 줄 기록).
- [ ] **Step 2:** 에뮬레이터와 `VITE_USE_EMULATOR=1` 개발 서버를 켠 상태에서 `node scripts/shots.mjs ~/Desktop/중등부앱-새디자인` — 이승열 P가 볼 수 있게 바탕화면에 최종 스크린샷 저장, 끝나면 서버·에뮬레이터 종료.
