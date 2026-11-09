// 기도 제목: 학생이 올린 글이 학생 목록·교사 기도 탭에 어떻게 보이는지, 지우기, 한 기기를 같이 쓰는 형제.
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { addDoc, collection, doc, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import { formatMonthDay, toDateId } from '../../src/lib/dates';
import { expectToast, loginAsEmu } from './helpers';
import { clear, seed } from './seed';

const TEACHER = 'teacher@example.com';
const TOKEN_A = 'prayerStudentTokenA_01'; // 22자
const TOKEN_B = 'prayerStudentTokenB_01';
const TODAY = formatMonthDay(toDateId(new Date()));

test.beforeEach(async () => {
  await clear();
  await seed(async (db) => {
    await setDoc(doc(db, 'invites', TEACHER), { name: '김선생', role: 'teacher', classIds: ['classA'] });
    await setDoc(doc(db, 'classes', 'classA'), { name: '1반', grade: 1, order: 1 });
    await setDoc(doc(db, 'classes', 'classB'), { name: '2반', grade: 1, order: 2 });
    await setDoc(doc(db, 'students', TOKEN_A), {
      name: '김하늘', classId: 'classA', birthday: null, active: true, streak: 0, lastPresent: null,
    });
    // 김하늘과 같은 반(한 휴대폰을 같이 쓰는 동생)
    await setDoc(doc(db, 'students', TOKEN_B), {
      name: '김바다', classId: 'classA', birthday: null, active: true, streak: 0, lastPresent: null,
    });
  });
});

/** 학생 기도 탭을 열고 세션이 묶일 때까지(올리기를 누를 수 있을 때까지) 기다린다. */
async function openStudentPrayer(page: Page, token: string): Promise<void> {
  await page.goto(`#/s/${token}/prayer`);
  await expect(page.getByRole('button', { name: '올리기' })).toBeEnabled();
}

async function post(page: Page, text: string, visibility: '우리 반' | '선생님만'): Promise<void> {
  await page.getByLabel('기도 제목').fill(text);
  await page.getByRole('radio', { name: visibility }).check();
  await page.getByRole('button', { name: '올리기' }).click();
  await expectToast(page, visibility === '우리 반' ? '올렸어요' : '선생님께 전했어요');
}

/** 학생 화면 "우리 반 기도 제목"의 한 글. */
const studentRow = (page: Page, text: string) => page.getByRole('listitem').filter({ hasText: text });

// browser 는 워커 내내 살아 있으므로 시험마다 만든 선생님 창을 닫는다
const teacherContexts: BrowserContext[] = [];
test.afterEach(async () => {
  await Promise.all(teacherContexts.splice(0).map((c) => c.close()));
});

/** 선생님은 다른 브라우저(익명 학생 세션과 로그인이 섞이지 않게). */
async function openTeacher(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    viewport: { width: 390, height: 844 },
  });
  teacherContexts.push(ctx);
  const page = await ctx.newPage();
  await loginAsEmu(page, TEACHER, '김선생');
  await page.getByRole('tab', { name: '기도' }).click();
  return page;
}

const section = (page: Page, heading: RegExp) =>
  page.locator('section').filter({ has: page.getByRole('heading', { name: heading }) });
const CLASS_SECTION = /^우리 반에 나눈 기도/;
const PRIVATE_SECTION = /^선생님께만/;

test('학생이 올린 기도 제목이 교사 탭에 보인다', async ({ page, browser }) => {
  await openStudentPrayer(page, TOKEN_A);
  await post(page, '이번 주 시험을\n차분하게 볼 수 있게', '우리 반');
  await expect(studentRow(page, '차분하게 볼 수 있게')).toContainText('내 글');

  const teacher = await openTeacher(browser);
  const mine = section(teacher, CLASS_SECTION);
  const row = mine.getByRole('listitem').filter({ hasText: '차분하게 볼 수 있게' });
  await expect(row).toContainText('김하늘');
  await expect(row).toContainText(TODAY);
  // 줄바꿈을 그대로 보여 준다
  expect(await row.getByText(/이번 주 시험을/).innerText()).toBe('이번 주 시험을\n차분하게 볼 수 있게');
  await expect(section(teacher, PRIVATE_SECTION)).toContainText('선생님께만 보낸 기도가 아직 없어요');
});

test('선생님만 글은 학생 목록에 없고 교사에게만 보인다', async ({ page, browser }) => {
  // 다른 반 글은 이 반 선생님에게 보이지 않는다
  await seed(async (db) => {
    const at = Timestamp.now();
    await addDoc(collection(db, 'prayers'), { authorUid: 'x', studentName: '이별', classId: 'classB', text: '2반 비밀', createdAt: at });
    await addDoc(collection(db, 'classes/classB/prayers'), { authorUid: 'x', studentName: '이별', text: '2반 공개', createdAt: at });
  });

  await openStudentPrayer(page, TOKEN_A);
  await post(page, '할머니 수술이 잘 되게', '선생님만');
  await expect(page.getByText('할머니 수술이 잘 되게')).toHaveCount(0);
  await expect(page.getByText('아직 올라온 기도 제목이 없어요')).toBeVisible();

  const teacher = await openTeacher(browser);
  const priv = section(teacher, PRIVATE_SECTION);
  await expect(priv).toContainText('학생이 선생님께만 보낸 기도예요');
  await expect(priv.getByRole('listitem').filter({ hasText: '할머니 수술이 잘 되게' })).toContainText('김하늘');
  await expect(section(teacher, CLASS_SECTION)).toContainText('아직 나눈 기도 제목이 없어요');
  await expect(teacher.getByText(/2반/)).toHaveCount(0);
});

test('학생이 내 글을 지우면 학생·교사 화면에서 모두 사라진다', async ({ page, browser }) => {
  await openStudentPrayer(page, TOKEN_A);
  await post(page, '친구와 화해하게', '우리 반');
  const row = studentRow(page, '친구와 화해하게');
  await row.getByRole('button', { name: '삭제' }).click();
  await row.getByRole('button', { name: '삭제하기' }).click();
  await expectToast(page, '삭제했어요');
  await expect(page.getByText('친구와 화해하게')).toHaveCount(0);

  const teacher = await openTeacher(browser);
  await expect(section(teacher, CLASS_SECTION)).toContainText('아직 나눈 기도 제목이 없어요');
  await expect(teacher.getByText('친구와 화해하게')).toHaveCount(0);
});

test('교사가 지운 글은 학생 목록에서도 사라진다', async ({ page, browser }) => {
  await openStudentPrayer(page, TOKEN_A);
  await post(page, '수련회에 같이 가게', '우리 반');
  await post(page, '집에 걱정이 있어요', '선생님만');

  const teacher = await openTeacher(browser);
  const classRow = section(teacher, CLASS_SECTION).getByRole('listitem').filter({ hasText: '수련회에 같이 가게' });
  // 취소하면 그대로
  await classRow.getByRole('button', { name: '삭제' }).click();
  await classRow.getByRole('button', { name: '취소' }).click();
  await expect(classRow).toBeVisible();
  await classRow.getByRole('button', { name: '삭제' }).click();
  await classRow.getByRole('button', { name: '삭제하기' }).click();
  await expectToast(teacher, '삭제했어요');
  await expect(section(teacher, CLASS_SECTION)).toContainText('아직 나눈 기도 제목이 없어요');

  // 선생님께만 글도 지울 수 있다
  const privRow = section(teacher, PRIVATE_SECTION).getByRole('listitem').filter({ hasText: '집에 걱정이 있어요' });
  await privRow.getByRole('button', { name: '삭제' }).click();
  await privRow.getByRole('button', { name: '삭제하기' }).click();
  await expect(section(teacher, PRIVATE_SECTION)).toContainText('선생님께만 보낸 기도가 아직 없어요');

  await expect(studentRow(page, '수련회에 같이 가게')).toBeVisible();
  await page.reload();
  await expect(page.getByText('아직 올라온 기도 제목이 없어요')).toBeVisible();
  await expect(page.getByText('수련회에 같이 가게')).toHaveCount(0);
});

test('한 휴대폰을 같이 쓰는 형제: 동생 링크에서는 형의 글이 "내 글"이 아니다', async ({ page }) => {
  await openStudentPrayer(page, TOKEN_A);
  await post(page, '형의 기도', '우리 반');
  await expect(studentRow(page, '형의 기도')).toContainText('내 글');

  // 같은 브라우저(같은 기기)에서 동생 링크
  await openStudentPrayer(page, TOKEN_B);
  await expect(page.getByText('김바다')).toBeVisible();
  const brother = studentRow(page, '형의 기도');
  await expect(brother).toBeVisible();
  await expect(brother).not.toContainText('내 글');
  await expect(brother.getByRole('button', { name: '삭제' })).toHaveCount(0);

  await post(page, '동생의 기도', '우리 반');
  await expect(studentRow(page, '동생의 기도')).toContainText('내 글');
  await expect(studentRow(page, '형의 기도')).not.toContainText('내 글');

  // 세션이 둘: 형·동생이 서로 다른 익명 uid
  let sessions: { uid: string; token: string }[] = [];
  await seed(async (db) => {
    const snap = await getDocs(collection(db, 'studentSessions'));
    sessions = snap.docs.map((d) => ({ uid: d.id, token: String(d.data().token) }));
  });
  expect(sessions.map((x) => x.token).sort()).toEqual([TOKEN_A, TOKEN_B].sort());
  expect(new Set(sessions.map((x) => x.uid)).size).toBe(2);
});
