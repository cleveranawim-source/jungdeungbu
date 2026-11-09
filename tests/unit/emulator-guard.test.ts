import type { Auth } from 'firebase/auth'
import { afterEach, expect, test, vi } from 'vitest'

// USING_EMULATOR는 모듈을 읽을 때 정해지므로, 환경변수를 고정한 뒤 모듈을 새로 읽는다
// (개발자의 .env.local 값과 상관없이 같은 결과).
async function loadTeachers(useEmulator: string) {
  vi.stubEnv('VITE_USE_EMULATOR', useEmulator)
  vi.resetModules()
  return import('../../src/data/teachers')
}

afterEach(() => {
  vi.unstubAllEnvs()
})

test('signInAsEmulatorUser는 에뮬레이터가 아니면 거부', async () => {
  const { signInAsEmulatorUser } = await loadTeachers('')
  await expect(signInAsEmulatorUser({} as Auth, 'a@example.com', 'A')).rejects.toThrow('에뮬레이터에서만')
})

test('VITE_USE_EMULATOR=1이면 가드를 지나 실제 로그인을 시도한다', async () => {
  const { signInAsEmulatorUser } = await loadTeachers('1')
  // 가짜 auth라 Firebase 쪽에서 실패하지만, 가드 오류는 아니다
  await expect(signInAsEmulatorUser({} as Auth, 'a@example.com', 'A')).rejects.not.toThrow('에뮬레이터에서만')
})
