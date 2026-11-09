import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { it } from 'vitest'
import { ADMIN, asAnon, asUser, useRulesEnv } from './setup'

const env = useRulesEnv()

it('익명은 교사 문서를 못 읽는다', async () => {
  await assertFails(getDoc(doc(asAnon(env()), 'teachers/admin1')))
})

it('규칙에 없는 컬렉션은 admin도 읽고 쓸 수 없다', async () => {
  const admin = asUser(env(), ADMIN)
  await assertSucceeds(setDoc(doc(admin, 'settings/bulletinTemplate'), { order: [] }))
  await assertFails(setDoc(doc(admin, 'misc/x'), { a: 1 }))
  await assertFails(getDoc(doc(admin, 'misc/x')))
  await assertFails(getDoc(doc(asAnon(env()), 'students/x/other/y')))
})
