// 관리 → 주보 작성의 새 칸: 호수·인도자·여는 말씀·일어서기·다음 주 예배위원,
// 그리고 "출석·새 친구·생일 불러오기"로 채운 뒤 손으로 고치는 카드. 저장한 값이 정본이다.
import { expect, test, type Page } from '@playwright/test';
import { doc, setDoc } from 'firebase/firestore';
import { addDays, nearestSunday, toDateId } from '../../src/lib/dates';
import { closeStudents, expectToast, loginAsEmu, openStudent } from './helpers';
import { clear, readRaw, seed, seedAdmin } from './seed';

const ADMIN = 'admin@example.com';
const CLASS_ID = 'classA';
const TOKEN_GA = 'testStudentToken_00051'; // 22자
const TOKEN_NA = 'testStudentToken_00052';
const TOKEN_NEW = 'testStudentToken_00053';

// 앱과 같은 규칙으로 "이번 주" 주일을 잡는다
const SUNDAY = nearestSunday(new Date());
const THIS_SUNDAY = toDateId(SUNDAY);
const LAST_SUNDAY = toDateId(addDays(SUNDAY, -7));
const BIRTHDAY = `${THIS_SUNDAY.slice(5, 7)}-20`; // 이번 주보 달의 20일

const NUMBER_ERROR = '0 이상의 숫자로, 출석은 전체보다 많을 수 없어요';

test.afterEach(closeStudents);

test.beforeEach(async () => {
  await clear();
  await seedAdmin(ADMIN);
  await seed(async (db) => {
    await setDoc(doc(db, 'classes', CLASS_ID), { name: '1-1', grade: 1, order: 1 });
    const student = { classId: CLASS_ID, birthday: null, active: true, streak: 0, lastPresent: null };
    await setDoc(doc(db, 'students', TOKEN_GA), { ...student, name: '가' });
    await setDoc(doc(db, 'students', TOKEN_NA), { ...student, name: '나' });
    await setDoc(doc(db, 'students', TOKEN_NEW), { ...student, name: '새봄', newcomer: true, birthday: BIRTHDAY });
    const mark = (token: string, present: boolean) => setDoc(doc(db, 'students', token, 'attendance', LAST_SUNDAY), {
      date: LAST_SUNDAY, present, by: 'seed', at: new Date(),
    });
    await mark(TOKEN_GA, true);
    await mark(TOKEN_NA, false);
    await mark(TOKEN_NEW, true);
    await setDoc(doc(db, 'bulletins', LAST_SUNDAY), {
      date: LAST_SUNDAY, order: [{ type: '설교', title: '', detail: '' }], hymns: [], scripture: '', sermonTitle: '',
      published: true, updatedBy: 'seed', updatedAt: new Date(),
      issue: '2026-41호', leader: '', opening: { text: '', ref: '' }, nextServers: [], attendance: null,
    });
  });
});

async function openEditor(page: Page): Promise<void> {
  await loginAsEmu(page, ADMIN, '관리자');
  await page.getByRole('tab', { name: '관리' }).click();
  await page.getByRole('link', { name: /^주보 작성/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: '주보 작성' })).toBeVisible();
}

async function loadExtras(page: Page): Promise<void> {
  await page.getByRole('button', { name: '출석·새 친구·생일 불러오기' }).click();
  await expectToast(page, '주일 출석을 불러왔어요');
}

test('새 주보: 종이 주보 순서와 다음 호수로 시작한다', async ({ page }) => {
  await openEditor(page);
  await expect(page.getByLabel('호수')).toHaveValue('2026-42호');
  await expect(page.getByRole('list', { name: '예배 순서 줄' }).getByRole('listitem')).toHaveCount(12);
  await expect(page.getByLabel('2번 일어서서', { exact: true })).toBeChecked();
  await expect(page.getByLabel('1번 일어서서', { exact: true })).not.toBeChecked();
  // 자동으로 불러오지 않는다(버튼만)
  await expect(page.getByLabel('새 친구')).toHaveCount(1);
  await expect(page.getByLabel('새 친구')).toHaveValue('');
  await expect(page.getByLabel('1-1 출석')).toHaveCount(0);
});

test('불러오기 → 고치기 → 게시하면 학생에게 보인다', async ({ page, browser }) => {
  await openEditor(page);
  await page.getByLabel('인도자').fill('정한결 선생님');
  await page.getByLabel('여는 말씀').fill('하나님은 영이시니 예배하는 자가 영과 진리로 예배할지니라');
  await page.getByLabel('말씀 출처').fill('요 4:24');
  await page.getByRole('button', { name: '예배위원 추가' }).click();
  await page.getByLabel('1번 맡은 일', { exact: true }).fill('인도');
  await page.getByLabel('1번 이름', { exact: true }).fill('한가람 학생');

  await loadExtras(page);
  await expect(page.getByLabel('1-1 출석')).toHaveValue('2');
  await expect(page.getByLabel('1-1 전체')).toHaveValue('3');
  await expect(page.getByLabel('새 친구')).toHaveValue('새봄');
  await expect(page.getByLabel('이번 달 생일')).toHaveValue(new RegExp('새봄'));
  await page.getByLabel('교사 출석').fill('13');
  await page.getByLabel('교사 전체').fill('15');

  await page.getByRole('button', { name: '게시', exact: true }).click();
  await expectToast(page, '게시했어요');

  // 누구나 읽는 주보 문서에는 반 이름·인원만 — 반 ID(그 반 기도 제목을 여는 열쇠)는 없다
  const saved = JSON.stringify(await readRaw(`bulletins/${THIS_SUNDAY}`));
  expect(saved).toContain('"name":"1-1"');
  expect(saved).not.toContain(CLASS_ID);
  expect(saved).not.toContain('classId');

  const { page: student } = await openStudent(browser, `#/s/${TOKEN_GA}/bulletin`);
  await expect(student.getByText('인도: 정한결 선생님')).toBeVisible();
  await expect(student.getByText('요 4:24')).toBeVisible();
  await expect(student.getByText('한가람 학생')).toBeVisible();
  await expect(student.getByText('학생 2/3')).toBeVisible();
  await expect(student.getByText('교사 13/15')).toBeVisible();
  await expect(student.getByRole('region', { name: '새 친구' }).getByText('새봄')).toBeVisible();
  await expect(student.getByRole('region', { name: '이번 달 생일' }).getByText('새봄')).toBeVisible();
});

test('숫자가 틀리면 저장하지 않고 그 칸에 알려 준다', async ({ page }) => {
  await openEditor(page);
  await loadExtras(page);
  const present = page.getByLabel('1-1 출석');
  await present.fill('9'); // 전체 3보다 많다

  await page.getByRole('button', { name: '임시저장', exact: true }).click();
  await expectToast(page, '고칠 곳이 있어요', 'error');
  await expect(page.getByText(NUMBER_ERROR)).toBeVisible();
  await expect(present).toHaveAttribute('aria-invalid', 'true');
  await expect(present).toBeFocused();
  await expect(page.getByText('새 주보', { exact: true })).toBeVisible(); // 저장 안 됨

  await present.fill('2');
  await page.getByLabel('교사 출석').fill('열');
  await page.getByRole('button', { name: '임시저장', exact: true }).click();
  await expect(page.getByText(NUMBER_ERROR)).toBeVisible();
  await expect(page.getByLabel('교사 출석')).toHaveAttribute('aria-invalid', 'true');
  await expect(present).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('새 주보', { exact: true })).toBeVisible();

  // 반 칸을 둘 다 비우면 0/0 으로 저장하지 않고 오류(빼려면 "출석 지우기")
  await page.getByLabel('교사 출석').fill('');
  await present.fill('');
  await page.getByLabel('1-1 전체').fill('');
  await page.getByRole('button', { name: '임시저장', exact: true }).click();
  await expect(page.getByText(NUMBER_ERROR)).toBeVisible();
  await expect(page.getByText('새 주보', { exact: true })).toBeVisible();

  // 생일 줄 모양이 틀려도 막는다
  await present.fill('2');
  await page.getByLabel('1-1 전체').fill('3');
  await page.getByLabel('이번 달 생일').fill('새봄 생일');
  await page.getByRole('button', { name: '임시저장', exact: true }).click();
  await expect(page.getByText('한 줄에 "11-20 이름"처럼 적어 주세요')).toBeVisible();
  await expect(page.getByText(NUMBER_ERROR)).toHaveCount(0);
  await expect(page.getByText('새 주보', { exact: true })).toBeVisible();

  // 교사 칸은 둘 다 비우면 빼고 저장한다
  await page.getByLabel('이번 달 생일').fill(`${BIRTHDAY} 새봄`);
  await page.getByRole('button', { name: '임시저장', exact: true }).click();
  await expectToast(page, '임시저장했어요');
  await expect(page.getByText('한 줄에 "11-20 이름"처럼 적어 주세요')).toHaveCount(0);
  await expect(page.getByText('새 주보', { exact: true })).toHaveCount(0);
});

test('다시 열어도 그대로이고, 출석 지우기로 뺄 수 있다', async ({ page, browser }) => {
  await openEditor(page);
  await page.getByLabel('인도자').fill('정한결 선생님');
  await page.getByLabel('1번 일어서서', { exact: true }).check();
  await page.getByRole('button', { name: '예배위원 추가' }).click();
  await page.getByLabel('1번 맡은 일', { exact: true }).fill('인도');
  await page.getByLabel('1번 이름', { exact: true }).fill('한가람 학생');
  await loadExtras(page);
  await page.getByRole('button', { name: '게시', exact: true }).click();
  await expectToast(page, '게시했어요');

  await page.reload();
  await expect(page.getByLabel('새 친구')).toHaveValue('새봄');
  await expect(page.getByLabel('1-1 출석')).toHaveValue('2');
  await expect(page.getByLabel('인도자')).toHaveValue('정한결 선생님');
  await expect(page.getByLabel('호수')).toHaveValue('2026-42호');
  await expect(page.getByLabel('1번 일어서서', { exact: true })).toBeChecked();
  await expect(page.getByLabel('1번 이름', { exact: true })).toHaveValue('한가람 학생');
  await expect(page.getByLabel('이번 달 생일')).toHaveValue(`${BIRTHDAY} 새봄`);
  await expect(page.getByText('저장된 내용과 같아요')).toBeVisible(); // 다시 열어도 바뀐 것이 없다

  await page.getByRole('button', { name: '출석 지우기' }).click();
  await expect(page.getByLabel('1-1 출석')).toHaveCount(0);
  await page.getByRole('button', { name: '게시', exact: true }).click();
  await expectToast(page, '게시했어요');

  const { page: student } = await openStudent(browser, `#/s/${TOKEN_GA}/bulletin`);
  await expect(student.getByRole('region', { name: '새 친구' }).getByText('새봄')).toBeVisible();
  await expect(student.getByText('지난 주 출석')).toHaveCount(0);
  await expect(student.getByText('인도: 정한결 선생님')).toBeVisible();
});
