import { expect, test } from '@playwright/test';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { addDays, formatMonthDay, nearestSunday, toDateId } from '../../src/lib/dates';
import { clear, seed } from './seed';

const TOKEN = 'celebrateStudent000001';
const SUNDAY = nearestSunday(new Date());
const SUN = toDateId(SUNDAY);
const BIRTHDAY = '오한결, 생일을 축하해요';
const ACKNOWLEDGEMENT = /\d+주째 함께 예배했어요/;

async function seedStudent(streak: number, lastPresent: string | null, birthday: string | null) {
  await seed(async (db) => {
    await setDoc(doc(db, 'classes', 'classA'), { name: '1반', grade: 1, order: 1 });
    await setDoc(doc(db, 'students', TOKEN), {
      name: '오한결', classId: 'classA', birthday, active: true, streak, lastPresent,
    });
    if (lastPresent) {
      await setDoc(doc(db, 'students', TOKEN, 'attendance', lastPresent), {
        date: lastPresent, present: true, by: 'seed', at: Timestamp.now(),
      });
    }
  });
}

test.beforeEach(clear);

test('생일은 홈에, 8주 축하는 나의 출석 기록에만 보여요', async ({ page }) => {
  await seedStudent(8, SUN, SUN.slice(5));
  await page.goto(`#/s/${TOKEN}`);
  await expect(page.getByText(BIRTHDAY)).toBeVisible();
  await expect(page.getByText(ACKNOWLEDGEMENT)).toHaveCount(0);
  await expect(page.getByText(/^연속 출석/)).toHaveCount(0);

  await page.getByRole('tab', { name: '나', exact: true }).click();
  const attendance = page.locator('section').filter({
    has: page.getByRole('heading', { name: '이번 학기 출석', exact: true }),
  });
  await expect(attendance.getByText('연속 출석 8주')).toBeVisible();
  await expect(attendance.getByText('8주째 함께 예배했어요')).toBeVisible();
  await expect(page.getByText(BIRTHDAY)).toHaveCount(0);
  await expect(page.getByText('이번 학기에 1번 왔어요')).toBeVisible();
  await expect(page.getByRole('img', { name: `${formatMonthDay(SUN)} 출석, 이번 주`, exact: true })).toBeVisible();

  await page.getByRole('tab', { name: '홈', exact: true }).click();
  await expect(page.getByText(BIRTHDAY)).toBeVisible();
  await expect(page.getByText(ACKNOWLEDGEMENT)).toHaveCount(0);
});

for (const sample of [
  { label: '출석 기록 없음', streak: 0, lastPresent: null, summary: null },
  { label: '3주 연속', streak: 3, lastPresent: SUN, summary: '연속 출석 3주' },
  { label: '두 주 전에 멈춘 8주', streak: 8, lastPresent: toDateId(addDays(SUNDAY, -14)), summary: null },
]) {
  test(`${sample.label}: 축하를 만들지 않고 학기 기록은 그대로 보여요`, async ({ page }) => {
    await seedStudent(sample.streak, sample.lastPresent, toDateId(addDays(SUNDAY, 10)).slice(5));
    await page.goto(`#/s/${TOKEN}`);
    await expect(page.getByRole('heading', { name: '오한결, 반가워요' })).toBeVisible();
    await expect(page.getByRole('region', { name: '축하해요' })).toHaveCount(0);
    await expect(page.getByText(ACKNOWLEDGEMENT)).toHaveCount(0);

    await page.getByRole('tab', { name: '나', exact: true }).click();
    await expect(page.getByRole('heading', { name: '이번 학기 출석' })).toBeVisible();
    await expect(page.getByText(ACKNOWLEDGEMENT)).toHaveCount(0);
    await expect(page.getByText(BIRTHDAY)).toHaveCount(0);
    await expect(page.getByText('연속 출석 0주')).toHaveCount(0);
    if (sample.summary) {
      await expect(page.getByText(sample.summary)).toBeVisible();
    } else {
      await expect(page.getByText(/^연속 출석/)).toHaveCount(0);
    }
    const todayStatus = sample.lastPresent === SUN ? '출석' : '기록 없음';
    await expect(page.getByRole('img', { name: `${formatMonthDay(SUN)} ${todayStatus}, 이번 주`, exact: true })).toBeVisible();
    if (sample.streak === 0) {
      await expect(page.getByText('이번 학기 첫 출석을 기다리고 있어요')).toBeVisible();
    }
  });
}
