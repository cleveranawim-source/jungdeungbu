import { expect, test, type Page } from '@playwright/test';
import { doc, setDoc } from 'firebase/firestore';
import { closeStudents, expectToast, loginAsEmu, openStudent } from './helpers';
import { clear, seed, seedAdmin } from './seed';
const ADMIN = 'draft-admin@example.com';
const TOKEN = 'testStudentToken_00081';
const BEFORE = '함께 걷던 길';
const AFTER = '새롭게 걷는 길';
test.afterEach(closeStudents);
test.beforeEach(async () => {
  await clear();
  await seedAdmin(ADMIN);
  await seed(async (db) => {
    await setDoc(doc(db, 'classes', 'draftClass'), { name: '1-1', grade: 1, order: 1 });
    await setDoc(doc(db, 'students', TOKEN), {
      name: '서로운',
      classId: 'draftClass',
      birthday: null,
      active: true,
      streak: 0,
      lastPresent: null,
    });
  });
});
async function editor(page: Page) {
  await loginAsEmu(page, ADMIN, '담당');
  await page.getByRole('tab', { name: '관리' }).click();
  await page.getByRole('link', { name: /^주보 작성/ }).click();
  await expect(page.getByLabel('설교 제목')).toBeVisible();
}
async function published(page: Page) {
  await editor(page);
  await page.getByLabel('설교 제목').fill(BEFORE);
  await page.getByRole('button', { name: '게시', exact: true }).click();
  await expectToast(page, '게시했어요');
}
async function draft(page: Page) {
  await page.getByLabel('설교 제목').fill(AFTER);
  await page.getByRole('button', { name: '초안 저장', exact: true }).click();
  await expectToast(page, '초안을 저장했어요');
}
async function more(page: Page) {
  await page.getByRole('button', { name: '게시 관리', exact: true }).click();
}
test('게시본은 초안 저장 뒤에도 그대로이고, 다시 게시해야 새 내용이 보인다', async ({
  page,
  browser,
}) => {
  await published(page);
  const { page: student } = await openStudent(browser, `#/s/${TOKEN}/bulletin`);
  await expect(student.getByRole('cell', { name: BEFORE, exact: true })).toBeVisible();
  await draft(page);
  await page.reload();
  await expect(page.getByText('게시 중 · 고친 초안 있음', { exact: true })).toBeVisible();
  await expect(page.getByLabel('설교 제목')).toHaveValue(AFTER);
  await student.reload();
  await expect(student.getByRole('cell', { name: BEFORE, exact: true })).toBeVisible();
  await expect(student.getByText(AFTER)).toHaveCount(0);
  await page.getByRole('button', { name: '게시', exact: true }).click();
  await expectToast(page, '게시했어요');
  await expect(page.getByText('게시 중', { exact: true })).toBeVisible();
  await student.reload();
  await expect(student.getByRole('cell', { name: AFTER, exact: true })).toBeVisible();
  await expect(student.getByText(BEFORE)).toHaveCount(0);
});
test('게시 내리기는 학생에게 숨기고 작성 내용은 남긴다', async ({ page, browser }) => {
  await published(page);
  await more(page);
  await page.getByRole('button', { name: '게시 내리기', exact: true }).click();
  await expect(
    page.getByText('학생 화면에서 이 주보가 내려가요. 내용은 남아 있어 다시 게시할 수 있어요.'),
  ).toBeVisible();
  const confirmation = await page
    .getByRole('group', { name: '게시 내리기', exact: true })
    .boundingBox();
  const saveButton = await page
    .getByRole('button', { name: '초안 저장', exact: true })
    .boundingBox();
  expect(confirmation!.y + confirmation!.height).toBeLessThan(saveButton!.y - 40);
  await page.getByRole('button', { name: '게시를 내려요', exact: true }).click();
  await expectToast(page, '게시를 내렸어요');
  await expect(page.getByLabel('설교 제목')).toBeFocused();
  await page.reload();
  await expect(page.getByText('초안', { exact: true })).toBeVisible();
  await expect(page.getByLabel('설교 제목')).toHaveValue(BEFORE);
  const { page: student } = await openStudent(browser, `#/s/${TOKEN}/bulletin`);
  await expect(student.getByText('이번 주 주보가 아직 없어요')).toBeVisible();
  await expect(student.getByText(BEFORE)).toHaveCount(0);
});
test('초안을 버리면 게시본으로 돌아가며 학생 화면은 유지된다', async ({ page, browser }) => {
  await published(page);
  await draft(page);
  await more(page);
  await page.getByRole('button', { name: '초안 버리기', exact: true }).click();
  await page.getByRole('button', { name: '초안을 버리고 돌아가기', exact: true }).click();
  await expectToast(page, '초안을 버렸어요');
  await expect(page.getByLabel('설교 제목')).toBeFocused();
  await expect(page.getByLabel('설교 제목')).toHaveValue(BEFORE);
  await expect(page.getByText('게시 중', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('설교 제목')).toHaveValue(BEFORE);
  const { page: student } = await openStudent(browser, `#/s/${TOKEN}/bulletin`);
  await expect(student.getByRole('cell', { name: BEFORE, exact: true })).toBeVisible();
});
test('새 주보를 초안으로만 저장하면 학생에게 보이지 않는다', async ({ page, browser }) => {
  await editor(page);
  await expect(page.getByText('새 주보', { exact: true })).toBeVisible();
  await draft(page);
  await page.reload();
  await expect(page.getByText('초안', { exact: true })).toBeVisible();
  await expect(page.getByLabel('설교 제목')).toHaveValue(AFTER);
  await expect(page.getByRole('button', { name: '초안 버리기', exact: true })).toHaveCount(0);
  const { page: student } = await openStudent(browser, `#/s/${TOKEN}/bulletin`);
  await expect(student.getByText('이번 주 주보가 아직 없어요')).toBeVisible();
  await expect(student.getByText(AFTER)).toHaveCount(0);
});
test('광고 관리에 다녀와도 선택한 주일과 작성 중인 내용을 복구한다', async ({ page }) => {
  await editor(page);
  const step = page.getByRole('group', { name: '주보 날짜' });
  await step.getByRole('button', { name: '다음 주일' }).click();
  const chosen = await step.getByRole('status').textContent();
  await page.getByLabel('설교 제목').fill('광고를 보며 쓰는 주보');
  await page.getByRole('link', { name: '광고 관리', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: '광고' })).toBeVisible();
  await page.getByRole('link', { name: '관리 메뉴' }).click();
  await page.getByRole('link', { name: /^주보 작성/ }).click();
  await expect(page.getByLabel('설교 제목')).toHaveValue('광고를 보며 쓰는 주보');
  await expect(step.getByRole('status')).toHaveText(chosen!);
});
