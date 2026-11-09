import { assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc } from 'firebase/firestore'
import { it } from 'vitest'
import { asAnon, useRulesEnv } from './setup'

const env = useRulesEnv()

it('익명은 교사 문서를 못 읽는다', async () => {
  await assertFails(getDoc(doc(asAnon(env()), 'teachers/admin1')))
})
