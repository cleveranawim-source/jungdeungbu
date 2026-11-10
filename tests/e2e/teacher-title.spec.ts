import { expect, test, type Page } from '@playwright/test';
import { doc, setDoc } from 'firebase/firestore';
import { expectToast, loginAsEmu } from './helpers';
import { clear, seed, seedAdmin } from './seed';

const ADMIN = 'admin@example.com';

test.beforeEach(async () => {
  await clear();
  await seedAdmin(ADMIN);
  await seed((db) => setDoc(doc(db, 'classes/classA'), { name: '1반', grade: 1, order: 1 }));
});

/** 화면 맨 위 이름 줄(h1 바로 아래) */
const header = (page: Page) => page.locator('header p').first();

test('관리자가 자기 호칭을 목사님으로 바꾸면 위 이름 줄이 바로 바뀐다', async ({ page }) => {
  await loginAsEmu(page, ADMIN, '관리자');
  await expect(header(page)).toHaveText('관리자 선생님');

  await page.goto('#/t/admin/classes');
  await page.getByRole('button', { name: /관리자 선생님 \(나\)/ }).click();
  const self = page.getByRole('form', { name: '내 이름·호칭 고치기' });
  await self.getByRole('button', { name: '목사님', exact: true }).click();
  await expect(self.getByLabel('호칭', { exact: true })).toHaveValue('목사님');
  await self.getByRole('button', { name: '저장', exact: true }).click();
  await expectToast(page, '저장했어요');

  await expect(header(page)).toHaveText('관리자 목사님');
  await expect(page.getByRole('button', { name: /관리자 목사님 \(나\)/ })).toBeVisible();
});

test('초대 때 정한 호칭으로 들어오고, 등록 뒤에도 이름·호칭을 고칠 수 있다', async ({ page }) => {
  await loginAsEmu(page, ADMIN, '관리자');
  await page.goto('#/t/admin/classes');

  await page.getByLabel('선생님 이메일').fill('jeon@example.com');
  await page.getByLabel('선생님 이름').fill('김전도');
  await page.getByRole('form', { name: '선생님 초대' }).getByRole('button', { name: '전도사님', exact: true }).click();
  await page.getByRole('checkbox', { name: '1반' }).check();
  await page.getByRole('button', { name: '초대하기' }).click();
  await expectToast(page, '초대했어요');
  await expect(page.getByRole('button', { name: /김전도 전도사님/ })).toBeVisible();

  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page.getByRole('button', { name: '에뮬레이터 로그인' })).toBeVisible();
  await loginAsEmu(page, 'jeon@example.com', '김전도');
  await expect(header(page)).toHaveText('김전도 전도사님');

  // 다시 관리자로: 직접 적은 호칭, 이름 바꾸기
  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page.getByRole('button', { name: '에뮬레이터 로그인' })).toBeVisible();
  await loginAsEmu(page, ADMIN, '관리자');
  await page.goto('#/t/admin/classes');
  await page.getByRole('button', { name: /김전도 전도사님/ }).click();
  const row = page.getByRole('form', { name: '김전도 전도사님 고치기' });
  await row.getByLabel('이름', { exact: true }).fill('김은혜');
  await row.getByLabel('호칭', { exact: true }).fill('부장 집사님');
  await row.getByRole('button', { name: '저장', exact: true }).click();
  await expectToast(page, '저장했어요');
  await expect(page.getByRole('button', { name: /김은혜 부장 집사님/ })).toBeVisible();

  // 호칭은 10자까지
  await page.getByRole('button', { name: /김은혜 부장 집사님/ }).click();
  await expect(page.getByRole('form', { name: '김은혜 부장 집사님 고치기' }).getByLabel('호칭', { exact: true })).toHaveAttribute('maxlength', '10');
});
