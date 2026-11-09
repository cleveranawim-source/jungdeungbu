import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

/** 화면의 링크 문구(`김하늘아, 중등부 앱이야 → http…#/s/토큰`)에서 학생 주소 해시만 꺼낸다. */
export function studentHash(text: string): string {
  const m = /#\/s\/[A-Za-z0-9_-]{22}/.exec(text);
  if (!m) throw new Error(`학생 링크를 찾지 못했어요: ${text}`);
  return m[0];
}

/**
 * `#/t` 의 에뮬레이터 로그인 폼으로 로그인한다. 기본은 교사 탭 바가 보일 때까지 기다린다
 * (초대 없는 계정처럼 탭 바가 없는 화면을 볼 때는 `expectTabBar: false`).
 */
export async function loginAsEmu(
  page: Page,
  email: string,
  name: string,
  { expectTabBar = true }: { expectTabBar?: boolean } = {},
): Promise<void> {
  await page.goto('#/t');
  await page.getByLabel('이메일').fill(email);
  await page.getByLabel('이름').fill(name);
  await page.getByRole('button', { name: '에뮬레이터 로그인' }).click();
  if (expectTabBar) await expect(page.getByRole('tablist', { name: '교사 메뉴' })).toBeVisible();
}

/** 클립보드 글자(헤드리스 Chromium 에는 navigator.share 가 없어 링크 공유는 복사로 끝난다). */
export async function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

/**
 * 토스트 문구. 보이는 토스트와 화면 읽기용 알림 영역(status/alert)에 같은 글이 들어가므로
 * 화면 읽기에 읽히는 쪽(역할이 있는 영역)으로 확인한다.
 */
export async function expectToast(page: Page, message: string, kind: 'info' | 'error' = 'info'): Promise<void> {
  await expect(page.getByRole(kind === 'info' ? 'status' : 'alert').filter({ hasText: message })).toHaveCount(1);
}

// ---------- 학생 기기 ----------

const studentContexts: BrowserContext[] = [];

/**
 * 학생 링크를 **새 브라우저 컨텍스트**(다른 기기)에서 연다. 같은 컨텍스트의 새 탭은 Firebase Auth 의 IndexedDB 를
 * 함께 써서 선생님 로그인이 그대로 붙으므로(학생 화면이 "선생님 기기" 로 돈다) 학생 경험을 보는 시험은 이걸 쓴다.
 * 시험이 끝나면 `test.afterEach(closeStudents)` 로 닫는다.
 */
export async function openStudent(browser: Browser, href: string): Promise<{ page: Page; context: BrowserContext }> {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    viewport: { width: 390, height: 844 },
  });
  studentContexts.push(context);
  const page = await context.newPage();
  await page.goto(href);
  return { page, context };
}

/** openStudent 로 연 컨텍스트를 모두 닫는다(afterEach 에서). */
export async function closeStudents(): Promise<void> {
  await Promise.all(studentContexts.splice(0).map((c) => c.close()));
}

/**
 * 학생 기기가 익명 학생 세션으로 돌고 있는지(선생님 기기면 기도 올리기가 잠기고 안내가 뜬다).
 * 기도 탭으로 옮겨 확인한다.
 */
export async function expectAnonymousStudent(page: Page): Promise<void> {
  await page.getByRole('tab', { name: '기도' }).click();
  await expect(page.getByRole('button', { name: '올리기' })).toBeEnabled();
  await expect(page.getByText('선생님 계정으로 로그인된 기기예요')).toHaveCount(0);
}
