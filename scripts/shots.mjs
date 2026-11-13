// 디자인 점검용 스크린샷: 주요 화면을 390×844, 밝은·어두운 모드로 찍는다.
// 종이 주보와 맞춘 새 화면(주보·주보 작성·중등부 안내·학생 명단)은 360px 폭 긴 화면으로도 찍는다(-360).
// 준비: `npm run emu` 와 `VITE_USE_EMULATOR=1 npm run dev` 를 켠 상태에서
//   node scripts/shots.mjs <저장할 폴더> [앱 주소, 기본 http://localhost:5173/jungdeungbu/]
// 에뮬레이터 Firestore 를 비우고 보기 좋은 시드를 넣은 뒤 찍는다(운영 데이터와 무관).
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

const [outDir, base = 'http://localhost:5173/jungdeungbu/'] = process.argv.slice(2);
if (!outDir) { console.error('저장할 폴더를 적어 주세요: node scripts/shots.mjs <폴더>'); process.exit(1); }
mkdirSync(outDir, { recursive: true });

const ADMIN = 'shots-admin@example.com';
const STUDENT = 'shotStudentA0000000000';
const pad = (n) => String(n).padStart(2, '0');
const id = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** 앱의 nearestSunday 와 같은 규칙: 토요일은 다음 날, 월~금은 지난 주일, 일요일은 당일. */
function nearestSunday(now) {
  const day = now.getDay();
  return addDays(now, day === 6 ? 1 : -day);
}
const sunday = nearestSunday(new Date());
const SUN = id(sunday);
const ago = (weeks) => id(addDays(sunday, -7 * weeks));
const MM = pad(sunday.getMonth() + 1);
/** 반: [id, 이름, 주보의 짧은 이름, 지난 주 출석, 전체] — 종이 주보(2026-41호)의 숫자 */
const CLASSES = [
  ['classA', '1학년 1반', '1-1', 5, 8], ['classB', '1학년 2반', '1-2', 4, 9], ['classC', '1학년 3반', '1-3', 4, 7],
  ['classD', '2학년 1반', '2-1', 4, 6], ['classE', '2학년 2반', '2-2', 4, 6], ['classF', '3학년 1반', '3-1', 6, 12],
  ['classG', '3학년 2반', '3-2', 6, 7],
];

async function seedAll() {
  const env = await initializeTestEnvironment({ projectId: 'demo-jungdeungbu', firestore: { host: '127.0.0.1', port: 8080 } });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const put = (path, data) => setDoc(doc(db, path), data);
    await put(`invites/${ADMIN}`, { name: '이승열', role: 'admin', classIds: [] });
    for (const [i, [cid, name]] of CLASSES.entries()) await put(`classes/${cid}`, { name, grade: Number(name[0]), order: i + 1 });
    const names = [['김하늘', `${MM}-${pad(sunday.getDate())}`, 8], ['이바다', '03-05', 0], ['박별', '07-21', 4], ['최하람', null, 1], ['정새벽', '12-24', 2], ['한빛나', null, 0]];
    for (const [i, [name, birthday, streak]] of names.entries()) {
      const token = i === 0 ? STUDENT : `shotStudent${String.fromCharCode(66 + i)}0000000000`;
      await put(`students/${token}`, { name, classId: 'classA', birthday, active: true, streak, lastPresent: streak ? SUN : null, ...(name === '한빛나' && { newcomer: true }) });
      for (let w = 0; w < streak; w++) await put(`students/${token}/attendance/${ago(w)}`, { date: ago(w), present: true, by: 'seed', at: Timestamp.now() });
    }
    // 종이 주보(2026-41호)와 같은 내용. 학생·섬기는 분 이름과 번호는 모두 지어낸 것이다(공개 저장소).
    await put(`bulletins/${SUN}`, {
      date: SUN, published: true, issue: '2026-41호', leader: '정한결 선생님',
      opening: { text: '하나님은 영이시니 예배하는 자가 영과 진리로 예배할지니라', ref: '요 4:24' },
      scripture: '누가복음 17장 11-19절', sermonTitle: '지금의 자리에서 감사', hymns: [],
      order: [
        { type: '경배와 찬양', title: '', detail: '리조이스 찬양팀' },
        { type: '신앙고백', title: '사도신경', detail: '다함께', standing: true },
        { type: '영광찬송', title: '주님 큰 영광받으소서', detail: '다함께', standing: true },
        { type: '합심기도', title: '', detail: '다함께', standing: true },
        { type: '기도', title: '', detail: '오세린 선생님', standing: true },
        { type: '봉헌', title: '주를 향한 나의 사랑을', detail: '윤가온 서이든' },
        { type: '성경봉독', title: '', detail: '다함께' },
        { type: '설교', title: '', detail: '이승열 목사님' },
        { type: '찬송', title: '주님 말씀 앞에 선', detail: '다함께', standing: true },
        { type: '축복기도', title: '', detail: '이승열 목사님', standing: true },
        { type: '소식나눔', title: '', detail: '김형준 부장님' },
        { type: '축하나눔', title: '', detail: '학생임원' },
      ],
      nextServers: [
        { role: '인도', name: '도하은 학생' }, { role: '기도', name: '남지율 학생' },
        { role: '봉헌', name: '배서윤 임도윤' }, { role: '소식나눔', name: '학생임원' },
      ],
      attendance: {
        sunday: ago(1),
        classes: CLASSES.map(([classId, , short, present, total]) => ({ classId, name: short, present, total })),
        students: { present: 33, total: 55 }, teachers: { present: 13, total: 15 },
      },
      updatedBy: 'seed', updatedAt: Timestamp.now(),
    });
    await put(`bulletins/${SUN}/members/main`, {
      newFriends: ['윤새봄', '문하람', '권도이'],
      birthdays: [{ name: '김하늘', date: `${MM}-${pad(sunday.getDate())}` }, { name: '정새벽', date: `${MM}-28` }],
    });
    await put('settings/info', {
      motto: {
        title: '동행하는 자', subtitle: '하나님과 동행하며 내 이웃과 동행하는 사람',
        verse: '사람아 주께서 선한 것이 무엇임을 네게 보이셨나니 여호와께서 네게 구하시는 것은 오직 정의를 행하며 인자를 사랑하며 겸손히 네 하나님과 함께 행하는 것이 아니냐',
        ref: '미가 6:8',
      },
      etiquette: [
        '예배 시작은 9:30이며, 9:15부터 찬양이 시작됩니다.',
        '휴대폰은 소리를 끄고 가방에 넣어 주세요.',
        '예배 중에는 자리를 옮기지 않아요.',
        '말씀 시간에는 성경을 펴고 함께 읽어요.',
        '나는 예배 시간보다 먼저 와서 마음을 준비했나요?',
        '찬양할 때 입술과 마음을 함께 열었나요?',
        '기도 시간에 눈을 감고 하나님께 집중했나요?',
        '말씀을 듣고 이번 주에 해 볼 한 가지를 정했나요?',
        '옆 친구에게 먼저 반갑게 인사했나요?',
        '예배가 끝난 뒤 자리를 깨끗이 정리했나요?',
      ],
      place: { name: '명지대학교교회', address: '서울 서대문구, 명지대학교 인문캠퍼스 안 교회 건물 3층', mapUrl: 'https://example.com/map' },
      churchPhone: '02-303-2501',
    });
    await put('memberInfo/main', {
      servants: [
        { role: '교장', names: '정은호 장로님' }, { role: '담당', names: '이승열 목사님' },
        { role: '부장', names: '김형준 부장님' }, { role: '부감', names: '서민아 집사님' },
        { role: '총무', names: '조현우 선생님' }, { role: '서기', names: '문지아 선생님' }, { role: '회계', names: '백승아 선생님' },
        { role: '교사', names: '강다은 권소율 노태윤 류하진 오세린 정한결 장시온 허예준' },
      ],
      contacts: [
        { label: '이승열 목사님', phone: '010-0000-0000' }, { label: '김형준 부장님', phone: '010-0000-0001' },
        { label: '조현우 총무 선생님', phone: '010-0000-0002' },
      ],
    });
    await put(`sermons/${SUN}`, {
      date: SUN, title: '지금의 자리에서 감사', scripture: '누가복음 17장 11-19절',
      summary: '열 명이 나았지만 돌아와 감사한 사람은 한 명이었어요.',
      body: '열 명이 예수님께 고침을 받았어요. 그런데 돌아와 감사한 사람은 한 명뿐이었지요.\n\n이번 주, 지금 내가 서 있는 자리에서 감사할 것 세 가지를 찾아봐요. 큰일이 없어도 감사는 바로 여기서 시작돼요.',
      questions: ['요즘 당연하게 여겼던 것 중 감사할 일은 무엇인가요?', '이번 주 누구에게 고맙다고 말해 볼까요?'],
    });
    await put('announcements/a1', { title: '중등부 겨울 수련회 신청', body: '12월 7일까지 반 선생님께 신청해 주세요. 회비 3만 원', startDate: ago(1), endDate: id(addDays(sunday, 21)), pinned: true, createdAt: Timestamp.now() });
    await put('announcements/a2', { title: '성탄 찬양 연습', body: '예배 후 2층 교육관에서 30분', startDate: SUN, endDate: SUN, pinned: false, createdAt: Timestamp.now() });
    await put('classes/classA/prayers/p1', { authorUid: 'u1', studentName: '박별', text: '다음 주 시험 잘 볼 수 있게 기도해 주세요.', createdAt: Timestamp.now() });
    await put('classes/classA/prayers/p2', { authorUid: 'u2', studentName: '최하람', text: '할머니가 빨리 나으시도록\n함께 기도해 주세요.', createdAt: Timestamp.now() });
    await put('prayers/t1', { authorUid: 'u3', studentName: '정새벽', classId: 'classA', text: '친구 관계 때문에 마음이 힘들어요.', createdAt: Timestamp.now() });
  });
  await env.cleanup();
}

const settle = async (p) => { await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1200); };

/** 교사(관리자) 화면을 연 컨텍스트. 에뮬레이터 로그인으로 들어간다. */
async function teacherPage(browser, opts) {
  const context = await browser.newContext(opts);
  const t = await context.newPage();
  await t.goto('#/t');
  await t.getByLabel('이메일').fill(ADMIN);
  await t.getByLabel('이름').fill('이승열');
  await t.getByRole('button', { name: '에뮬레이터 로그인' }).click();
  await t.getByRole('tablist', { name: '교사 메뉴' }).waitFor();
  return { context, t };
}

await seedAll();
const browser = await chromium.launch();
for (const scheme of ['light', 'dark']) {
  const opts = { viewport: { width: 390, height: 844 }, colorScheme: scheme, deviceScaleFactor: 2, baseURL: base };
  const shot = async (p, name, full = false) => {
    if (!full) return p.screenshot({ path: `${outDir}/${name}-${scheme}.png` });
    // 긴 화면: 창을 문서 높이만큼 늘려 찍는다(fullPage 는 고정된 탭 바가 중간에 찍혀 내용을 가린다)
    const vp = p.viewportSize();
    const height = await p.evaluate(() => document.documentElement.scrollHeight);
    await p.setViewportSize({ width: vp.width, height: Math.max(vp.height, height) });
    await settle(p);
    await p.screenshot({ path: `${outDir}/${name}-${scheme}.png` });
    await p.setViewportSize(vp);
  };

  const anon = await browser.newContext(opts);
  const a = await anon.newPage();
  await a.goto('#/'); await settle(a); await shot(a, 'landing');
  await a.goto('#/s/abc'); await settle(a); await shot(a, 'invalid');
  for (const tab of ['home', 'bulletin', 'sermon', 'prayer', 'me']) {
    await a.goto(`#/s/${STUDENT}/${tab}`); await settle(a); await shot(a, `student-${tab}`);
  }
  // 주보 탭 전체(순서표·예배위원·출석·새 친구·생일·중등부 안내)
  await a.goto(`#/s/${STUDENT}/bulletin`); await settle(a); await shot(a, 'student-bulletin-full', true);
  await anon.close();

  const { context: teacher, t } = await teacherPage(browser, opts);
  for (const [name, hash] of [['teacher-attendance', '#/t/attendance'], ['teacher-class', '#/t/class'], ['teacher-prayer', '#/t/prayer'],
    ['teacher-bulletin', '#/t/bulletin'], ['admin-menu', '#/t/admin'], ['admin-bulletin-editor', '#/t/admin/bulletin'],
    ['admin-info', '#/t/admin/info'], ['admin-roster', '#/t/admin/roster'], ['admin-stats', '#/t/admin/attendance']]) {
    await t.goto(hash); await settle(t); await shot(t, name);
  }
  await teacher.close();

  // 좁은 휴대폰(360px): 종이 주보와 맞춘 새 화면을 긴 화면 그대로 찍는다
  const narrow = { ...opts, viewport: { width: 360, height: 780 } };
  const anon360 = await browser.newContext(narrow);
  const a3 = await anon360.newPage();
  await a3.goto(`#/s/${STUDENT}/bulletin`); await settle(a3); await shot(a3, 'student-bulletin-360', true);
  await anon360.close();

  const { context: teacher360, t: t3 } = await teacherPage(browser, narrow);
  for (const [name, hash] of [['teacher-bulletin-360', '#/t/bulletin'], ['admin-bulletin-editor-360', '#/t/admin/bulletin'],
    ['admin-info-360', '#/t/admin/info']]) {
    await t3.goto(hash); await settle(t3); await shot(t3, name, true);
  }
  // 학생 명단: 추가 폼의 새 친구 체크, 펼친 줄(고치기 폼)의 새 친구 체크
  await t3.goto('#/t/admin/roster'); await settle(t3);
  await t3.getByRole('button', { name: /한빛나/ }).click(); await settle(t3);
  await shot(t3, 'admin-roster-360', true);
  await teacher360.close();
}
await browser.close();
console.log(`찍었어요: ${outDir}`);
