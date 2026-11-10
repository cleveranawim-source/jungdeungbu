# 중등부 앱 디자인 재작업 — "차분하고 단정한 교회" 설계

- 작성일: 2026-11-10
- 작성자: 이승열 P · Claude
- 상태: 검토 대기
- 바꾸는 것: 시각 디자인(글꼴·색·모양·장식·앱 아이콘)과 `docs/design.md`
- 바꾸지 않는 것: 화면 구성, 기능, 문구, 데이터, 보안 규칙, 라우팅

## 1. 배경과 목표

1차 디자인("주일 아침 햇살": 크림 바탕, 귤색 버튼, 둥근 손글씨 제목 Jua)이 이승열 P의 기대와 맞지 않았다.
시안 비교(브라우저 시안 3단계)로 다음을 골랐다.

| 항목 | 고른 것 |
|---|---|
| 분위기 | 차분하고 단정한 교회 느낌 |
| 글꼴 | C — 제목 고운바탕, 본문 프리텐다드 |
| 색 | 1 — 남색 · 아이보리 · 은은한 금색 |
| 모양 | A — 부드러운 카드(얇은 테두리, 그림자 없음) |

성공 기준: 모든 화면이 위 네 가지로 통일되고, 햇살 장식이 남지 않으며, 밝은·어두운 모드 모두 본문 대비 4.5:1 이상, 기존 시험이 모두 통과한다.

## 2. 글꼴

| 쓰임 | 글꼴 | 굵기 |
|---|---|---|
| 화면 제목(h1), 말씀·설교 제목, 섹션 제목(예배 순서 등), 첫 화면 "중등부" | 고운바탕 (Gowun Batang) | 700 (첫 화면 "명지대학교교회" 한 줄만 400) |
| 그 밖의 모든 글자(본문, 버튼, 탭, 입력칸, 숫자) | 프리텐다드 (Pretendard) | 400 / 500 / 600 / 700 |

- 둘 다 **앱에 파일로 포함**한다(외부 글꼴 서버 금지 — 오프라인·학생 IP 보호 원칙 유지).
  - 프리텐다드: npm `pretendard@1.3.9`의 `pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css`를 `src/main.tsx`에서 import.
  - 고운바탕: `@fontsource/gowun-batang@5.3.0`의 `@fontsource/gowun-batang/400.css`, `@fontsource/gowun-batang/700.css`를 import.
  - `@fontsource/jua`는 의존성과 import에서 제거.
- 토큰: `--font-body: "Pretendard Variable", "Pretendard", -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;`
  `--font-display: "Gowun Batang", "Noto Serif KR", serif;`
- 제목에 `font-synthesis: none`(가짜 굵기 금지)을 유지하고, 한글 줄바꿈 `word-break: keep-all`도 유지.

## 3. 색 토큰

토큰 **이름은 그대로 두고 값과 쓰임을 바꾼다**(컴포넌트 수정 범위를 줄이기 위해). 새 토큰은 `--gold`, `--gold-text` 둘만 추가하고, `--sun`, `--sun-halo`는 삭제한다.

### 밝은 모드

| 토큰 | 값 | 쓰임 |
|---|---|---|
| `--bg` | `#F7F5F0` | 화면 바탕(아이보리) |
| `--card` | `#FFFFFF` | 카드·탭 바·입력칸 |
| `--card-raised` | `#FFFFFF` | 시트·메뉴 |
| `--ink` | `#1B2A41` | 본문 글자(남색). bg 위 13.3:1 |
| `--muted` | `#5B6474` | 보조 글자. bg 위 5.5:1 |
| `--line` | `#E4DED3` | 카드 테두리·구분선 |
| `--line-strong` | `#9A8F7E` | 입력칸 테두리. card 위 3.2:1 |
| `--accent` | `#1B2A41` | 주요 버튼 채움, 체크된 출석 이름 채움(남색) |
| `--accent-press` | `#2A3D5C` | 주요 버튼 누르는 동안(흰 글자 10.9:1) |
| `--accent-ink` | `#FFFFFF` | accent 위 글자. 14.4:1 |
| `--accent-text` | `#7F6430` | 바탕 위 강조 글자(날짜·강조 숫자·링크). bg 위 5.1:1, accent-soft 위 4.7:1 |
| `--accent-soft` | `#F0EBE0` | 은은한 면: 축하 띠, 선택된 칩 |
| `--gold` | `#B08A43` | 장식 전용(선택된 탭 밑줄, 첫 화면 짧은 선). 글자에 쓰지 않음 |
| `--gold-text` | = `--accent-text` | 금색 글자가 필요할 때 |
| `--ok` / `--ok-soft` | 기존 값 유지 | 완료 표시 |
| `--danger` / `--danger-soft` / `--danger-ink` | 기존 값 유지 | 오류·삭제 |
| `--notice-bg` / `--notice-ink` | `#1B2A41` / `#F7F5F0` | 토스트·오프라인 띠 |
| `--focus` | `#2F4BC7` (유지) | 초점 고리 |

### 어두운 모드

| 토큰 | 값 | 비고 |
|---|---|---|
| `--bg` | `#121A2B` | |
| `--card` | `#1A2438` | |
| `--card-raised` | `#22304A` | |
| `--ink` | `#EEE9DF` | bg 위 14.4:1 |
| `--muted` | `#A7B0C2` | card 위 7.1:1 |
| `--line` | `#2A3550` | |
| `--line-strong` | `#6B7894` | card 위 3.5:1 |
| `--accent` | `#D9BC7E` | 버튼을 **금색 채움**으로 뒤집는다 |
| `--accent-press` | `#E6CD96` | |
| `--accent-ink` | `#121A2B` | 9.5:1 |
| `--accent-text` / `--gold-text` | `#D9BC7E` | card 위 8.5:1 |
| `--accent-soft` | `#23304A` | |
| `--gold` | `#D9BC7E` | |
| `--notice-bg` / `--notice-ink` | `#EEE9DF` / `#121A2B` | |
| 나머지(`--ok`, `--danger`, `--focus`, `--scrim`) | 기존 어두운 값 유지 | |

## 4. 모양

| 항목 | 규칙 |
|---|---|
| 카드 | 흰 면 + `1px solid var(--line)`, 모서리 `--radius-lg: 14px`, **그림자 없음**(`--shadow-card: none`) |
| 버튼 | 주요: accent 채움 + accent-ink 글자, 모서리 `--radius-md: 10px`. 보조: card 면 + `1.5px solid var(--line)` + ink 글자 |
| 배지·칩 | `--radius-sm: 6px` |
| 하단 탭 | 선택된 탭은 ink 색 굵은 글자 + 아래 3px `--gold` 짧은 밑줄. 기존 "해 표시"·알약 배경은 없앤다 |
| 출석 이름 버튼 | 체크됨 = accent 채움 + 체크 아이콘 + `aria-pressed="true"`, 안 됨 = card 면 + line 테두리 |
| 축하 띠 | `--accent-soft` 면, 모서리 12px, 강조 숫자는 `--gold-text`. 이모지는 문구 안에서만 |
| 화면 제목 | 고운바탕 700, `--text-xl`(26px) |
| 첫 화면(Landing) | "명지대학교교회"(고운바탕 400, 20px) / "중등부"(고운바탕 700, 56px) / 40×2px `--gold` 선 / 안내 문장 / 아래쪽에 버튼들. 해 그림 없음 |
| 잘못된 링크 화면(InvalidLink) | 같은 문법: 제목 + 금색 짧은 선 + 안내. 해 그림 없음 |
| 그림자 | `--shadow-float`(시트·토스트)만 남기고 카드에는 쓰지 않음 |
| 움직임 | 해돋이 애니메이션 삭제(`--dur-slow` 토큰 삭제). 누름·전환은 기존 토큰 유지, 움직임 줄이기 설정 존중 유지 |

## 5. 장식 정리

- `src/ui/Sunrise.tsx`, `src/ui/Sunrise.module.css` 삭제. 쓰는 곳: `src/app/Landing.tsx`, `src/app/InvalidLink.tsx`.
- `TabBar.module.css`의 해 모양 선택 표시(`.tab::before`)를 밑줄로 교체.
- 아이콘 세트(`src/ui/icons.tsx`)의 해·햇살 관련 아이콘이 있으면 쓰는 곳과 함께 정리.

## 6. 앱 아이콘과 메타

- `public/icons/icon.svg`를 새로 그린다: 남색(`#1B2A41`) 둥근 사각형 위에 금색(`#B08A43`) 가는 십자 하나. 글자 없음.
  `scripts/render-icons.mjs`로 192·512·apple-touch(180) PNG를 다시 만든다.
- `public/manifest.json`: `background_color` `#F7F5F0`, `theme_color` `#1B2A41`.
- `index.html` theme-color: 밝은 `#F7F5F0`, 어두운 `#121A2B`.

## 7. 문서

- `docs/design.md`를 새 기준으로 다시 쓴다: 방향(5~10줄), 토큰 표(위 3절), 컴포넌트 규칙(4절), 문구 톤(기존 유지), 점검표(기존 + "햇살 장식 금지, 금색은 장식·강조 글자에만").

## 8. 검증

- `npm run typecheck`, `npm run test:unit`, `npm run test:rules`, `npm run test:e2e`, `npm run build` 모두 통과(문구·접근성 이름이 바뀌지 않으므로 시험 수정은 없어야 한다. 바뀐다면 그 이유를 기록).
- 대비 검사: 3절의 모든 글자/바탕 쌍을 스크립트로 계산해 본문 4.5:1, 큰 글자·UI 경계 3:1 이상 확인.
- 스크린샷: 첫 화면, 잘못된 링크, 학생 5탭, 교사 출석·우리 반·기도·주보, 관리 메뉴·주보 작성·명단·출석 현황을 390×844 밝은·어두운 모드로 찍어 눈으로 확인.
- `grep -rn "#[0-9a-fA-F]\{3,6\}" src --include=*.module.css` 결과 0(토큰 외 색 금지 유지), `grep -rn "Sunrise\|--sun\|Jua" src` 결과 0.

## 9. 범위 밖

- 화면 배치·기능·문구 변경, 새 화면, 다크 모드 수동 전환 스위치, 글꼴 서브셋 최적화.
