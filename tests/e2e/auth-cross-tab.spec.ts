import { expect, test } from '@playwright/test';
import { doc, setDoc } from 'firebase/firestore';
import { clear, seed, seedAdmin } from './seed';
import { loginAsEmu } from './helpers';
const TOKEN = 'testStudentToken_00091';
const EMAIL = 'cross-tab-admin@example.com';
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
