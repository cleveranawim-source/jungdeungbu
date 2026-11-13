// 관리 → 중등부 안내: 표어·섬기는 분들·예배 에티켓·오시는 길·연락처를 고치고 학생 주보 탭에서 확인한다.
// 섬기는 분들·개인 연락처는 memberInfo/main 에만, 나머지는 settings/info 에 저장된다.
import { expect, test, type Page } from '@playwright/test';
import { doc, setDoc } from 'firebase/firestore';
import { nearestSunday, toDateId } from '../../src/lib/dates';
import { closeStudents, expectToast, loginAsEmu, openStudent } from './helpers';
import { clear, seed, seedAdmin } from './seed';

const ADMIN = 'admin@example.com';
const TOKEN = 'testStudentToken_00061'; // 22자
const CLASS_ID = 'classA';
const THIS_SUNDAY = toDateId(nearestSunday(new Date()));

test.afterEach(closeStudents);

test.beforeEach(async () => {
  await clear();
  await seedAdmin(ADMIN);
  await seed(async (db) => {
    await setDoc(doc(db, 'classes', CLASS_ID), { name: '1학년 1반', grade: 1, order: 1 });
    await setDoc(doc(db, 'students', TOKEN), {
      name: '박새롬', classId: CLASS_ID, birthday: null, active: true, streak: 0, lastPresent: null,
    });
    await setDoc(doc(db, 'bulletins', THIS_SUNDAY), {
      date: THIS_SUNDAY, published: true, updatedBy: 'seed', updatedAt: new Date(),
      issue: '2026-41호', leader: '', opening: { text: '', ref: '' },
      order: [{ type: '설교', title: '', detail: '' }], hymns: [], scripture: '', sermonTitle: '',
      nextServers: [], attendance: null,
    });
  });
});

async function openInfoAdmin(page: Page): Promise<void> {
  await loginAsEmu(page, ADMIN, '관리자');
  await page.getByRole('tab', { name: '관리' }).click();
  await page.getByRole('link', { name: /^중등부 안내/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: '중등부 안내' })).toBeVisible();
}

test('관리자가 안내를 저장하면 학생 주보 탭에 보인다', async ({ page, browser }) => {
  await openInfoAdmin(page);
  const save = page.getByRole('button', { name: '저장', exact: true });
  await expect(save).toBeDisabled(); // 바뀐 것이 없으면 비활성

  await page.getByLabel('표어', { exact: true }).fill('동행하는 자');
  await page.getByLabel('말씀 출처', { exact: true }).fill('미가 6:8');

  const servants = page.getByRole('group', { name: '섬기는 분들', exact: true });
  await servants.getByRole('button', { name: '한 줄 추가' }).click();
  await servants.getByLabel('1번 직분', { exact: true }).fill('담당');
  await servants.getByLabel('1번 이름', { exact: true }).fill('이승열 목사');

  await page.getByLabel('예배 에티켓', { exact: true }).fill('예배시작은 9:30이며, 9:15부터 찬양이 시작됩니다.\n\n휴대폰은 무음으로 해요.');

  await page.getByLabel('교회 전화', { exact: true }).fill('02-303-2501');
  const contacts = page.getByRole('group', { name: '연락처', exact: true });
  await contacts.getByRole('button', { name: '연락처 추가' }).click();
  await contacts.getByLabel('1번 이름', { exact: true }).fill('이승열 목사님');
  await contacts.getByLabel('1번 전화번호', { exact: true }).fill('010-0000-0000');

  await expect(save).toBeEnabled();
  await save.click();
  await expectToast(page, '저장했어요');
  await expect(save).toBeDisabled(); // 저장한 내용이 새 기준

  const { page: student } = await openStudent(browser, `#/s/${TOKEN}/bulletin`);
  const card = student.locator('section').filter({ has: student.getByRole('heading', { name: '중등부 안내' }) });
  await expect(card.getByText('동행하는 자')).toBeVisible();
  await expect(card.getByText('담당', { exact: true })).toBeVisible();
  await expect(card.getByText('이승열 목사', { exact: true })).toBeVisible();
  await expect(card.getByText('예배시작은 9:30이며, 9:15부터 찬양이 시작됩니다.')).toBeVisible();
  await expect(card.getByText('휴대폰은 무음으로 해요.')).toBeVisible();
  await expect(card.getByText(/02-303-2501/)).toBeVisible();
  await expect(card.getByText(/010-0000-0000/)).toBeVisible();

  // 새로고침해도 값이 남는다
  await page.reload();
  await expect(page.getByLabel('표어', { exact: true })).toHaveValue('동행하는 자');
  await expect(page.getByRole('group', { name: '섬기는 분들', exact: true }).getByLabel('1번 이름', { exact: true }))
    .toHaveValue('이승열 목사');
  await expect(page.getByLabel('예배 에티켓', { exact: true })).toHaveValue(
    '예배시작은 9:30이며, 9:15부터 찬양이 시작됩니다.\n휴대폰은 무음으로 해요.');
  await expect(page.getByRole('group', { name: '연락처', exact: true }).getByLabel('1번 전화번호', { exact: true }))
    .toHaveValue('010-0000-0000');
  await expect(page.getByRole('button', { name: '저장', exact: true })).toBeDisabled();
});

test('지도 링크가 https 주소가 아니면 저장하지 않는다', async ({ page, browser }) => {
  await openInfoAdmin(page);
  await page.getByLabel('표어', { exact: true }).fill('동행하는 자');
  const map = page.getByLabel('지도 링크', { exact: true });
  await map.fill('javascript:alert(1)');
  await page.getByRole('button', { name: '저장', exact: true }).click();

  const error = page.getByText('https:// 로 시작하는 주소를 붙여 넣어 주세요');
  await expect(error).toBeVisible();
  await expect(map).toHaveAttribute('aria-invalid', 'true');
  await expect(map).toHaveAccessibleDescription(/https:\/\/ 로 시작하는 주소를 붙여 넣어 주세요/);
  await expect(page.getByRole('status').filter({ hasText: '저장했어요' })).toHaveCount(0);

  // 아무것도 저장되지 않았다
  const before = await openStudent(browser, `#/s/${TOKEN}/bulletin`);
  await expect(before.page.getByRole('heading', { name: '주일예배' })).toBeVisible();
  await expect(before.page.getByText('동행하는 자')).toHaveCount(0);

  await map.fill('https://example.com/map');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expectToast(page, '저장했어요');
  await expect(error).toHaveCount(0);

  const { page: student } = await openStudent(browser, `#/s/${TOKEN}/bulletin`);
  await expect(student.getByRole('link', { name: '지도 열기' })).toHaveAttribute('href', 'https://example.com/map');
});

test('저장 안 한 채 관리 메뉴로 나가려 하면 묻는다: 계속 쓰기는 그대로, 이동하면 버린다', async ({ page }) => {
  await openInfoAdmin(page);
  const motto = page.getByLabel('표어', { exact: true });
  await motto.fill('새봄의 길');

  await page.getByRole('link', { name: '관리 메뉴' }).click();
  const prompt = page.getByRole('group', { name: '저장하지 않은 내용' });
  await expect(prompt).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: '중등부 안내' })).toBeVisible(); // 아직 그 자리
  await page.getByRole('button', { name: '계속 쓰기' }).click();
  await expect(prompt).toHaveCount(0);
  await expect(motto).toHaveValue('새봄의 길');

  await page.getByRole('link', { name: '관리 메뉴' }).click();
  await page.getByRole('button', { name: '저장하지 않고 이동' }).click();
  await expect(page.getByRole('navigation', { name: '관리 메뉴' })).toBeVisible();
  await page.getByRole('link', { name: /^중등부 안내/ }).click();
  await expect(page.getByLabel('표어', { exact: true })).toHaveValue(''); // 저장하지 않았다
});
