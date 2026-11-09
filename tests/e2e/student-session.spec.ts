// 학생 기기의 익명 세션이 늦거나 실패할 때 기도 올리기 안내. (기도 기능 전체 시험은 Task 12 의 prayer.spec)
import { expect, test, type Route } from '@playwright/test';
import { doc, setDoc } from 'firebase/firestore';
import { expectToast } from './helpers';
import { clear, seed } from './seed';

const TOKEN = 'testStudentToken_00002'; // 22자

test.beforeEach(async () => {
  await clear();
  await seed(async (db) => {
    await setDoc(doc(db, 'classes', 'classA'), { name: '1학년 1반', grade: 1, order: 1 });
    await setDoc(doc(db, 'students', TOKEN), {
      name: '김하늘', classId: 'classA', birthday: null, active: true, streak: 0, lastPresent: null,
    });
  });
});

const SIGN_UP = '**/accounts:signUp**'; // 익명 로그인(Auth 에뮬레이터)

test('연결이 늦으면 안내하고, 시간이 지나면 다시 시도할 수 있다', async ({ page }) => {
  test.setTimeout(45000);
  // 익명 로그인 요청을 붙잡아 둔다(응답 없음 = 느린 연결)
  const held: Route[] = [];
  await page.route(SIGN_UP, (route) => { held.push(route); });

  await page.goto(`#/s/${TOKEN}/prayer`);
  await page.getByLabel('기도 제목').fill('수련회에 같이 갈 수 있게');
  const submit = page.getByRole('button', { name: '올리기' });
  await expect(submit).toBeDisabled();
  await expect(page.getByRole('status').filter({ hasText: '연결되면 올릴 수 있어요' })).toHaveCount(1);

  // 8초가 지나면 failed: 버튼이 다시 눌리고, 누르면 안내 + 다시 시도
  await expect(submit).toBeEnabled({ timeout: 12000 });
  await page.unroute(SIGN_UP);
  for (const r of held) await r.abort().catch(() => {});
  await submit.click();
  await expectToast(page, '잠시 뒤 다시 시도해 주세요', 'error');

  // 다시 시도가 성공하면 알려 주고, 적어 둔 글은 그대로
  await expectToast(page, '이제 올릴 수 있어요');
  await expect(page.getByLabel('기도 제목')).toHaveValue('수련회에 같이 갈 수 있게');
  await submit.click();
  await expectToast(page, '올렸어요');
  await expect(page.getByText('내 글')).toBeVisible();
});

test('로그인이 실패하면 올리기를 눌렀을 때 안내, 다시 되면 알림', async ({ page }) => {
  await page.route(SIGN_UP, (route) => route.abort());
  await page.goto(`#/s/${TOKEN}/prayer`);
  const submit = page.getByRole('button', { name: '올리기' });
  await expect(submit).toBeEnabled(); // failed 는 누를 수 있다
  await page.getByLabel('기도 제목').fill('시험 잘 보게');
  await page.unroute(SIGN_UP);
  await submit.click();
  await expectToast(page, '잠시 뒤 다시 시도해 주세요', 'error');
  await expectToast(page, '이제 올릴 수 있어요');
  await expect(page.getByLabel('기도 제목')).toHaveValue('시험 잘 보게');
});

test('올리기가 서버에 늦게 닿으면 "연결되면 올라가요"', async ({ page }) => {
  await page.goto(`#/s/${TOKEN}/prayer`);
  const submit = page.getByRole('button', { name: '올리기' });
  await expect(submit).toBeEnabled(); // 세션 ready
  // 이제부터 Firestore 쓰기 요청을 붙잡는다
  const held: Route[] = [];
  await page.route('**/google.firestore.v1.Firestore/Write/**', (route) => { held.push(route); });
  await page.getByLabel('기도 제목').fill('할머니 수술');
  await submit.click();
  await expect(page.getByRole('status').filter({ hasText: '연결되면 올라가요' })).toHaveCount(1, { timeout: 8000 });
  await page.unroute('**/google.firestore.v1.Firestore/Write/**');
  for (const r of held) await r.continue().catch(() => {});
});
