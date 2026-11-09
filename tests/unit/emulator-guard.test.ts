import type { Auth } from 'firebase/auth'
import { expect, test } from 'vitest'
import { signInAsEmulatorUser } from '../../src/data/teachers'

test('signInAsEmulatorUser는 에뮬레이터가 아니면 거부', async () => {
  await expect(signInAsEmulatorUser({} as Auth, 'a@example.com', 'A')).rejects.toThrow('에뮬레이터')
})
