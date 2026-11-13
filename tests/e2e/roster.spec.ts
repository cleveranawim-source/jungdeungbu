import { expect, test } from '@playwright/test';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { addDays, nearestSunday, toDateId } from '../../src/lib/dates';
import { closeStudents, expectToast, loginAsEmu, openStudent, readClipboard, studentHash } from './helpers';
import { clear, seed, seedAdmin } from './seed';

const ADMIN = 'admin@example.com';

test.afterEach(closeStudents);

test.beforeEach(async () => {
  await clear();
  await seedAdmin(ADMIN);
});

test('관리자가 반·학생을 만들고 학생 링크가 열린다', async ({ page, browser }) => {
  await loginAsEmu(page, ADMIN, '관리자');

  // 관리 → 반·교사 → 반 추가 '1반'
  await page.getByRole('tab', { name: '관리' }).click();
  await page.getByRole('link', { name: /^반·교사/ }).click();
  await page.getByLabel('반 이름').fill('1반');
  await page.getByRole('button', { name: '반 추가' }).click();
  await expectToast(page, '반을 추가했어요');
  await expect(page.getByRole('button', { name: /^1반/ })).toBeVisible();
  // 같은 이름의 반은 또 만들 수 없다(일괄 등록에서 어느 반인지 알 수 없게 된다)
  await page.getByLabel('반 이름').fill(' 1반 ');
  await page.getByRole('button', { name: '반 추가' }).click();
  await expect(page.getByText('같은 이름의 반이 이미 있어요')).toBeVisible();
  await expect(page.getByRole('button', { name: /^1반/ })).toHaveCount(1);
  await page.getByLabel('반 이름').fill('');

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

  const { page: page2 } = await openStudent(browser, hash);
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

test('일괄 등록 미리보기, 링크 재발급, 비활성화', async ({ page, browser }) => {
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

  const { page: oldPage } = await openStudent(browser, oldHash);
  await expect(oldPage.getByText('선생님께 링크를 다시 받아주세요')).toBeVisible();
  const { page: newPage } = await openStudent(browser, newHash);
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
  // 로그아웃은 캐시를 지우고 화면을 새로 불러온다: 로그인 화면이 다시 뜬 뒤 다른 계정으로
  await expect(page.getByRole('button', { name: '에뮬레이터 로그인' })).toBeVisible();
  await loginAsEmu(page, 'teacher@example.com', '김선생');
  await expect(page.getByRole('tab', { name: '우리 반' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '관리' })).toHaveCount(0);
  // 관리 주소로 와도 출석 탭으로
  await page.goto('#/t/admin');
  await expect(page.getByRole('tab', { name: '출석' })).toHaveAttribute('aria-selected', 'true');
});

test('학생 이름·생일을 고치면 학생 화면에도 새 이름', async ({ page, browser }) => {
  const TOKEN = 'rosterRenameToken_0001'; // 22자
  await seed(async (db) => {
    await setDoc(doc(db, 'classes/classA'), { name: '1반', grade: 1, order: 1 });
    await setDoc(doc(db, 'students', TOKEN), {
      name: '김하늘', classId: 'classA', birthday: '03-05', active: true, streak: 0, lastPresent: null,
    });
  });
  await loginAsEmu(page, ADMIN, '관리자');
  await page.goto('#/t/admin/roster');
  await page.getByRole('button', { name: /^김하늘/ }).click();
  const form = page.getByRole('form', { name: '김하늘 정보 고치기' });
  const save = form.getByRole('button', { name: '저장' });
  await expect(save).toBeDisabled(); // 바뀐 게 없으면 누를 수 없다

  // 추가 폼과 같은 검사
  await form.getByLabel('이름').fill('  ');
  await form.getByLabel('생일').fill('13-01');
  await save.click();
  await expect(form.getByText('이름을 적어 주세요')).toBeVisible();
  await expect(form.getByText('월-일로 적어 주세요 (예: 03-05)')).toBeVisible();

  await form.getByLabel('이름').fill('김하람');
  await form.getByLabel('생일').fill('0412');
  await save.click();
  await expectToast(page, '저장했어요');
  await expect(page.getByRole('button', { name: /^김하람/ })).toContainText('생일 4월 12일');

  const { page: student } = await openStudent(browser, `#/s/${TOKEN}`);
  await expect(student.getByText('김하람')).toBeVisible();
  await student.getByRole('tab', { name: '나' }).click();
  await expect(student.getByRole('heading', { name: '김하람' })).toBeVisible();
  await expect(student.getByText('4월 12일')).toBeVisible();
});

test('새 친구로 등록한 학생은 처음 출석한 주의 주보에 올라간다', async ({ page }) => {
  const lastSunday = toDateId(addDays(nearestSunday(new Date()), -7));
  await seed(async (db) => {
    await setDoc(doc(db, 'classes', 'classA'), { name: '1반', grade: 1, order: 1 });
  });
  await loginAsEmu(page, ADMIN, '관리자');
  await page.goto('#/t/admin/roster');

  const add = page.getByRole('form', { name: '학생 추가' });
  const check = add.getByRole('checkbox', { name: '새 친구' });
  await expect(check).not.toBeChecked();
  await add.getByLabel('학생 이름').fill('새봄');
  await check.check();
  await add.getByRole('button', { name: '학생 추가' }).click();
  await expectToast(page, '새봄 학생을 추가했어요');
  await expect(page.getByRole('button', { name: /^새봄/ })).toContainText('새 친구');
  await expect(check).not.toBeChecked(); // 추가 뒤 다시 꺼진다

  await seed(async (db) => {
    const snap = await getDocs(collection(db, 'students'));
    const token = snap.docs.find((d) => d.data().name === '새봄')!.id;
    await setDoc(doc(db, 'students', token, 'attendance', lastSunday), {
      date: lastSunday, present: true, by: 'seed', at: new Date(),
    });
  });

  await page.getByRole('link', { name: '관리 메뉴' }).click();
  await page.getByRole('link', { name: /^주보 작성/ }).click();
  await page.getByRole('button', { name: '출석·새 친구·생일 불러오기' }).click();
  await expectToast(page, '주일 출석을 불러왔어요');
  await expect(page.getByLabel('새 친구')).toHaveValue('새봄');
});

test('새 친구 표시는 나중에 끄고 켤 수 있다', async ({ page }) => {
  await seed(async (db) => {
    await setDoc(doc(db, 'classes', 'classA'), { name: '1반', grade: 1, order: 1 });
    await setDoc(doc(db, 'students', 'testStudentToken_00071'), {
      name: '새봄', classId: 'classA', birthday: null, active: true, streak: 0, lastPresent: null, newcomer: true,
    });
  });
  await loginAsEmu(page, ADMIN, '관리자');
  await page.goto('#/t/admin/roster');
  const row = page.getByRole('button', { name: /^새봄/ });
  await expect(row).toContainText('새 친구');
  await row.click();
  const form = page.getByRole('form', { name: '새봄 정보 고치기' });
  const check = form.getByRole('checkbox', { name: '새 친구' });
  await expect(check).toBeChecked();
  await expect(form.getByRole('button', { name: '저장' })).toBeDisabled();
  await check.uncheck();
  await form.getByRole('button', { name: '저장' }).click();
  await expectToast(page, '저장했어요');
  await expect(page.getByRole('button', { name: /^새봄/ })).not.toContainText('새 친구');

  await page.reload();
  await expect(page.getByRole('button', { name: /^새봄/ })).not.toContainText('새 친구');
  await page.getByRole('button', { name: /^새봄/ }).click();
  await expect(page.getByRole('form', { name: '새봄 정보 고치기' }).getByRole('checkbox', { name: '새 친구' })).not.toBeChecked();

  // 다시 켜면 meta 에 돌아온다
  await page.getByRole('form', { name: '새봄 정보 고치기' }).getByRole('checkbox', { name: '새 친구' }).check();
  await page.getByRole('form', { name: '새봄 정보 고치기' }).getByRole('button', { name: '저장' }).click();
  await expectToast(page, '저장했어요');
  await expect(page.getByRole('button', { name: /^새봄/ })).toContainText('새 친구');
});
