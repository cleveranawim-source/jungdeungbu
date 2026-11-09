# 명지대학교교회 중등부 앱 — 설계 스펙

- 작성일: 2026-11-09
- 작성자: 이승열 P · Claude
- 상태: 검토 대기

## 1. 목적과 범위

명지대학교교회 중등부(학생 30~80명, 교사 10명 이상)가 매주 쓰는 모바일 웹앱.
학생은 자기 링크로 들어와 주보·설교 요약·광고·우리 반 기도 제목·자기 출석을 보고,
교사는 Google 로그인으로 들어와 자기 반 출석을 찍고, 관리자는 콘텐츠와 명단을 관리한다.

### 1차 기능

1. 주보(항목별 구조화 입력) 보기·작성
2. 출석(교사가 반 명단에서 체크), 학생은 자기 기록만 열람
3. 설교 요약(제목·본문·요약·적용 질문)
4. 광고(별도 컬렉션, 주보 광고란에 자동 반영)
5. 기도 제목 나눔(학생이 올림, 공개 범위 "우리 반" / "선생님만")
6. 생일·연속출석 축하(학생 홈 배너, 교사 반 화면 표시)

### 1차에서 제외

푸시 알림, 서비스 워커 오프라인 전체 지원, 심방 메모, 학부모 화면, 설교 전문·음성·영상, 카카오 봇.

### 확정한 전제

- 설교는 sermon 스킬로 쓴 원고의 요약판만 올린다. 전문은 올리지 않는다.
- 광고는 주보에 딸린 항목이자 별도 목록이다. 주보가 없는 주에도 광고만 올릴 수 있다.
- Firebase 프로젝트는 idreamstill 계정에 새로 만든다(said-nothing의 mind-trans 계정과 무관).
- 출석·기도 제목은 개인 정보다. 규칙을 열어두지 않고 보안 규칙으로 보호한다.
- 역할은 관리자(admin)와 반 교사(teacher) 두 등급이다.

## 2. 전체 구조

정적 웹앱 하나가 GitHub Pages에 올라가고, 데이터는 Firebase(Firestore + Auth)에만 있다. 서버 코드는 없다.

| 항목 | 결정 |
|---|---|
| 프레임워크 | Vite + React, 해시 라우팅(`#/...`) |
| 저장소 | `~/Claude/jungdeungbu/`, GitHub `cleveranawim-source/jungdeungbu`(공개) |
| 데이터 | Firestore(서울 리전), 오프라인 캐시 사용 |
| 교사 인증 | Firebase Auth Google 로그인. `invites/{email}`에 등록된 이메일만 교사로 연결 |
| 학생 인증 | 없음. `#/s/{token}` 링크. 토큰 = 128비트 난수의 base64url(22자) |
| PWA | `manifest.json`과 아이콘만. 서비스 워커 없음 |
| 디자인 | 모바일 세로 화면 우선, 하단 탭. 출석 화면은 한 손 조작·한 번 터치 토글 |

### 진입 주소

| 주소 | 화면 |
|---|---|
| `#/` | "교사 로그인" 버튼 + "학생은 받은 링크로 들어오세요" 안내 |
| `#/s/{token}` | 학생 홈 |
| `#/t` | 교사. 로그인 뒤 역할에 따라 반 교사 화면 또는 관리자 화면 |

### 날짜 기준

"이번 주"는 가장 가까운 주일 날짜 하나로 묶는다. 토요일에 보면 다음 날 주일, 월~금은 지난 주일. 주보·설교 문서 ID는 이 주일 날짜(`yyyy-mm-dd`)다.

## 3. 데이터 모델

핵심 원칙 둘.
학생은 **추측 불가능한 ID를 안다는 것 자체가 권한**이다(링크 토큰, 반 ID).
교사는 **Google 로그인 UID로 역할을 확인**한다.
학생이 **쓰기**(기도 제목)를 할 때는 익명 인증 UID를 쓴다. 공개 문서에 토큰을 넣으면 같은 반 누구나 토큰을 수집할 수 있기 때문이다. 학생 앱은 링크를 열 때 익명 로그인하고 `studentSessions/{uid}`에 토큰을 묶는다.

| 컬렉션 | 문서 ID | 주요 필드 | 용도 |
|---|---|---|---|
| `teachers/{uid}` | Google UID | email, name, role(`admin`/`teacher`), classIds[] | 로그인한 교사의 역할 |
| `invites/{email}` | 이메일(소문자) | name, role, classIds[] | 관리자가 미리 등록한 교사 명단. 첫 로그인 때 `teachers`로 자동 복사 |
| `classes/{classId}` | 난수 22자 | name, grade, order | 반. ID가 난수여서 "반을 안다" = 그 반 소속 |
| `students/{token}` | 난수 22자 = 학생 링크 토큰 | name, classId, birthday(`MM-DD`), active, streak, lastPresent | 학생 한 명. 링크 주소가 곧 문서 ID |
| `students/{token}/attendance/{yyyy-mm-dd}` | 주일 날짜 | date, present, by(uid), at | 출석 1건. `date` 필드는 컬렉션 그룹 질의용 |
| `bulletins/{yyyy-mm-dd}` | 주일 날짜 | date, order[]({type,title,detail}), hymns[], scripture, sermonTitle, published, updatedBy, updatedAt | 주보 |
| `sermons/{yyyy-mm-dd}` | 주일 날짜 | date, title, scripture, summary, body, questions[] | 설교 요약. 주보와 같은 날짜로 연결 |
| `announcements/{id}` | 자동 | title, body, startDate, endDate, pinned, createdAt | 광고. 주보 광고란은 그 주일이 [startDate, endDate] 안에 드는 광고를 가져온다 |
| `studentSessions/{uid}` | 학생 기기의 익명 인증 UID | token | 학생 링크를 열면 Firebase 익명 로그인 뒤 자기 토큰을 여기에 묶는다. 본인만 읽는다 |
| `classes/{classId}/prayers/{id}` | 자동 | authorUid, studentName, text, createdAt | **우리 반 공개** 기도 제목. 토큰은 저장하지 않는다 |
| `prayers/{id}` | 자동 | authorUid, studentName, classId, text, createdAt | **선생님만** 보는 기도 제목 |

### 파생 값

- `students.streak`·`lastPresent`: 교사가 출석을 토글할 때 그 학생의 출석 기록을 읽어 다시 계산하고, 출석 문서와 **같은 배치**로 학생 문서에 쓴다. 연속 주수는 주일 날짜가 7일 간격으로 이어지는 횟수다.
- 교사 출석 화면은 `attendance` 컬렉션 그룹을 `date == 선택한 주일`로 질의해 반 전체를 한 번에 불러온다. `firestore.indexes.json`에 컬렉션 그룹 단일 필드 인덱스(`attendance.date`)를 둔다.

## 4. 보안 규칙

| 대상 | 읽기 | 쓰기 |
|---|---|---|
| `students/{token}` | get: `active == true`인 문서를 토큰을 아는 사람, 교사는 모두. list: 교사만 | 관리자. `streak`·`lastPresent`만은 그 반 교사도 |
| `students/{token}/attendance/*` | 토큰을 아는 사람 + 교사(컬렉션 그룹 포함) | 그 반 교사 또는 관리자 |
| `bulletins` `sermons` `announcements` | 누구나 | 관리자 |
| `classes/{classId}` | 누구나(get). list: 교사만 | 관리자 |
| `classes/{classId}/prayers/*` | 반 ID를 아는 사람 | 생성: 로그인(익명)되어 있고 `authorUid == request.auth.uid`, `studentSessions/{uid}.token`이 가리키는 학생이 활성이며 그 classId가 경로와 같고 studentName이 일치할 때. 수정 없음. 삭제: 교사 또는 `authorUid == request.auth.uid`(본인 글) |
| `prayers/*` | 교사만 | 생성 조건은 위와 같음(classId 필드와 학생 문서 일치). 삭제: 교사 |
| `teachers/{uid}` | 본인 + 관리자 | 생성: `request.auth.uid == uid`이고 `invites/{request.auth.token.email}`의 role·classIds와 일치할 때. 수정·삭제: 관리자 |
| `invites/{email}` | 본인 이메일 문서 + 관리자 | 관리자 |

- "교사" 판정은 `exists(teachers/{uid})`, "관리자"는 `teachers/{uid}.role == 'admin'`, "그 반 교사"는 `classId in teachers/{uid}.classIds` 또는 관리자.
- 학생은 익명 인증 UID로 본인 글을 **삭제**할 수 있다. `hidden` 필드는 없다.
- 교사를 내보낼 때는 `teachers/{uid}`와 `invites/{email}`을 **같은 배치로** 지운다. 초대가 남아 있으면 다시 로그인해 권한을 되살릴 수 있다.
- 첫 관리자는 Firebase 콘솔에서 `invites/{이승열 P 이메일}`에 `role: admin` 문서를 손으로 만든다. 그 뒤로는 앱에서 관리한다.
- 학생 링크 유출 시 관리자 화면의 **링크 재발급**(새 토큰 문서를 만들고 출석 기록을 복사한 뒤 옛 문서를 `active: false`로)으로 대응한다. 비활성 문서와 그 출석 기록은 토큰으로 읽을 수 없으므로 옛 링크는 즉시 죽는다.
- 공개 데이터는 로그인 없이 읽히므로 `robots.txt`와 `noindex` 메타로 검색 색인을 막는다.

## 5. 화면

세 사용자, 세 묶음. 모두 모바일 세로 화면 기준, 하단 탭.

### 학생 (`#/s/{token}`)

| 탭 | 내용 |
|---|---|
| 홈 | 이번 주 주보 요약 카드(날짜·설교 제목·본문), 이번 주 광고, 축하 배너(생일 주간 / 연속출석 4·8·12·…주 고비) |
| 주보 | 이번 주 주보 전체: 예배 순서 → 찬양 → 본문 → 설교 제목 → 광고. 지난 주보는 날짜 목록 |
| 말씀 | 설교 요약 목록 → 제목·본문·요약·적용 질문 |
| 기도 | 우리 반 기도 제목 + "기도 제목 올리기"(공개 범위 우리 반 / 선생님만). 우리 반 글 중 내 글(`authorUid` 일치)은 삭제 가능. "선생님만" 글은 올린 뒤 "선생님께 전했어요" 확인만 보이고 목록에는 남지 않는다(학생은 `prayers`를 읽을 수 없다) |
| 나 | 이름·반, 출석 달력(이번 학기), 연속출석 주수, 생일 |

- 토큰이 잘못됐거나 `active: false`면 "선생님께 링크를 다시 받아주세요" 한 화면만 보인다. 두 경우를 구분해 알려주지 않는다.
- 학생 화면에 교사용 요소는 없다.
- 학생 링크를 열면 앱이 조용히 Firebase 익명 로그인을 하고 `studentSessions/{uid}`에 링크의 토큰을 쓴다(같은 기기에서 다른 링크를 열면 덮어쓴다). 익명 로그인이 실패해도 읽기 화면은 그대로 보이고, 기도 제목 올리기만 "잠시 뒤 다시 시도해 주세요"로 막힌다.

### 반 교사 (`#/t`, role = teacher)

| 탭 | 내용 |
|---|---|
| 출석 | 날짜 선택(기본 가장 가까운 주일) → 내 반 명단. 이름 터치로 출석/취소 토글. "출석 n / 전체 m". 담당 반이 여럿이면 반 전환 |
| 우리 반 | 학생 목록(이름·연속출석·이번 주 생일). 학생 상세: 출석 달력, 학생 링크 복사·공유 |
| 기도 | 내 반 학생의 기도 제목 전체(우리 반 공개 + 선생님만). 삭제 |
| 주보 | 학생과 같은 보기 화면 |

### 관리자 (`#/t`, role = admin)

반 교사의 네 탭 + **관리** 탭. 반 선택 시 모든 반을 볼 수 있다.

| 관리 메뉴 | 내용 |
|---|---|
| 주보 작성 | 날짜 선택 → 예배 순서(기본 템플릿 불러와 수정), 찬양, 본문, 설교 제목. "지난 주보 복사". 임시저장(`published: false`)과 게시 두 단계 |
| 설교 작성 | 날짜·제목·본문·요약·적용 질문. 주보와 같은 날짜면 자동 연결 |
| 광고 | 목록·추가·수정·삭제. 시작일·종료일·상단 고정 |
| 학생 명단 | 추가(이름·반·생일), 반 이동, 비활성화, 링크 재발급. 일괄 등록: "이름<TAB 또는 쉼표>반<TAB>생일" 줄 단위 붙여넣기 |
| 반·교사 | 반 추가·이름·순서. 교사 이메일 등록(`invites`)과 담당 반 지정, 역할 변경 |
| 출석 현황 | 날짜별 전체 출석률, 반별 숫자. 기간 지정 CSV 내보내기 |

### 공통 동작

- **교사 첫 로그인**: Google 로그인 → `teachers/{uid}` 없음 → `invites/{이메일}` 확인 → 있으면 자동 등록해 진입, 없으면 "등록되지 않은 계정입니다. 관리자에게 이메일을 알려주세요".
- **학생 링크 전달**: "링크 공유" → "○○아, 중등부 앱이야 → 주소" 문구와 함께 Web Share API 시트. 미지원 브라우저는 클립보드 복사.
- **주보 기본 템플릿**: 예배 순서 항목 목록은 `settings/bulletinTemplate` 문서에 두고 관리자가 편집한다.

## 6. 오류 처리

- **네트워크 끊김**: Firestore 오프라인 캐시로 이미 본 데이터는 그대로 보이고, 출석 체크는 연결되면 전송된다. 상단에 "오프라인, 연결되면 저장됩니다" 띠.
- **권한 오류**: 조용히 실패하지 않고 원인을 적은 토스트("이 반의 출석 권한이 없습니다").
- **동시 수정**: 출석은 학생마다 문서가 따로여서 충돌 없음. 주보는 마지막 저장이 이기되 "○○님이 n분 전 저장"을 표시.
- **잘못된 링크**: 안내 화면 하나. "없음"과 "비활성"을 구분하지 않는다.
- **연속출석 재계산**: 출석 토글과 학생 문서 갱신을 한 배치로 묶는다.

## 7. 테스트

| 종류 | 도구 | 내용 |
|---|---|---|
| 보안 규칙 | Firebase 에뮬레이터 + `@firebase/rules-unit-testing` | 학생 토큰으로 다른 학생 읽기 불가 / 반 교사가 다른 반 출석 쓰기 불가 / 초대 없는 Google 계정 교사 등록 불가 / 학생이 다른 반 기도 컬렉션 쓰기 불가 / 비교사는 `students` list 불가 / 반 ID로 기도 문서를 읽어도 토큰이 없음 / 비활성 토큰으로 학생·출석 읽기 불가 / 다른 학생의 세션 UID로 글 쓰기 불가 / 본인 글만 삭제 |
| 단위 | Vitest | 가장 가까운 주일 계산, 연속출석 계산, 토큰 생성·형식 검증, 일괄 등록 파서, 광고 유효기간 필터 |
| 화면 | Playwright(에뮬레이터 상대) | ① 관리자가 학생 추가 → 링크로 학생 홈 열림 ② 교사 출석 토글 → 학생 "나" 탭 반영 ③ 학생 기도 제목 → 교사 기도 탭에 보임 |
| 수동 | 실기기 | iPhone·갤럭시 카톡 인앱 브라우저에서 학생 링크 열기(배포 후 이승열 P) |

보안 규칙 시험을 가장 먼저 쓴다. 화면 확인은 CLAUDE.md 원칙대로 playwright MCP를 먼저 쓴다.

## 8. 배포

- **GitHub Actions**: `main` 푸시 → Vite 빌드 → GitHub Pages 배포. `vite.config` `base`는 `/jungdeungbu/`.
- **Firebase**: idreamstill 계정 새 프로젝트. Firestore(서울 `asia-northeast3`), Google 로그인 공급자, 승인 도메인에 `cleveranawim-source.github.io`. 규칙과 인덱스는 저장소의 `firestore.rules`·`firestore.indexes.json`을 `firebase deploy --only firestore`로 올린다.
- **설정값**: Firebase 웹 설정은 공개 가능한 값이라 저장소에 둔다. 보호는 규칙과 승인 도메인이 맡는다.
- **초기 1회 작업**(이승열 P): 콘솔에서 `invites/{본인 이메일}` `role: admin` 생성 → 앱 Google 로그인 → 관리 탭에서 반·교사·학생 등록.
- **비용**: Spark 무료 요금제 범위. 학생 80명이 매주 열어도 일일 읽기 한도(5만)의 몇 퍼센트 수준.

## 9. 프로젝트 구조(안)

```
jungdeungbu/
├─ src/
│  ├─ app/            라우터, 역할 분기, 레이아웃(하단 탭)
│  ├─ lib/            firebase 초기화, 날짜(주일 계산), 토큰, 연속출석, 파서
│  ├─ data/           컬렉션별 읽기·쓰기 함수(students, attendance, bulletins, …)
│  ├─ student/        학생 탭 화면
│  ├─ teacher/        반 교사 탭 화면
│  ├─ admin/          관리자 메뉴 화면
│  └─ ui/             공통 컴포넌트(토스트, 오프라인 띠, 카드)
├─ firestore.rules
├─ firestore.indexes.json
├─ tests/rules/       규칙 시험
├─ tests/e2e/         Playwright
├─ public/            manifest.json, 아이콘, robots.txt
└─ .github/workflows/pages.yml
```

`data/`는 화면과 Firestore 사이의 유일한 경계다. 화면 컴포넌트는 Firestore SDK를 직접 부르지 않는다.
