// 종이 주보와 같은 보는 화면: 세 칸 순서표, 예배위원·출석·새 친구·생일, 중등부 안내 카드.
// 새 친구·생일·섬기는 분들·연락처는 잠긴 문서라 학생 세션이 준비된 뒤에만 보인다.
import { expect, test } from '@playwright/test';
import { doc, setDoc } from 'firebase/firestore';
import { addDays, nearestSunday, toDateId } from '../../src/lib/dates';
import { closeStudents, loginAsEmu, openStudent } from './helpers';
import { clear, seed, seedAdmin } from './seed';

const ADMIN = 'admin@example.com';
const TOKEN = 'testStudentToken_00004'; // 22자
const CLASS_ID = 'classA';

// 앱과 같은 규칙으로 "이번 주" 주일을 잡는다
const SUNDAY = nearestSunday(new Date());
const THIS_SUNDAY = toDateId(SUNDAY);
const LAST_SUNDAY = toDateId(addDays(SUNDAY, -7));

const SERMON_TITLE = '지금의 자리에서 감사';
const SCRIPTURE = '누가복음 17장 11-19절';

const FULL_BULLETIN = {
  date: THIS_SUNDAY, published: true, updatedBy: 'seed', updatedAt: new Date(),
  issue: '2026-41호', leader: '정한결 선생님',
  opening: { text: '하나님은 영이시니 예배하는 자가 영과 진리로 예배할지니라', ref: '요 4:24' },
  order: [
    { type: '경배와 찬양', title: '', detail: '리조이스 찬양팀' },
    { type: '신앙고백', title: '사도신경', detail: '다함께', standing: true },
    { type: '성경봉독', title: '', detail: '다함께' },
    { type: '설교', title: '', detail: '이승열 목사님' },
  ],
  hymns: [], scripture: SCRIPTURE, sermonTitle: SERMON_TITLE,
  nextServers: [{ role: '인도', name: '한가람 학생' }, { role: '기도', name: '서다온 학생' }],
  attendance: {
    sunday: LAST_SUNDAY, classes: [{ name: '1-1', present: 5, total: 8 }],
    students: { present: 33, total: 55 }, teachers: { present: 13, total: 15 },
  },
};

async function seedFull(): Promise<void> {
  await seed(async (db) => {
    await setDoc(doc(db, 'bulletins', THIS_SUNDAY), FULL_BULLETIN);
    await setDoc(doc(db, 'sermons', THIS_SUNDAY), {
      date: THIS_SUNDAY, title: SERMON_TITLE, scripture: SCRIPTURE,
      summary: '감사는 지금 있는 자리에서 시작돼요.', body: '열 명이 나았지만 한 명만 돌아왔어요.', questions: [],
    });
    await setDoc(doc(db, 'bulletins', THIS_SUNDAY, 'members', 'main'), {
      newFriends: ['윤새봄', '문하람'], birthdays: [{ name: '김하늘', date: '11-20' }],
    });
    await setDoc(doc(db, 'settings', 'info'), {
      motto: {
        title: '동행하는 자', subtitle: '하나님과 동행하며 내 이웃과 동행하는 사람',
        verse: '사람아 주께서 선한 것이 무엇임을 네게 보이셨나니', ref: '미가 6:8',
      },
      etiquette: ['예배시작은 9:30이며, 9:15부터 찬양이 시작됩니다.'],
      place: { name: '명지대학교교회', address: '서울 서대문구', mapUrl: 'https://example.com/map' },
      churchPhone: '02-303-2501',
    });
    await setDoc(doc(db, 'memberInfo', 'main'), {
      servants: [{ role: '담당', names: '이승열 목사' }],
      contacts: [{ label: '이승열 목사님', phone: '010-0000-0000' }],
    });
  });
}

test.afterEach(closeStudents);

test.beforeEach(async () => {
  await clear();
  await seedAdmin(ADMIN);
  await seed(async (db) => {
    await setDoc(doc(db, 'classes', CLASS_ID), { name: '1학년 1반', grade: 1, order: 1 });
    await setDoc(doc(db, 'students', TOKEN), {
      name: '김하늘', classId: CLASS_ID, birthday: null, active: true, streak: 0, lastPresent: null,
    });
  });
});

test('학생 주보: 종이 주보와 같은 순서표와 덧붙임이 보인다', async ({ browser }) => {
  await seedFull();
  const { page } = await openStudent(browser, `#/s/${TOKEN}/bulletin`);

  await expect(page.getByRole('heading', { name: '예배 순서', exact: true })).toBeVisible();
  await expect(page.getByText('2026-41호')).toBeVisible();
  await expect(page.getByText('인도: 정한결 선생님')).toBeVisible();
  await expect(page.getByText(/요 4:24/)).toBeVisible();

  // 순서표: 4줄, 둘째 줄은 일어서는 순서
  const order = page.getByRole('table', { name: '예배 순서' });
  const rows = order.locator('tbody').getByRole('row');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(1)).toContainText('일어서서');
  await expect(rows.nth(1)).toContainText('사도신경');
  await expect(rows.nth(1)).toContainText('다함께');
  await expect(rows.nth(0)).toContainText('리조이스 찬양팀');
  await expect(page.getByText('* 표가 있는 순서에는 함께 일어서요.')).toBeVisible();

  // 설교 줄 안의 설교 링크, 성경봉독 줄의 본문
  await expect(rows.nth(3).getByRole('link', { name: SERMON_TITLE })).toBeVisible();
  await expect(rows.nth(3)).toContainText('이승열 목사님');
  await expect(rows.nth(2)).toContainText(SCRIPTURE);
  // 순서표에 다 나왔으므로 말씀 구역은 없다
  await expect(page.getByRole('heading', { name: '말씀' })).toHaveCount(0);

  await expect(page.getByRole('heading', { name: '다음 주 예배위원' })).toBeVisible();
  await expect(page.getByText('한가람 학생')).toBeHidden();
  await page.locator('summary').filter({ hasText: '다음 주 예배위원' }).click();
  await expect(page.getByText('한가람 학생')).toBeVisible();
  await expect(page.getByRole('heading', { name: '지난 주 함께한 인원' })).toBeVisible();
  await expect(page.getByText('학생 33 / 55명')).toBeVisible();
  await expect(page.getByText('교사 13 / 15명')).toBeVisible();
  await expect(page.getByText('1-1', { exact: true })).toBeHidden();
  await page.locator('summary').filter({ hasText: '반별 인원 보기' }).click();
  await expect(page.getByText('1-1', { exact: true })).toBeVisible();
  await expect(page.getByRole('table', { name: '반별 출석' }).getByRole('row', { name: '1-1 5명 8명' })).toBeVisible();

  // 잠긴 구역: 세션이 준비되면 나타난다
  await expect(page.getByRole('heading', { name: '새 친구' })).toBeVisible();
  await expect(page.getByText('윤새봄')).toBeVisible();
  // 생일 구역의 이름(학생 이름이 화면 머리에도 있어서 구역 안에서 찾는다)
  const birthdays = page.getByRole('region', { name: '이번 달 생일' });
  await expect(birthdays).toBeVisible();
  await expect(birthdays.getByText('김하늘')).toBeVisible();
  await expect(birthdays).toContainText('11월 20일');

  // 중등부 안내
  await expect(page.getByRole('heading', { name: '중등부 안내' })).toBeVisible();
  await expect(page.getByText('동행하는 자')).toBeVisible();
  await page.locator('summary').filter({ hasText: '섬기는 분들' }).click();
  await expect(page.getByText('담당', { exact: true })).toBeVisible();
  await expect(page.getByText('이승열 목사', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '지도 보기' })).toHaveAttribute('href', 'https://example.com/map');
  await expect(page.getByRole('link', { name: /02-303-2501/ })).toHaveAttribute('href', 'tel:023032501');
  await page.locator('summary').filter({ hasText: '선생님 연락처' }).click();
  await expect(page.getByRole('link', { name: /010-0000-0000/ })).toBeVisible();
});

test('세션을 못 만든 기기: 잠긴 구역만 빠지고 나머지는 보인다', async ({ browser }) => {
  await seedFull();
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    viewport: { width: 390, height: 844 },
  });
  try {
    await context.route('**/identitytoolkit.googleapis.com/**', (r) => r.abort());
    await context.route('**/127.0.0.1:9099/**', (r) => r.abort()); // Auth 에뮬레이터
    const page = await context.newPage();
    await page.goto(`#/s/${TOKEN}/bulletin`);
    await expect(page.getByRole('heading', { name: '예배 순서', exact: true })).toBeVisible();

    // 세션이 정말 실패했는지 기도 탭에서 확인한다(failed 면 올리기를 누를 수 있다)
    await page.getByRole('tab', { name: '기도' }).click();
    await expect(page.getByRole('button', { name: '올리기' })).toBeEnabled({ timeout: 12000 });
    await page.getByRole('tab', { name: '주보' }).click();

    await expect(page.getByRole('heading', { name: '예배 순서', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '지난 주 함께한 인원' })).toBeVisible();
    await expect(page.getByText(/02-303-2501/)).toBeVisible();
    await expect(page.getByRole('heading', { name: '새 친구' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '이번 달 생일' })).toHaveCount(0);
    await expect(page.getByText('010-0000-0000')).toHaveCount(0);
    await expect(page.getByText('섬기는 분들')).toHaveCount(0);
    // 오류 카드 없음
    await expect(page.getByText('불러오지 못했어요')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /다시 시도|다시 불러오기/ })).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('선생님 주보 탭에서도 같은 내용이 보인다', async ({ page }) => {
  await seedFull();
  await loginAsEmu(page, ADMIN, '관리자');
  await page.getByRole('tab', { name: '주보' }).click();
  await expect(page.getByRole('heading', { name: '예배 순서', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '새 친구' })).toBeVisible();
  await expect(page.getByText('윤새봄')).toBeVisible();
  await page.locator('summary').filter({ hasText: '선생님 연락처' }).click();
  await expect(page.getByText(/010-0000-0000/)).toBeVisible();
});

test('비어 있는 덧붙임은 구역을 그리지 않는다', async ({ browser }) => {
  await seed((db) => setDoc(doc(db, 'bulletins', THIS_SUNDAY), {
    ...FULL_BULLETIN,
    issue: '', leader: '', opening: { text: '', ref: '' }, nextServers: [], attendance: null,
    order: [{ type: '설교', title: '', detail: '' }],
  }));
  const { page } = await openStudent(browser, `#/s/${TOKEN}/bulletin`);
  await expect(page.getByRole('heading', { name: '예배 순서', exact: true })).toBeVisible();
  await expect(page.getByRole('table', { name: '예배 순서' }).getByText(SERMON_TITLE)).toBeVisible();
  await expect(page.getByText('다음 주 예배위원')).toHaveCount(0);
  await expect(page.getByText('지난 주 함께한 인원')).toHaveCount(0);
  await expect(page.getByText('새 친구')).toHaveCount(0);
  await expect(page.getByText('이번 달 생일')).toHaveCount(0);
  await expect(page.getByText('중등부 안내')).toHaveCount(0);
  await expect(page.getByText('인도:')).toHaveCount(0);
  await expect(page.getByText('* 표가 있는 순서에는 함께 일어서요.')).toHaveCount(0);
});

test('360px 다크 모드에서도 세 열을 읽고 키보드로 지난 주보를 펼친다', async ({ browser }) => {
  await seedFull();
  await seed((db) => setDoc(doc(db, 'bulletins', LAST_SUNDAY), { ...FULL_BULLETIN, date: LAST_SUNDAY, sermonTitle: '함께 걷는 한 주' }));
  const { page } = await openStudent(browser, `#/s/${TOKEN}/bulletin`);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  const table = page.getByRole('table', { name: '예배 순서' });
  await expect(table).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  const cells = await table.locator('tbody tr').first().locator('th,td').evaluateAll((els) => els.map((el) => {
    const box = el.getBoundingClientRect();
    return { x: box.x, right: box.right, width: box.width };
  }));
  expect(cells).toHaveLength(3);
  expect(cells[0].width).toBeGreaterThan(0);
  expect(cells[1].x).toBeGreaterThanOrEqual(cells[0].right);
  expect(cells[2].x).toBeGreaterThanOrEqual(cells[1].right);
  expect(cells[2].right).toBeLessThanOrEqual(360);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);

  // 구역 이동은 앱의 hash 경로를 바꾸지 않고 초점을 옮긴다.
  const route = page.url();
  await page.getByRole('button', { name: '중등부 안내', exact: true }).click();
  await expect(page.getByRole('region', { name: '중등부 안내', exact: true })).toBeFocused();
  expect(page.url()).toBe(route);

  const archive = page.locator('summary').filter({ hasText: '지난 주보' });
  const last = page.getByRole('link', { name: /함께 걷는 한 주/ });
  await expect(last).toBeHidden();
  await archive.focus();
  await page.keyboard.press('Enter');
  await expect(last).toBeVisible();
  await last.click();
  await expect(page.getByRole('link', { name: '이번 주 주보', exact: true })).toBeVisible();
  await expect(page.getByRole('table', { name: '예배 순서' })).toContainText('함께 걷는 한 주');
});
