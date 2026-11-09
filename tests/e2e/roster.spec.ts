import { expect, test } from '@playwright/test';
import { doc, setDoc } from 'firebase/firestore';
import { expectToast, loginAsEmu, readClipboard, studentHash } from './helpers';
import { clear, seed, seedAdmin } from './seed';

const ADMIN = 'admin@example.com';

test.beforeEach(async () => {
  await clear();
  await seedAdmin(ADMIN);
});

test('관리자가 반·학생을 만들고 학생 링크가 열린다', async ({ page, context }) => {
  await loginAsEmu(page, ADMIN, '관리자');

  // 관리 → 반·교사 → 반 추가 '1반'
  await page.getByRole('tab', { name: '관리' }).click();
  await page.getByRole('link', { name: /^반·교사/ }).click();
  await page.getByLabel('반 이름').fill('1반');
  await page.getByRole('button', { name: '반 추가' }).click();
  await expectToast(page, '반을 추가했어요');
  await expect(page.getByRole('button', { name: /^1반/ })).toBeVisible();

  // 관리 → 학생 명단 → 추가 '김하늘' 1반 03-05
  await page.getByRole('link', { name: '관리 메뉴' }).click();
  await page.getByRole('link', { name: /^학생 명단/ }).click();
  await page.getByLabel('학생 이름').fill('김하늘');
  await page.getByLabel('반', { exact: true }).selectOption({ label: '1반' });
  await page.getByLabel('생일').fill('03-05');
  await page.getByRole('button', { name: '학생 추가' }).click();
  await expectToast(page, '김하늘 학생을 추가했어요');

  // 방금 추가한 학생 행이 열려 있고, 링크 공유(헤드리스엔 share 가 없어 복사)
  const row = page.getByRole('button', { name: /^김하늘/ });
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: '링크 공유' }).click();
  await expectToast(page, '링크를 복사했어요');
  const text = await readClipboard(page);
  expect(text).toMatch(/^김하늘아, 중등부 앱이야 → http:\/\/localhost:5173\/jungdeungbu\/#\/s\/[A-Za-z0-9_-]{22}$/);
  const hash = studentHash(text);
  await expect(page.getByLabel('학생 링크')).toHaveValue(text.split(' → ')[1]);

  const page2 = await context.newPage();
  await page2.goto(hash);
  await expect(page2.getByText('김하늘')).toBeVisible();
  await expect(page2.getByRole('tab', { name: '나' })).toBeVisible();
});

test('초대 없는 계정은 안내 화면', async ({ page }) => {
  await loginAsEmu(page, 'nobody@example.com', '아무개', { expectTabBar: false });
  await expect(page.getByText('등록되지 않은 계정입니다')).toBeVisible();
  await expect(page.getByText('nobody@example.com')).toBeVisible();
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page.getByRole('button', { name: '에뮬레이터 로그인' })).toBeVisible();
});

test('일괄 등록 미리보기, 링크 재발급, 비활성화', async ({ page, context }) => {
  await seed((db) => setDoc(doc(db, 'classes/classA'), { name: '1반', grade: 1, order: 1 }));
  await loginAsEmu(page, ADMIN, '관리자');
  await page.goto('#/t/admin/roster');

  await page.getByLabel('명단 붙여 넣기').fill('이바다, 1반, 0412\n박구름, 2반, 05-01\n최별\t1반');
  await expect(page.getByText("2줄: 반 '2반'을(를) 찾을 수 없어요")).toBeVisible();
  await page.getByRole('button', { name: '2명 등록' }).click();
  await expectToast(page, '2명을 등록했어요');
  await expect(page.getByRole('button', { name: /^이바다/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^최별/ })).toBeVisible();

  // 링크 재발급: 확인 단계를 거치고, 옛 링크는 닫히고 새 링크가 열린다
  await page.getByRole('button', { name: /^이바다/ }).click();
  await page.getByRole('button', { name: '링크 공유' }).click();
  const oldText = await readClipboard(page);
  expect(oldText).toMatch(/^이바다야, 중등부 앱이야 → /); // 받침 없는 이름은 "야"
  const oldHash = studentHash(oldText);
  await page.getByRole('button', { name: '링크 재발급' }).click();
  await page.getByRole('button', { name: '취소' }).click();
  await page.getByRole('button', { name: '링크 재발급' }).click();
  await page.getByRole('button', { name: '재발급하기' }).click();
  await expectToast(page, '새 링크를 만들었어요');
  await page.getByRole('button', { name: '링크 공유' }).click();
  const newHash = studentHash(await readClipboard(page));
  expect(newHash).not.toBe(oldHash);

  const oldPage = await context.newPage();
  await oldPage.goto(oldHash);
  await expect(oldPage.getByText('선생님께 링크를 다시 받아주세요')).toBeVisible();
  const newPage = await context.newPage();
  await newPage.goto(newHash);
  await expect(newPage.getByText('이바다')).toBeVisible();

  // 비활성화: 확인 뒤 목록에서 빠진다
  await page.getByRole('button', { name: /^최별/ }).click();
  await page.getByRole('button', { name: '비활성화', exact: true }).click();
  await page.getByRole('button', { name: '비활성화하기' }).click();
  await expectToast(page, '최별 학생을 비활성화했어요');
  await expect(page.getByRole('button', { name: /^최별/ })).toHaveCount(0);
});

test('초대한 교사는 담당 반으로 들어오고 관리 탭이 없다', async ({ page }) => {
  await seed((db) => setDoc(doc(db, 'classes/classA'), { name: '1반', grade: 1, order: 1 }));
  await loginAsEmu(page, ADMIN, '관리자');
  await page.goto('#/t/admin/classes');

  await page.getByLabel('선생님 이메일').fill('Teacher@Example.com');
  await page.getByLabel('선생님 이름').fill('김선생');
  await page.getByRole('checkbox', { name: '1반' }).check();
  await page.getByRole('button', { name: '초대하기' }).click();
  await expectToast(page, '초대했어요');
  await expect(page.getByText('teacher@example.com')).toBeVisible();

  await page.getByRole('button', { name: '로그아웃' }).click();
  await loginAsEmu(page, 'teacher@example.com', '김선생');
  await expect(page.getByRole('tab', { name: '우리 반' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '관리' })).toHaveCount(0);
  // 관리 주소로 와도 출석 탭으로
  await page.goto('#/t/admin');
  await expect(page.getByRole('tab', { name: '출석' })).toHaveAttribute('aria-selected', 'true');
});
