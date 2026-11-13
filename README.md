# 명지대학교교회 중등부 앱

주보와 설교 요약, 우리 반 기도 제목, 출석을 한곳에서 보는 모바일 웹 앱이에요.
React + Vite + TypeScript, Firebase(Firestore · Authentication), GitHub Pages 배포(`/jungdeungbu/`)로 만들었어요.

## 들어가는 길

| 누가 | 어떻게 |
|---|---|
| 교사 | 앱 주소 뒤에 `#/t` → **선생님 로그인**(Google). 관리자가 미리 등록한 이메일만 들어와요. 카카오톡 등 앱 안 브라우저에서는 Google 이 로그인을 막아서, 바깥 브라우저(Safari/Chrome)로 여는 안내가 대신 떠요 |
| 학생 | 선생님이 보내 준 링크(`#/s/{토큰}`). 로그인 화면 없이 열려요. 링크를 여는 순간 뒤에서 조용히 익명 로그인하고 그 기기를 링크에 묶어요(기도 제목 올리기·내 글 지우기에 쓰여요). 홈 화면에 추가한 앱은 링크 없이 첫 화면으로 열리므로, 첫 화면의 **내 화면 열기**로 들어와요 |

## 역할

- **학생**: 홈 · 주보 · 말씀 · 기도 · 나(출석 달력, 연속 출석)
- **반 교사**: 출석 체크, 우리 반 학생과 링크 공유, 반 기도 제목, 주보 보기
- **관리자**: 반 교사 기능 전체 + 관리 탭(주보·설교·광고 작성, 학생 명단, 반·교사, 출석 현황과 CSV)

## 매주 하는 일 (관리자)

1. 관리 → **주보 작성**: 이번 주일 날짜를 고르고(지난 주보 복사 가능) 임시저장 후 **게시**
2. 관리 → **설교 작성**: 같은 날짜로 제목·본문·요약·적용 질문 입력
3. 필요하면 관리 → **광고** 추가·수정
4. 주일에 반 교사들이 **출석** 탭에서 체크
5. 학기 중간에 관리 → **출석 현황**에서 출석률 확인, 필요하면 CSV 내보내기

새 학생은 관리 → **학생 명단**에서 추가(여럿이면 일괄 붙여넣기)하고 **링크 공유**로 보내 주세요.

## 초기 1회 작업

1. Firebase 프로젝트를 새로 만든다.
2. **Firestore** 데이터베이스를 `asia-northeast3`(서울) 리전으로 만든다.
3. **Authentication → 로그인 방법**에서 **Google** 공급자와 **익명** 공급자를 **둘 다** 켠다(학생은 익명 인증을 쓴다).
4. Authentication → 설정 → **승인된 도메인**에 `cleveranawim-source.github.io` 추가.
5. Firestore 콘솔에서 `invites/{본인 이메일(소문자)}` 문서를 만든다: `{ name: '이름', role: 'admin', classIds: [] }`
   - 초대 이메일은 **Google 계정 주소 그대로** 적는다(앱에서 선생님을 초대할 때도 같다). 대소문자는 알아서 맞추지만,
     점(`.`)이나 `+별칭`은 맞추지 않는다: `hong.gildong@gmail.com` 으로 로그인하는 분을 `honggildong@gmail.com` 으로 초대하면 들어오지 못한다.
6. Firebase 프로젝트 설정 → 내 앱(웹)의 설정값을 로컬 `.env.local`(`.env.example` 참고)과 GitHub 저장소 **Settings → Secrets and variables → Actions**에 `VITE_FIREBASE_*` 여섯 개로 넣는다.
   `VITE_USE_EMULATOR`는 넣지 않는다.
7. `.firebaserc`의 `default` 프로젝트 ID를 만든 프로젝트로 바꾼다(지금은 에뮬레이터용 `demo-jungdeungbu`).
8. 규칙과 인덱스를 올린다(컬렉션 그룹 인덱스가 없으면 출석 화면이 동작하지 않는다). 처음엔 Firebase CLI 로그인과 프로젝트 선택부터:
   ```
   npx firebase login
   npx firebase use <projectId>
   npx firebase deploy --only firestore
   ```
9. GitHub 저장소 Settings → Pages → Source를 **GitHub Actions**로 바꾸고 `main`에 푸시한다.
10. 앱에서 `#/t`로 Google 로그인 → 관리 탭에서 반·교사·학생을 등록한다.

## 개발

```
npm install
npm run dev          # 개발 서버 (http://localhost:5173/jungdeungbu/)
npm run emu          # Firestore(8080)·Auth(9099) 에뮬레이터
npm run typecheck    # 타입 검사
npm run test:unit    # 단위 시험 (에뮬레이터 불필요)
npm run test:rules   # 보안 규칙·데이터 계층 시험 (에뮬레이터)
npm run test:e2e     # 화면 시험 (에뮬레이터 + Playwright)
npm run build        # dist/ 생성
```

에뮬레이터는 **Java**가 필요해요. `scripts/with-java.sh`가 PATH에 Java가 없으면 Homebrew `openjdk`를 찾아 붙이고(`brew install openjdk`), `emu`·`test:rules`·`test:e2e`는 이 스크립트를 거쳐 실행돼요.
에뮬레이터로 화면을 띄우려면 `VITE_USE_EMULATOR=1 npm run dev`.

GitHub Actions(`.github/workflows/pages.yml`)는 `main` 푸시 때 타입 검사 → 단위 시험 → 빌드 → Pages 배포를 해요. Java와 에뮬레이터 설치는 하지 않으므로 `test:rules`·`test:e2e`는 **배포 전에 로컬에서** 돌려 주세요.

## 기기에서 직접 확인 (배포 후)

자동 시험이 닿지 않는 부분이에요. 배포할 때마다 휴대폰으로 한 번씩 봐 주세요.

- [ ] iPhone·갤럭시 **카카오톡 안 브라우저**에서 학생 링크 열기(홈·주보·기도 올리기)
- [ ] **카톡에서 교사 로그인**: Google 버튼 대신 안내가 뜨는지, 'Safari/Chrome으로 열기'(안드로이드는 **Chrome으로 열기** 버튼)로 바깥 브라우저에서 Google 로그인이 되는지
- [ ] **Android 홈 화면 추가 후 실행**: 학생 링크를 연 뒤 홈 화면에 추가 → 아이콘으로 열면 첫 화면의 **내 화면 열기**로 내 화면이 열리는지
- [ ] **편집기 저장바와 키보드**: 주보·설교 작성에서 입력칸을 눌러 키보드가 올라와도 아래 저장바·입력칸이 가려지지 않는지
- [ ] 교사 **로그아웃 뒤 다시 로그인**: 로그인 화면으로 돌아오고, 같은 계정으로 다시 들어가 출석 명단이 보이는지

## 데이터 구조 한 줄 요약

`teachers`·`invites`(교사) / `classes` · `students/{토큰}/attendance`(반·학생·출석) / `bulletins`·`sermons`·`announcements`(주보·설교·광고) / `classes/{id}/prayers`(반 공개 기도) · `prayers`(선생님만) / `studentSessions`(익명 UID ↔ 토큰).

중등부 안내와 이름이 든 덧붙임: `settings/info`(표어·에티켓·오시는 길·교회 전화 — 누구나 읽음) / `memberInfo/main`(섬기는 분들·개인 번호) · `bulletins/{날짜}/members/main`(새 친구·이번 달 생일 — 둘 다 선생님과 학생 링크를 연 기기만, 주보 쪽은 게시된 주보일 때만). 공개 문서(`bulletins/{날짜}`·`settings/info`)에는 새 친구·생일 명단, 개인 번호, 반 ID를 넣지 않는다.

## 문서

- [설계 문서](docs/superpowers/specs/2026-11-09-jungdeungbu-app-design.md): 목적, 데이터 모델, 보안 규칙, 화면, 배포
- [디자인 기준](docs/design.md): 색·글꼴·간격과 컴포넌트 원칙
