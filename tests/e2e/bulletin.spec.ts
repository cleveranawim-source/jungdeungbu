import { expect, test } from '@playwright/test';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { addDays, nearestSunday, toDateId } from '../../src/lib/dates';
import { clear, seed, seedAdmin } from './seed';

const ADMIN = 'admin@example.com';
const TOKEN = 'testStudentToken_00001'; // 22자
const CLASS_ID = 'classA';

// 앱과 같은 규칙으로 "이번 주" 주일을 잡는다
const SUNDAY = nearestSunday(new Date());
const THIS_SUNDAY = toDateId(SUNDAY);

const SERMON_TITLE = '두려움 대신 믿음으로';
const SUMMARY = '폭풍 속에서도 예수님은 우리와 같은 배에 계세요.';
const HYMN = '찬송가 288장 예수를 나의 구주 삼고';
const ANNOUNCEMENT = '중등부 겨울 수련회 신청';

async function seedStudent(): Promise<void> {
  await seed(async (db) => {
    await setDoc(doc(db, 'classes', CLASS_ID), { name: '1학년 1반', grade: 1, order: 1 });
    await setDoc(doc(db, 'students', TOKEN), {
      name: '김하늘', classId: CLASS_ID, birthday: null, active: true, streak: 0, lastPresent: null,
    });
  });
}

test.beforeEach(async () => {
  await clear();
  await seedAdmin(ADMIN);
  await seedStudent();
});

test('학생이 이번 주 주보·설교·광고를 본다', async ({ page }) => {
  await seed(async (db) => {
    await setDoc(doc(db, 'bulletins', THIS_SUNDAY), {
      date: THIS_SUNDAY,
      order: [
        { type: '묵도', title: '', detail: '' },
        { type: '기도', title: '대표기도', detail: '박은혜 선생님' },
        { type: '설교', title: SERMON_TITLE, detail: '' },
      ],
      hymns: [HYMN],
      scripture: '마가복음 4:35-41',
      sermonTitle: SERMON_TITLE,
      published: true,
      updatedBy: 'admin',
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'sermons', THIS_SUNDAY), {
      date: THIS_SUNDAY,
      title: SERMON_TITLE,
      scripture: '마가복음 4:35-41',
      summary: SUMMARY,
      body: '제자들은 바람을 보고 무서워했어요.\n\n예수님은 "잠잠하라" 하셨어요.',
      questions: ['요즘 내가 무서워하는 것은 무엇인가요?'],
    });
    await setDoc(doc(db, 'announcements', 'a1'), {
      title: ANNOUNCEMENT,
      body: '12월 7일까지 반 선생님께 신청해 주세요.',
      startDate: toDateId(addDays(SUNDAY, -3)),
      endDate: toDateId(addDays(SUNDAY, 3)),
      pinned: false,
      createdAt: serverTimestamp(),
    });
  });

  await page.goto(`#/s/${TOKEN}`);

  // 홈: 이번 주 주보 요약 카드와 광고
  await expect(page.getByRole('heading', { name: SERMON_TITLE })).toBeVisible();
  await expect(page.getByText(ANNOUNCEMENT)).toBeVisible();

  // 주보: 예배 순서 항목과 찬양
  await page.getByRole('tab', { name: '주보' }).click();
  await expect(page.getByRole('tab', { name: '주보' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('박은혜 선생님')).toBeVisible();
  await expect(page.getByText(HYMN)).toBeVisible();
  // 설교 제목은 말씀 화면으로 가는 링크
  await expect(page.getByRole('link', { name: SERMON_TITLE })).toBeVisible();

  // 말씀: 목록 → 상세(요약·적용 질문)
  await page.getByRole('tab', { name: '말씀' }).click();
  await page.getByRole('link', { name: new RegExp(SERMON_TITLE) }).click();
  await expect(page.getByText(SUMMARY)).toBeVisible();
  await expect(page.getByText('요즘 내가 무서워하는 것은 무엇인가요?')).toBeVisible();
});

test('주보 없는 주 안내', async ({ page }) => {
  await page.goto(`#/s/${TOKEN}`);
  await expect(page.getByText('이번 주 주보가 아직 없어요')).toBeVisible();
  await expect(page.getByRole('tab', { name: '홈' })).toHaveAttribute('aria-selected', 'true');
});
