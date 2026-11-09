import { assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc } from 'firebase/firestore'
import { it } from 'vitest'
import { asAnon, makeEnv } from './setup'

it('익명은 아무것도 못 읽는다', async () => {
  const env = await makeEnv()
  await assertFails(getDoc(doc(asAnon(env), 'bulletins/2026-11-15')))
  await env.cleanup()
})
