import { expect, test, type Page } from '@playwright/test';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { addDays, nearestSunday, toDateId } from '../../src/lib/dates';
import { closeStudents, expectAnonymousStudent, expectToast, loginAsEmu, openStudent } from './helpers';
import { clear, seed, seedAdmin } from './seed';

const ADMIN = 'admin@example.com';
const TOKEN = 'testStudentToken_00001'; // 22자
const CLASS_ID = 'classA';

// 앱과 같은 규칙으로 "이번 주" 주일을 잡는다
const SUNDAY = nearestSunday(new Date());
const THIS_SUNDAY = toDateId(SUNDAY);

const SERMON_TITLE = '두려움 대신 믿음으로';
const SUMMARY = '폭풍 속에서도 예수님은 우리와 같은 배에 계세요.';
const HYMN = '찬송가 288장 예수를 나의 구주 삼고';
const ANNOUNCEMENT = '중등부 겨울 수련회 신청';

async function seedStudent(): Promise<void> {
  await seed(async (db) => {
    await setDoc(doc(db, 'classes', CLASS_ID), { name: '1학년 1반', grade: 1, order: 1 });
    await setDoc(doc(db, 'students', TOKEN), {
      name: '김하늘', classId: CLASS_ID, birthday: null, active: true, streak: 0, lastPresent: null,
    });
  });
}

test.afterEach(closeStudents);

test.beforeEach(async () => {
  await clear();
  await seedAdmin(ADMIN);
  await seedStudent();
});

test('학생이 이번 주 주보·설교·광고를 본다', async ({ page }) => {
  await seed(async (db) => {
    await setDoc(doc(db, 'bulletins', THIS_SUNDAY), {
      date: THIS_SUNDAY,
      order: [
        { type: '묵도', title: '', detail: '' },
        { type: '기도', title: '대표기도', detail: '박은혜 선생님' },
        { type: '설교', title: '', detail: '' },
      ],
      hymns: [HYMN],
      scripture: '마가복음 4:35-41',
      sermonTitle: SERMON_TITLE,
      published: true,
      updatedBy: 'admin',
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'sermons', THIS_SUNDAY), {
      date: THIS_SUNDAY,
      title: SERMON_TITLE,
      scripture: '마가복음 4:35-41',
      summary: SUMMARY,
      body: '제자들은 바람을 보고 무서워했어요.\n\n예수님은 "잠잠하라" 하셨어요.',
      questions: ['요즘 내가 무서워하는 것은 무엇인가요?'],
    });
    await setDoc(doc(db, 'announcements', 'a1'), {
      title: ANNOUNCEMENT,
      body: '12월 7일까지 반 선생님께 신청해 주세요.',
      startDate: toDateId(addDays(SUNDAY, -3)),
      endDate: toDateId(addDays(SUNDAY, 3)),
      pinned: false,
      createdAt: serverTimestamp(),
    });
  });

  await page.goto(`#/s/${TOKEN}`);

  // 홈: 이번 주 주보 요약 카드와 광고
  await expect(page.getByRole('heading', { name: SERMON_TITLE })).toBeVisible();
  await expect(page.getByText(ANNOUNCEMENT)).toBeVisible();

  // 주보: 세 칸 순서표(순서 | 내용 | 맡은 사람)와 찬양
  await page.getByRole('tab', { name: '주보' }).click();
  await expect(page.getByRole('tab', { name: '주보' })).toHaveAttribute('aria-selected', 'true');
  const rows = page.getByRole('table', { name: '예배 순서' }).locator('tbody').getByRole('row');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(1)).toContainText('기도');
  await expect(rows.nth(1)).toContainText('대표기도');
  await expect(rows.nth(1)).toContainText('박은혜 선생님');
  await expect(page.getByRole('region', { name: '찬양' }).getByText(HYMN)).toBeVisible();
  // 빈 설교 줄은 설교 제목으로 채워지고, 그 제목이 말씀 화면으로 가는 링크
  await expect(rows.nth(2).getByRole('link', { name: SERMON_TITLE })).toBeVisible();
  // 순서표에 성경봉독 줄이 없으니 본문은 말씀 구역에 남는다(설교는 순서표에 나왔으므로 빠진다)
  const word = page.getByRole('region', { name: '말씀' });
  await expect(word).toContainText('마가복음 4:35-41');
  await expect(word).not.toContainText(SERMON_TITLE);

  // 말씀: 목록 → 상세(요약·적용 질문)
  await page.getByRole('tab', { name: '말씀' }).click();
  await page.getByRole('link', { name: new RegExp(SERMON_TITLE) }).click();
  await expect(page.getByText(SUMMARY)).toBeVisible();
  await expect(page.getByText('요즘 내가 무서워하는 것은 무엇인가요?')).toBeVisible();
});

test('주보 없는 주 안내', async ({ page }) => {
  await page.goto(`#/s/${TOKEN}`);
  await expect(page.getByText('이번 주 주보가 아직 없어요')).toBeVisible();
  await expect(page.getByRole('tab', { name: '홈' })).toHaveAttribute('aria-selected', 'true');
});

// ---------- 관리자 편집 (주보·설교·광고) ----------

const WALK = '함께 걷는 길';

/** 관리 메뉴에서 화면 하나를 연다(`#/t/admin/{화면}`). */
async function openAdmin(page: Page, name: string): Promise<void> {
  await page.getByRole('tab', { name: '관리' }).click();
  await page.getByRole('link', { name: new RegExp(`^${name}`) }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

test('관리자가 주보를 게시하면 학생 홈에 보인다', async ({ page, browser }) => {
  await loginAsEmu(page, ADMIN, '관리자');

  // 설교 먼저: 제목·본문·질문
  await openAdmin(page, '설교 작성');
  await page.getByLabel('설교 제목').fill(WALK);
  await page.getByLabel('성경 본문').fill('누가복음 24:13-35');
  await page.getByLabel('한 줄 요약').fill('엠마오로 가는 길에 예수님이 함께 걸으셨어요.');
  await page.getByLabel('적용 질문 1').fill('이번 주 누구와 함께 걸을까요?');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expectToast(page, '설교를 저장했어요');

  // 주보: 템플릿 순서로 시작, 설교 제목은 설교에서 가져오기 → 게시
  await page.getByRole('link', { name: '관리 메뉴' }).click();
  await page.getByRole('link', { name: /^주보 작성/ }).click();
  await expect(page.getByLabel('1번 순서 이름', { exact: true })).toHaveValue('경배와 찬양');
  await page.getByRole('button', { name: '설교 제목 가져오기' }).click();
  await expect(page.getByLabel('설교 제목')).toHaveValue(WALK);
  await page.getByRole('button', { name: /찬양 목록 고치기/ }).click();
  await page.getByLabel('찬양 1').fill(HYMN);
  await page.getByRole('button', { name: '게시', exact: true }).click();
  await expectToast(page, '게시했어요');
  await expect(page.getByText('방금 게시')).toBeVisible();

  const { page: student } = await openStudent(browser, `#/s/${TOKEN}`);
  await expect(student.getByRole('heading', { name: WALK })).toBeVisible();
  await student.getByRole('tab', { name: '주보' }).click();
  await expect(student.getByText(HYMN)).toBeVisible();
  await student.getByRole('tab', { name: '말씀' }).click();
  await student.getByRole('link', { name: new RegExp(WALK) }).click();
  await expect(student.getByText('이번 주 누구와 함께 걸을까요?')).toBeVisible();
});

test('임시저장 주보는 학생에게 안 보인다', async ({ page, browser }) => {
  await loginAsEmu(page, ADMIN, '관리자');
  await openAdmin(page, '주보 작성');
  await page.getByLabel('설교 제목').fill('아직 비밀인 제목');
  await page.getByRole('button', { name: '초안 저장', exact: true }).click();
  await expectToast(page, '초안을 저장했어요');

  // 규칙이 임시저장 주보 읽기를 막고(getBulletin → null), 학생 화면은 "없음" 안내
  const { page: student } = await openStudent(browser, `#/s/${TOKEN}`);
  await expect(student.getByText('이번 주 주보가 아직 없어요')).toBeVisible();
  await expect(student.getByText('아직 비밀인 제목')).toHaveCount(0);
  await student.getByRole('tab', { name: '주보' }).click();
  await expect(student.getByText('이번 주 주보가 아직 없어요')).toBeVisible();
  await expectAnonymousStudent(student);

  // 새 계약: 관리자 작성 화면에서 초안을 다시 열고, 읽기 탭에는 아직 나오지 않는다.
  await page.reload();
  await expect(page.getByText('초안', { exact: true })).toBeVisible();
  await expect(page.getByLabel('설교 제목')).toHaveValue('아직 비밀인 제목');
  await page.getByRole('tab', { name: '주보' }).click();
  await expect(page.getByText('이번 주 주보가 아직 없어요')).toBeVisible();
  await expect(page.getByText('아직 비밀인 제목')).toHaveCount(0);
});

test('광고 종료일이 지나면 주보 광고란에 없다', async ({ page, browser }) => {
  await seed((db) => setDoc(doc(db, 'bulletins', THIS_SUNDAY), {
    date: THIS_SUNDAY, order: [{ type: '설교', title: WALK, detail: '' }], hymns: [], scripture: '',
    sermonTitle: WALK, published: true, updatedBy: 'admin', updatedAt: serverTimestamp(),
  }));
  await loginAsEmu(page, ADMIN, '관리자');
  await openAdmin(page, '광고');

  const form = page.getByRole('form', { name: '새 광고' });
  // 지난 주일 하루만 하던 광고(끝남)
  await form.getByLabel('제목').fill('지난 행사 광고');
  await form.getByRole('group', { name: '시작' }).getByRole('button', { name: '지난 주일' }).click();
  await form.getByRole('group', { name: '끝' }).getByRole('button', { name: '지난 주일' }).click();
  await form.getByRole('button', { name: '광고 추가' }).click();
  await expectToast(page, '광고를 추가했어요');
  await expect(page.getByRole('button', { name: /^지난 행사 광고/ })).toContainText('끝남');

  // 이번 주일 광고(기본 날짜 = 이번 주일)
  await form.getByLabel('제목').fill('이번 주 광고');
  await form.getByLabel('내용').fill('예배 뒤 다 같이 점심 먹어요.');
  await form.getByRole('button', { name: '광고 추가' }).click();
  await expectToast(page, '광고를 추가했어요');
  await expect(page.getByRole('button', { name: /^이번 주 광고/ })).toContainText('진행 중');

  const { page: student } = await openStudent(browser, `#/s/${TOKEN}/bulletin`);
  await expect(student.getByText('예배 뒤 다 같이 점심 먹어요.')).toBeVisible();
  await expect(student.getByText('이번 주 광고', { exact: true })).toBeVisible();
  await expect(student.getByText('지난 행사 광고')).toHaveCount(0);
});

test('주보 편집: 저장 안 한 내용은 날짜·메뉴 이동 전에 묻고, 새로고침해도 복구된다', async ({ page }) => {
  await loginAsEmu(page, ADMIN, '관리자');
  await openAdmin(page, '주보 작성');
  const title = page.getByLabel('설교 제목');
  await title.fill('쓰다 만 제목');

  // 날짜를 옮기려 하면 그 자리에서 묻는다 → 계속 쓰기
  const stepper = page.getByRole('group', { name: '주보 날짜' });
  const dateText = await stepper.getByRole('status').textContent();
  await stepper.getByRole('button', { name: '다음 주일' }).click();
  await expect(page.getByText('저장하지 않은 내용이 있어요')).toBeVisible();
  await expect(stepper.getByRole('status')).toHaveText(dateText!);
  await page.getByRole('button', { name: '계속 쓰기' }).click();
  await expect(title).toHaveValue('쓰다 만 제목');

  // 탭 바로 나가려 해도 묻는다
  await page.getByRole('tab', { name: '출석' }).click();
  await expect(page.getByText('저장하지 않은 내용이 있어요')).toBeVisible();
  await page.getByRole('button', { name: '계속 쓰기' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '주보 작성' })).toBeVisible();

  // 새로고침(앱이 꺼진 셈) → 이 탭의 sessionStorage 에서 복구
  await page.reload();
  await expect(page.getByText('저장 안 된 내용을 복구했어요')).toBeVisible();
  await expect(title).toHaveValue('쓰다 만 제목');

  // 저장하면 복구본은 지워진다
  await page.getByRole('button', { name: '초안 저장', exact: true }).click();
  await expectToast(page, '초안을 저장했어요');
  await page.reload();
  await expect(title).toHaveValue('쓰다 만 제목');
  await expect(page.getByText('저장 안 된 내용을 복구했어요')).toHaveCount(0);

  // 다시 고치고 관리 메뉴로 → 저장하지 않고 이동
  await title.fill('버릴 제목');
  await page.getByRole('link', { name: '관리 메뉴' }).click();
  await expect(page.getByText('저장하지 않은 내용이 있어요')).toBeVisible();
  await page.getByRole('button', { name: '저장하지 않고 이동' }).click();
  await expect(page.getByRole('navigation', { name: '관리 메뉴' })).toBeVisible();
  await page.getByRole('link', { name: /^주보 작성/ }).click();
  await expect(title).toHaveValue('쓰다 만 제목');
});

test('주보 편집: 저장이 늦게 끝나도 그 사이 고친 내용은 남고, 날짜 이동 확인은 닫힌다', async ({ page, context }) => {
  await loginAsEmu(page, ADMIN, '관리자');
  await openAdmin(page, '주보 작성');
  const title = page.getByLabel('설교 제목');
  await title.fill('보낸 제목');

  // 날짜를 옮기려다 확인이 열린 채로 저장한다
  await page.getByRole('group', { name: '주보 날짜' }).getByRole('button', { name: '다음 주일' }).click();
  await expect(page.getByText('저장하지 않은 내용이 있어요')).toBeVisible();

  // 오프라인: 저장은 서버에 닿을 때까지 끝나지 않는다. 그동안 더 고친다
  await context.setOffline(true);
  await page.getByRole('button', { name: '초안 저장', exact: true }).click();
  await title.fill('보낸 뒤 더 고친 제목');
  await context.setOffline(false);
  await expect(page.getByRole('status').filter({ hasText: '초안을 저장했어요' })).toHaveCount(1, { timeout: 20000 });

  // 더 고친 내용은 남고 여전히 "저장 안 한 내용", 날짜 이동 확인은 닫혔다
  await expect(title).toHaveValue('보낸 뒤 더 고친 제목');
  await expect(page.getByText('저장 안 한 내용이 있어요')).toBeVisible();
  await expect(page.getByText('저장하지 않은 내용이 있어요')).toHaveCount(0);

  // 복구본도 더 고친 내용으로 남아 있다
  await page.reload();
  await expect(page.getByText('저장 안 된 내용을 복구했어요')).toBeVisible();
  await expect(title).toHaveValue('보낸 뒤 더 고친 제목');
});

test('주보 편집: 모양이 깨진 복구본은 버리고 저장된 내용으로 연다', async ({ page }) => {
  await loginAsEmu(page, ADMIN, '관리자');
  await page.evaluate((d) => {
    sessionStorage.setItem(`jdb:draft:bulletin:${d}`, JSON.stringify({ order: null, sermonTitle: 3 }));
  }, THIS_SUNDAY);
  await openAdmin(page, '주보 작성');
  await expect(page.getByLabel('1번 순서 이름', { exact: true })).toHaveValue('경배와 찬양');
  await expect(page.getByText('저장 안 된 내용을 복구했어요')).toHaveCount(0);
});
