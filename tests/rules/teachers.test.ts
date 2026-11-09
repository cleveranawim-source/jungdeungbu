import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore'
import { beforeEach, describe, expect, test } from 'vitest'
import { ADMIN, asAnon, asUser, OUTSIDER, seed, TEACHER_A, TEACHER_B, type TestUser, useRulesEnv } from './setup'

const env = useRulesEnv()

const NEW: TestUser = { uid: 'tNew', email: 'new@example.com' }
const NEW_INVITE = { name: '새선생님', role: 'teacher', classIds: ['classA'] }
const NEW_TEACHER = { email: NEW.email, ...NEW_INVITE }

describe('teachers 생성', () => {
  beforeEach(async () => {
    await seed(env(), (db) => setDoc(doc(db, 'invites/new@example.com'), NEW_INVITE))
  })

  test('초대된 이메일은 자기 teachers 문서를 만들 수 있다', async () => {
    const db = asUser(env(), NEW)
    await assertSucceeds(setDoc(doc(db, 'teachers/tNew'), NEW_TEACHER))
    const snap = await assertSucceeds(getDoc(doc(db, 'teachers/tNew')))
    expect(snap.data()).toEqual(NEW_TEACHER)
  })

  test('대문자가 섞인 로그인 이메일도 소문자 초대와 맞춰 만든다', async () => {
    const db = env().authenticatedContext('tNew', { email: 'New@Example.COM', email_verified: true }).firestore()
    await assertSucceeds(getDoc(doc(db, 'invites/new@example.com')))
    await assertSucceeds(setDoc(doc(db, 'teachers/tNew'), NEW_TEACHER))
  })

  test('초대 없는 계정은 만들 수 없다', async () => {
    await assertSucceeds(setDoc(doc(asUser(env(), NEW), 'teachers/tNew'), NEW_TEACHER))
    await assertFails(
      setDoc(doc(asUser(env(), OUTSIDER), 'teachers/xU'), { email: OUTSIDER.email, ...NEW_INVITE }),
    )
  })

  test('초대 role이 teacher인데 admin으로 만들면 거부', async () => {
    const db = asUser(env(), NEW)
    await assertFails(setDoc(doc(db, 'teachers/tNew'), { ...NEW_TEACHER, role: 'admin' }))
    await assertSucceeds(setDoc(doc(db, 'teachers/tNew'), NEW_TEACHER))
  })

  test('초대와 다른 classIds·name·email, 또는 여분 키는 거부', async () => {
    const db = asUser(env(), NEW)
    await assertFails(setDoc(doc(db, 'teachers/tNew'), { ...NEW_TEACHER, classIds: ['classA', 'classB'] }))
    await assertFails(setDoc(doc(db, 'teachers/tNew'), { ...NEW_TEACHER, name: '다른이름' }))
    await assertFails(setDoc(doc(db, 'teachers/tNew'), { ...NEW_TEACHER, email: 'a@example.com' }))
    await assertFails(setDoc(doc(db, 'teachers/tNew'), { ...NEW_TEACHER, extra: true }))
    const { name: _omit, ...noName } = NEW_TEACHER
    await assertFails(setDoc(doc(db, 'teachers/tNew'), noName))
    await assertSucceeds(setDoc(doc(db, 'teachers/tNew'), NEW_TEACHER))
  })

  test('이메일 인증이 안 된 토큰은 거부', async () => {
    const unverified = env().authenticatedContext('tNew', { email: NEW.email, email_verified: false }).firestore()
    await assertFails(setDoc(doc(unverified, 'teachers/tNew'), NEW_TEACHER))
    await assertSucceeds(setDoc(doc(asUser(env(), NEW), 'teachers/tNew'), NEW_TEACHER))
  })

  test('다른 uid 문서는 만들 수 없다', async () => {
    const db = asUser(env(), NEW)
    await assertFails(setDoc(doc(db, 'teachers/someoneElse'), NEW_TEACHER))
    await assertSucceeds(setDoc(doc(db, 'teachers/tNew'), NEW_TEACHER))
  })

  test('익명은 만들 수 없다', async () => {
    await assertFails(setDoc(doc(asAnon(env()), 'teachers/tNew'), NEW_TEACHER))
  })
})

describe('teachers 수정·삭제', () => {
  test('교사는 자기 문서도 수정 못 하고(승급 불가) admin은 수정한다', async () => {
    await assertFails(updateDoc(doc(asUser(env(), TEACHER_A), 'teachers/tA'), { role: 'admin' }))
    await assertFails(updateDoc(doc(asUser(env(), TEACHER_A), 'teachers/tA'), { classIds: ['classA', 'classB'] }))
    await assertSucceeds(updateDoc(doc(asUser(env(), ADMIN), 'teachers/tA'), { classIds: ['classA', 'classB'] }))
  })

  test('기존 문서 위에 setDoc으로 다시 만들기(=수정)는 교사에게 거부', async () => {
    await assertFails(
      setDoc(doc(asUser(env(), TEACHER_A), 'teachers/tA'), {
        email: TEACHER_A.email,
        name: '선생님A',
        role: 'teacher',
        classIds: ['classA'],
      }),
    )
  })

  test('삭제는 admin만', async () => {
    await assertFails(deleteDoc(doc(asUser(env(), TEACHER_A), 'teachers/tB')))
    await assertFails(deleteDoc(doc(asUser(env(), TEACHER_A), 'teachers/tA')))
    await assertSucceeds(deleteDoc(doc(asUser(env(), ADMIN), 'teachers/tB')))
  })
})

describe('teachers 읽기', () => {
  test('교사는 다른 교사 문서를 못 읽고 admin은 읽는다', async () => {
    const a = asUser(env(), TEACHER_A)
    await assertSucceeds(getDoc(doc(a, 'teachers/tA')))
    await assertFails(getDoc(doc(a, 'teachers/tB')))
    await assertFails(getDoc(doc(a, 'teachers/admin1')))
    await assertSucceeds(getDoc(doc(asUser(env(), ADMIN), 'teachers/tB')))
  })

  test('teachers list는 admin만', async () => {
    const all = await assertSucceeds(getDocs(collection(asUser(env(), ADMIN), 'teachers')))
    expect(all.size).toBe(3)
    await assertFails(getDocs(collection(asUser(env(), TEACHER_A), 'teachers')))
    await assertFails(getDocs(collection(asAnon(env()), 'teachers')))
  })

  test('교사 문서 없는 로그인 사용자는 자기 uid 문서 get만 된다(없는 문서)', async () => {
    const x = asUser(env(), OUTSIDER)
    await assertSucceeds(getDoc(doc(x, 'teachers/xU')))
    await assertFails(getDoc(doc(x, 'teachers/tA')))
  })
})

describe('invites', () => {
  test('invites는 본인 이메일만 get, list는 admin만', async () => {
    const a = asUser(env(), TEACHER_A)
    await assertSucceeds(getDoc(doc(a, 'invites/a@example.com')))
    await assertFails(getDoc(doc(a, 'invites/b@example.com')))
    await assertSucceeds(getDoc(doc(asUser(env(), TEACHER_B), 'invites/b@example.com')))
    await assertSucceeds(getDoc(doc(asUser(env(), OUTSIDER), 'invites/x@example.com')))
    await assertFails(getDoc(doc(asAnon(env()), 'invites/a@example.com')))
    await assertSucceeds(getDoc(doc(asUser(env(), ADMIN), 'invites/b@example.com')))

    const all = await assertSucceeds(getDocs(collection(asUser(env(), ADMIN), 'invites')))
    expect(all.size).toBe(3)
    await assertFails(getDocs(collection(a, 'invites')))
    await assertFails(getDocs(collection(asUser(env(), OUTSIDER), 'invites')))
    await assertFails(getDocs(collection(asAnon(env()), 'invites')))
  })

  test('invites 쓰기는 admin만', async () => {
    const invite = { name: '새선생님', role: 'teacher', classIds: ['classA'] }
    await assertFails(setDoc(doc(asUser(env(), TEACHER_A), 'invites/x@example.com'), invite))
    await assertFails(updateDoc(doc(asUser(env(), TEACHER_A), 'invites/a@example.com'), { role: 'admin' }))
    await assertFails(setDoc(doc(asUser(env(), OUTSIDER), 'invites/x@example.com'), invite))
    await assertFails(deleteDoc(doc(asUser(env(), TEACHER_A), 'invites/b@example.com')))
    const admin = asUser(env(), ADMIN)
    await assertSucceeds(setDoc(doc(admin, 'invites/x@example.com'), invite))
    await assertSucceeds(updateDoc(doc(admin, 'invites/a@example.com'), { classIds: ['classA', 'classB'] }))
    await assertSucceeds(deleteDoc(doc(admin, 'invites/b@example.com')))
  })
})
