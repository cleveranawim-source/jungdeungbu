import { expect, test, type Route } from '@playwright/test';
import { collection, doc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { formatMonthDay, nearestSunday, toDateId } from '../../src/lib/dates';
import { closeStudents, expectToast, loginAsEmu, openStudent, readClipboard, studentHash } from './helpers';
import { clear, seed } from './seed';

const ADMIN = 'admin@example.com';
const TEACHER = 'teacher@example.com';
const TOKEN_A = 'attendStudentTokenA_01'; // 22자
const TOKEN_B = 'attendStudentTokenB_01';

// 앱과 같은 규칙으로 "이번 주" 주일을 잡는다
const THIS_SUNDAY = toDateId(nearestSunday(new Date()));

test.afterEach(closeStudents);

test.beforeEach(async () => {
  await clear();
  await seed(async (db) => {
    await setDoc(doc(db, 'invites', ADMIN), { name: '관리자', role: 'admin', classIds: [] });
    await setDoc(doc(db, 'invites', TEACHER), { name: '김선생', role: 'teacher', classIds: ['classB'] });
    await setDoc(doc(db, 'classes', 'classA'), { name: '1반', grade: 1, order: 1 });
    await setDoc(doc(db, 'classes', 'classB'), { name: '2반', grade: 1, order: 2 });
    await setDoc(doc(db, 'students', TOKEN_A), {
      name: '김하늘', classId: 'classA', birthday: null, active: true, streak: 0, lastPresent: null,
    });
    await setDoc(doc(db, 'students', TOKEN_B), {
      name: '이바다', classId: 'classB', birthday: null, active: true, streak: 0, lastPresent: null,
    });
  });
});

test('네 반 이상은 선택 칸에서 반을 바꾸고, 반 ID는 DOM에 남기지 않아요', async ({ page }) => {
  await seed(async db => {
    await setDoc(doc(db, 'classes', 'classC'), { name: '3반', grade: 1, order: 3 });
    await setDoc(doc(db, 'classes', 'classD'), { name: '4반', grade: 1, order: 4 });
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await loginAsEmu(page, ADMIN, '관리자');
  const picker = page.getByRole('combobox', { name: '반', exact: true });
  await expect(picker).toHaveValue('0');
  await expect(page.getByRole('button', { name: /김하늘/ })).toBeVisible();
  await picker.selectOption({ label: '2반' });
  await expect(page.getByRole('button', { name: /이바다/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /김하늘/ })).toHaveCount(0);
  expect(await page.locator('html').innerHTML()).not.toMatch(/\bclass[A-D]\b/);
  await picker.selectOption({ label: '4반' });
  await expect(page.getByRole('heading', { name: '이 반에는 아직 학생이 없어요' })).toBeVisible();
  await page.getByRole('tab', { name: '우리 반' }).click();
  await page.getByRole('combobox', { name: '반', exact: true }).selectOption({ label: '1반' });
  await expect(page.getByRole('link', { name: /김하늘/ })).toBeVisible();
  expect(await page.locator('html').innerHTML()).not.toMatch(/\bclass[A-D]\b/);
});

test('교사가 출석을 찍으면 학생 "나" 탭에 보인다', async ({ page, browser }) => {
  await loginAsEmu(page, ADMIN, '관리자');
  await expect(page.getByRole('tab', { name: '출석' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText(`${formatMonthDay(THIS_SUNDAY)} 주일`)).toBeVisible();

  // 관리자는 모든 반을 고른다. 처음엔 첫 반(1반)
  await expect(page.getByRole('radio', { name: /1반/ })).toBeChecked();
  await expect(page.getByRole('radio', { name: /2반/ })).toBeVisible();

  const sky = page.getByRole('button', { name: /김하늘/ });
  await expect(page.getByText('출석 0 / 1')).toBeVisible();
  await expect(sky).toHaveAttribute('aria-pressed', 'false');
  await sky.click();
  await expect(sky).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('출석 1 / 1')).toBeVisible();
  // 서버에 닿을 때까지 기다린다(처리 중 표시가 사라짐)
  await expect(sky).not.toHaveAttribute('aria-busy', 'true');

  // 우리 반 → 김하늘: 연속 출석, 링크 공유
  await page.getByRole('tab', { name: '우리 반' }).click();
  await expect(page.getByRole('link', { name: /김하늘/ })).toContainText('1주 연속');
  await page.getByRole('link', { name: /김하늘/ }).click();
  await expect(page).toHaveURL(new RegExp(`#/t/class/${TOKEN_A}$`));
  await expect(page.getByRole('heading', { name: '김하늘' })).toBeVisible();
  await expect(page.getByRole('img', { name: `${formatMonthDay(THIS_SUNDAY)} 출석, 이번 주` })).toBeVisible();
  await page.getByRole('button', { name: '링크 공유' }).click();
  await expectToast(page, '링크를 복사했어요');
  const hash = studentHash(await readClipboard(page));

  // 학생 링크 → 나 탭
  const { page: student } = await openStudent(browser, hash);
  await student.getByRole('tab', { name: '나' }).click();
  await expect(student.getByText('연속 출석 1주')).toBeVisible();
  await expect(student.getByRole('img', { name: `${formatMonthDay(THIS_SUNDAY)} 출석, 이번 주` })).toBeVisible();

  // 선생님 화면: 뒤로 → 목록, 출석 탭에서 다시 눌러 취소
  await page.getByRole('link', { name: '우리 반 목록' }).click();
  await expect(page.getByRole('link', { name: /김하늘/ })).toBeVisible();
  await page.getByRole('tab', { name: '출석' }).click();
  await expect(page.getByText('출석 1 / 1')).toBeVisible();
  await page.getByRole('button', { name: /김하늘/ }).click();
  await expect(page.getByText('출석 0 / 1')).toBeVisible();
  await expect(page.getByRole('button', { name: /김하늘/ })).toHaveAttribute('aria-pressed', 'false');
});

test('날짜는 7일씩 옮기고, 이번 주일보다 뒤로는 못 간다(미리 찍기 없음)', async ({ page }) => {
  await loginAsEmu(page, ADMIN, '관리자');
  const [y, m, d] = THIS_SUNDAY.split('-').map(Number);
  const shift = (n: number) => toDateId(new Date(y, m - 1, d + n));

  await expect(page.getByRole('button', { name: '오늘로' })).toHaveCount(0);
  await page.getByRole('button', { name: '지난 주일' }).click();
  await expect(page.getByText(`${formatMonthDay(shift(-7))} 주일`)).toBeVisible();
  // 지난 주일엔 출석이 따로
  await page.getByRole('button', { name: /김하늘/ }).click();
  await expect(page.getByText('출석 1 / 1')).toBeVisible();
  await page.getByRole('button', { name: '오늘로' }).click();
  await expect(page.getByText(`${formatMonthDay(THIS_SUNDAY)} 주일`)).toBeVisible();
  await expect(page.getByText('출석 0 / 1')).toBeVisible();

  // 이번 주일이 끝: 다음 주일로 넘어가지 않는다
  await expect(page.getByRole('button', { name: '다음 주일' })).toBeDisabled();
  await page.getByRole('button', { name: '지난 주일' }).click();
  await expect(page.getByRole('button', { name: '다음 주일' })).toBeEnabled();
  await page.getByRole('button', { name: '다음 주일' }).click();
  await expect(page.getByText(`${formatMonthDay(THIS_SUNDAY)} 주일`)).toBeVisible();
  await expect(page.getByRole('button', { name: '다음 주일' })).toBeDisabled();
  await expect(page.getByText(`${formatMonthDay(shift(7))} 주일`)).toHaveCount(0);
});

test('2반 교사는 1반을 볼 수 없다', async ({ page }) => {
  await loginAsEmu(page, TEACHER, '김선생');
  await expect(page.getByRole('button', { name: /이바다/ })).toBeVisible();
  await expect(page.getByText('출석 0 / 1')).toBeVisible();
  await expect(page.getByRole('button', { name: /김하늘/ })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: /1반/ })).toHaveCount(0);
  await expect(page.getByText('2반', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: '우리 반' }).click();
  await expect(page.getByRole('link', { name: /이바다/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /김하늘/ })).toHaveCount(0);
});

test('저장이 거절되면 되돌리고 알린다', async ({ page }) => {
  await loginAsEmu(page, TEACHER, '김선생');
  const sea = page.getByRole('button', { name: /이바다/ });
  await expect(sea).toHaveAttribute('aria-pressed', 'false');

  // 화면이 열려 있는 동안 관리자가 담당 반을 빼 버렸다
  await seed(async (db) => {
    const snap = await getDocs(query(collection(db, 'teachers'), where('email', '==', TEACHER)));
    await updateDoc(snap.docs[0].ref, { classIds: [] });
  });

  await sea.click();
  await expectToast(page, '권한이 없어요. 담당 반이 맞는지 확인해 주세요', 'error');
  await expect(sea).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('출석 0 / 1')).toBeVisible();
});

test('저장 중에 다시 누르면 화면은 바로 바뀌고, 마지막 값이 저장된다', async ({ page }) => {
  await loginAsEmu(page, ADMIN, '관리자');
  const sky = page.getByRole('button', { name: /김하늘/ });
  await expect(sky).toHaveAttribute('aria-pressed', 'false');

  // Firestore 쓰기 요청을 붙잡아 둔다(느린 연결·오프라인과 같다)
  const WRITE = '**/google.firestore.v1.Firestore/Write/**';
  const held: Route[] = [];
  await page.route(WRITE, (route) => { held.push(route); });
  await sky.click();
  await expect(sky).toHaveAttribute('aria-pressed', 'true');
  await expect(sky).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByText('출석 1 / 1')).toBeVisible();
  // 잘못 눌렀다: 저장을 기다리지 않고 바로 되돌릴 수 있다
  await sky.click();
  await expect(sky).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('출석 0 / 1')).toBeVisible();

  await page.unroute(WRITE);
  for (const r of held) await r.continue().catch(() => {});
  await expect(sky).not.toHaveAttribute('aria-busy', 'true', { timeout: 15000 });

  // 서버에는 마지막 값(결석)이 남았다
  await page.reload();
  await expect(page.getByText('출석 0 / 1')).toBeVisible();
  await expect(page.getByRole('button', { name: /김하늘/ })).toHaveAttribute('aria-pressed', 'false');
});
