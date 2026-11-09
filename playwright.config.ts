// e2e: `npm run test:e2e` 가 Firestore·Auth 에뮬레이터를 띄운 뒤 이 설정으로 playwright 를 돌린다.
// 개발 서버는 에뮬레이터에 붙도록 VITE_USE_EMULATOR=1 로 띄운다(Firestore 8080, Auth 9099).
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  // 모든 시험이 같은 에뮬레이터 데이터를 비우고 쓰므로 한 번에 하나씩
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173/jungdeungbu/',
    viewport: { width: 390, height: 844 },
    permissions: ['clipboard-read', 'clipboard-write'],
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } }],
  webServer: {
    command: 'VITE_USE_EMULATOR=1 npm run dev -- --strictPort',
    port: 5173,
    // 에뮬레이터가 아닌 서버를 잘못 이어 쓰지 않게 늘 새로 띄운다
    reuseExistingServer: false,
    timeout: 60000,
  },
});
