import { expect, test } from 'vitest'
import { createClass, getClass, listClasses, updateClass } from '../../src/data/classes'
import { isToken } from '../../src/lib/token'
import { ADMIN, asAnon, asUser, TEACHER_A, useRulesEnv } from '../rules/setup'

const env = useRulesEnv()

test('listClasses는 order 순', async () => {
  const admin = asUser(env(), ADMIN)
  const id = await createClass(admin, { name: '0반', grade: 1, order: 0 })
  expect(isToken(id)).toBe(true)
  expect((await listClasses(asUser(env(), TEACHER_A))).map((c) => c.id)).toEqual([id, 'classA', 'classB'])
})

test('updateClass·getClass', async () => {
  const admin = asUser(env(), ADMIN)
  await updateClass(admin, 'classA', { name: '1학년 사랑반' })
  expect(await getClass(asAnon(env()), 'classA')).toEqual({ name: '1학년 사랑반', grade: 1, order: 1 })
  expect(await getClass(asAnon(env()), 'Tok3n_X-doesNotExist01')).toBeNull()
  await expect(updateClass(asUser(env(), TEACHER_A), 'classA', { order: 9 })).rejects.toMatchObject({
    code: 'permission-denied',
  })
})
