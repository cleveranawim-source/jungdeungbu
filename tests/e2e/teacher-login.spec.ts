// 교사 로그인: 카카오톡 등 앱 안 브라우저에서는 Google 버튼 대신 바깥 브라우저로 여는 안내.
import { expect, test, type Browser } from '@playwright/test';
import { doc, setDoc } from 'firebase/firestore';
import { expectToast, loginAsEmu } from './helpers';
import { clear, seed, seedAdmin } from './seed';

const KAKAO_ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.58 Mobile Safari/537.36;KAKAOTALK 2410960';
const KAKAO_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.9.0';

async function openAs(browser: Browser, userAgent: string) {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    viewport: { width: 390, height: 844 },
    userAgent,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();
  await page.goto('#/t');
  return { context, page };
}

test('보통 브라우저는 Google 로그인 버튼', async ({ page }) => {
  await page.goto('#/t');
  await expect(page.getByRole('button', { name: 'Google로 로그인' })).toBeVisible();
  await expect(page.getByText(/안 브라우저에서는 Google 로그인이 안 돼요/)).toHaveCount(0);
});

test('안드로이드 카카오톡: 안내, Chrome으로 열기, 주소 복사', async ({ browser }) => {
  const { context, page } = await openAs(browser, KAKAO_ANDROID);
  try {
    await expect(page.getByText("카카오톡 안 브라우저에서는 Google 로그인이 안 돼요. 오른쪽 위 메뉴에서 'Safari/Chrome으로 열기'를 눌러 주세요")).toBeVisible();
    await expect(page.getByRole('button', { name: 'Google로 로그인' })).toHaveCount(0);
    const href = await page.getByRole('link', { name: 'Chrome으로 열기' }).getAttribute('href');
    expect(href).toBe(`kakaotalk://web/openExternal?url=${encodeURIComponent(page.url())}`);
    await page.getByRole('button', { name: '주소 복사' }).click();
    await expectToast(page, '주소를 복사했어요. Safari나 Chrome 주소창에 붙여 넣어 주세요');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url());
    // 시험용 에뮬레이터 로그인은 그대로 있다
    await expect(page.getByRole('button', { name: '에뮬레이터 로그인' })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('iOS 카카오톡: Chrome으로 열기 링크 없이 안내와 주소 복사', async ({ browser }) => {
  const { context, page } = await openAs(browser, KAKAO_IOS);
  try {
    await expect(page.getByText(/카카오톡 안 브라우저에서는 Google 로그인이 안 돼요/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Chrome으로 열기' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '주소 복사' })).toBeVisible();
  } finally {
    await context.close();
  }
});

/** 이 페이지의 Firestore IndexedDB 캐시에 들어 있는 문서 수(remoteDocuments 저장소). */
async function cachedDocCount(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(async () => {
    const dbs = (await indexedDB.databases()).filter((d) => d.name?.startsWith('firestore/'));
    let n = 0;
    for (const info of dbs) {
      const idb = await new Promise<IDBDatabase>((res, rej) => {
        const r = indexedDB.open(info.name!);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const stores = [...idb.objectStoreNames].filter((s) => s.startsWith('remoteDocuments'));
      for (const s of stores) {
        n += await new Promise<number>((res, rej) => {
          const r = idb.transaction(s).objectStore(s).count();
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
      }
      idb.close();
    }
    return n;
  });
}

test('로그아웃하면 이 기기의 Firestore 캐시를 비우고, 다시 로그인할 수 있다', async ({ page }) => {
  await clear();
  await seedAdmin('admin@example.com');
  await seed(async (db) => {
    await setDoc(doc(db, 'classes/classA'), { name: '1반', grade: 1, order: 1 });
    await setDoc(doc(db, 'students/logoutCacheToken_00001'), {
      name: '김하늘', classId: 'classA', birthday: null, active: true, streak: 0, lastPresent: null,
    });
  });
  await loginAsEmu(page, 'admin@example.com', '관리자');
  await expect(page.getByRole('button', { name: /김하늘/ })).toBeVisible();
  await expect.poll(() => cachedDocCount(page)).toBeGreaterThan(0);

  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page.getByRole('button', { name: '에뮬레이터 로그인' })).toBeVisible();
  await expect(page).toHaveURL(/#\/t$/);
  expect(await cachedDocCount(page)).toBe(0);

  // 같은 기기에서 다시 로그인하면 그대로 동작한다
  await loginAsEmu(page, 'admin@example.com', '관리자');
  await expect(page.getByRole('button', { name: /김하늘/ })).toBeVisible();
});
