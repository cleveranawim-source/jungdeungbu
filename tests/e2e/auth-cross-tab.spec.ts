import { expect, test, type Page } from '@playwright/test';
import { doc, setDoc } from 'firebase/firestore';
import { clear, seed, seedAdmin } from './seed';
import { loginAsEmu } from './helpers';
const TOKEN = 'testStudentToken_00091';
const EMAIL = 'cross-tab-admin@example.com';
/** 교사 첫 화면(출석)이 다시 불러오기 없이 열렸는지: 시드한 학생 이름 버튼이 보이고 불러오기 오류가 없다. */
async function expectFirstScreen(teacher: Page): Promise<void> {
  await expect(teacher.getByRole('button', { name: /서로운/ })).toBeVisible();
  await expect(teacher.getByText('불러오지 못했어요')).toHaveCount(0);
}
test.beforeEach(async () => {
  await clear(); await seedAdmin(EMAIL);
  await seed(async db => {
    await setDoc(doc(db, 'classes', 'crossClass'), { name: '1-1', grade: 1, order: 1 });
    await setDoc(doc(db, 'students', TOKEN), { name: '서로운', classId: 'crossClass', birthday: null, active: true, streak: 0, lastPresent: null });
  });
});
test('학생 탭을 둔 채 다른 탭에서 선생님 로그인하면 재시도 없이 유지된다', async ({ page: student, context }) => {
  await student.goto(`#/s/${TOKEN}/prayer`);
  await expect(student.getByRole('button', { name: '올리기', exact: true })).toBeEnabled();
  let anonymousSignIns = 0;
  context.on('request', request => { if (request.url().includes('accounts:signUp')) anonymousSignIns++; });
  const teacher = await context.newPage();
  await loginAsEmu(teacher, EMAIL, '담당');
  await expect(teacher.getByText('로그인을 확인하지 못했어요')).toHaveCount(0);
  // 첫 화면(출석)도 다시 불러오기 없이 열린다 — 공유 Listen 연결이 아직 익명이면 여기서 "권한이 없어요"가 뜬다.
  await expectFirstScreen(teacher);
  await expect(student.getByText('선생님 계정으로 로그인된 기기예요')).toBeVisible();
  await expect(student.getByRole('button', { name: '올리기', exact: true })).toBeDisabled();
  // 학생 탭에서 다시 읽어도 교사 계정을 익명으로 덮어쓰지 않는다.
  await student.reload();
  await expect(student.getByText('선생님 계정으로 로그인된 기기예요')).toBeVisible();
  await expect(teacher.getByRole('tablist', { name: '교사 메뉴' })).toBeVisible();
  expect(anonymousSignIns).toBe(0);
  await student.goto('#/');
  await expect(student.getByRole('link', {name:'내 화면 열기'})).toHaveCount(0);
  await teacher.close();
});


test('이미 등록된 교사가 학생 탭을 둔 채 다른 탭에서 로그인해도 첫 화면이 열린다', async ({ page: student, context, browser }) => {
  // 다른 기기(컨텍스트)에서 한 번 로그인해 teachers/{uid} 를 먼저 만들어 둔다.
  const other = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  await loginAsEmu(await other.newPage(), EMAIL, '담당');
  await other.close();
  await student.goto(`#/s/${TOKEN}/prayer`);
  await expect(student.getByRole('button', { name: '올리기', exact: true })).toBeEnabled();
  const teacher = await context.newPage();
  await loginAsEmu(teacher, EMAIL, '담당');
  await expectFirstScreen(teacher);
  await expect(student.getByText('선생님 계정으로 로그인된 기기예요')).toBeVisible();
  await teacher.close();
});

test('이미 확인한 교사는 연결이 끊겨도 캐시로 다시 들어온다', async ({page}) => {
  test.setTimeout(45000);
  await loginAsEmu(page, EMAIL, '담당');
  // A second read of the registered document populates the normal Firestore cache.
  await page.reload();
  await expect(page.getByRole('tablist', {name:'교사 메뉴'})).toBeVisible();
  await page.route('**/google.firestore.v1.Firestore/**', route => route.abort());
  await page.route('**/v1/projects/**', route => route.abort());
  await page.reload();
  await expect(page.getByRole('tablist', {name:'교사 메뉴'})).toBeVisible({timeout:20000});
  await expect(page.getByText('로그인을 확인하지 못했어요')).toHaveCount(0);
});
