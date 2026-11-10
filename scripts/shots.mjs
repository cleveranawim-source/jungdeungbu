// 디자인 점검용 스크린샷: 주요 화면을 390×844, 밝은·어두운 모드로 찍는다.
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

async function seedAll() {
  const env = await initializeTestEnvironment({ projectId: 'demo-jungdeungbu', firestore: { host: '127.0.0.1', port: 8080 } });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const put = (path, data) => setDoc(doc(db, path), data);
    await put(`invites/${ADMIN}`, { name: '이승열', role: 'admin', classIds: [] });
    await put('classes/classA', { name: '1학년 1반', grade: 1, order: 1 });
    await put('classes/classB', { name: '1학년 2반', grade: 1, order: 2 });
    const names = [['김하늘', `${pad(sunday.getMonth() + 1)}-${pad(sunday.getDate())}`, 8], ['이바다', '03-05', 0], ['박별', '07-21', 4], ['최하람', null, 1], ['정새벽', '12-24', 2], ['한빛나', null, 0]];
    for (const [i, [name, birthday, streak]] of names.entries()) {
      const token = i === 0 ? STUDENT : `shotStudent${String.fromCharCode(66 + i)}0000000000`;
      await put(`students/${token}`, { name, classId: 'classA', birthday, active: true, streak, lastPresent: streak ? SUN : null });
      for (let w = 0; w < streak; w++) await put(`students/${token}/attendance/${ago(w)}`, { date: ago(w), present: true, by: 'seed', at: Timestamp.now() });
    }
    await put(`bulletins/${SUN}`, {
      date: SUN, published: true, scripture: '마가복음 4:35-41', sermonTitle: '두려움 대신 믿음으로',
      hymns: ['주 안에 있는 나에게', '내 주를 가까이 하게 함은'],
      order: [
        { type: '묵도', title: '', detail: '다같이' }, { type: '찬양', title: '', detail: '찬양팀' },
        { type: '기도', title: '', detail: '김선생님' }, { type: '성경 봉독', title: '마가복음 4:35-41', detail: '' },
        { type: '설교', title: '두려움 대신 믿음으로', detail: '이승열 목사' }, { type: '헌금', title: '', detail: '' },
        { type: '광고', title: '', detail: '' }, { type: '주기도문', title: '', detail: '다같이' },
      ],
      updatedBy: 'seed', updatedAt: Timestamp.now(),
    });
    await put(`sermons/${SUN}`, {
      date: SUN, title: '두려움 대신 믿음으로', scripture: '마가복음 4:35-41',
      summary: '풍랑 속에서도 예수님은 배 안에 계셨어요.',
      body: '제자들은 거센 바람 앞에서 두려워했어요. 그런데 예수님은 같은 배 안에 계셨지요.\n\n이번 주, 내 마음의 풍랑을 주님께 맡겨 봐요. 두려움이 사라지지 않아도, 함께 계신 분을 기억하면 다시 일어설 수 있어요.',
      questions: ['요즘 나를 흔드는 풍랑은 무엇인가요?', '그 일을 주님께 어떻게 맡길 수 있을까요?'],
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

await seedAll();
const browser = await chromium.launch();
for (const scheme of ['light', 'dark']) {
  const opts = { viewport: { width: 390, height: 844 }, colorScheme: scheme, deviceScaleFactor: 2, baseURL: base };
  const shot = (p, name) => p.screenshot({ path: `${outDir}/${name}-${scheme}.png` });

  const anon = await browser.newContext(opts);
  const a = await anon.newPage();
  await a.goto('#/'); await settle(a); await shot(a, 'landing');
  await a.goto('#/s/abc'); await settle(a); await shot(a, 'invalid');
  for (const tab of ['home', 'bulletin', 'sermon', 'prayer', 'me']) {
    await a.goto(`#/s/${STUDENT}/${tab}`); await settle(a); await shot(a, `student-${tab}`);
  }
  await anon.close();

  const teacher = await browser.newContext(opts);
  const t = await teacher.newPage();
  await t.goto('#/t');
  await t.getByLabel('이메일').fill(ADMIN);
  await t.getByLabel('이름').fill('이승열');
  await t.getByRole('button', { name: '에뮬레이터 로그인' }).click();
  await t.getByRole('tablist', { name: '교사 메뉴' }).waitFor();
  for (const [name, hash] of [['teacher-attendance', '#/t/attendance'], ['teacher-class', '#/t/class'], ['teacher-prayer', '#/t/prayer'],
    ['teacher-bulletin', '#/t/bulletin'], ['admin-menu', '#/t/admin'], ['admin-bulletin-editor', '#/t/admin/bulletin'],
    ['admin-roster', '#/t/admin/roster'], ['admin-stats', '#/t/admin/attendance']]) {
    await t.goto(hash); await settle(t); await shot(t, name);
  }
  await teacher.close();
}
await browser.close();
console.log(`찍었어요: ${outDir}`);
