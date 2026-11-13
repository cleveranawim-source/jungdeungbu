import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { beforeEach, describe, test } from 'vitest'
import { ADMIN, asAnon, asStudent, asUser, OUTSIDER, seed, STUDENT_A, STUDENT_A_UID, TEACHER_A, TOKEN_A, useRulesEnv } from './setup'

const env = useRulesEnv()

const DATE = '2026-11-15'
const MEMBERS = `bulletins/${DATE}/members/main`
const INFO = 'memberInfo/main'

describe('잠긴 문서: members · memberInfo', () => {
  beforeEach(async () => {
    await seed(env(), async (db) => {
      await setDoc(doc(db, `bulletins/${DATE}`), { date: DATE, published: true })
      await setDoc(doc(db, MEMBERS), { newFriends: ['윤새봄'], birthdays: [] })
      await setDoc(doc(db, INFO), { servants: [], contacts: [{ label: '이승열 목사님', phone: '010-0000-0000' }] })
    })
  })

  test('로그인 없는 사람은 members·memberInfo 를 못 읽는다', async () => {
    const anon = asAnon(env())
    await assertFails(getDoc(doc(anon, MEMBERS)))
    await assertFails(getDoc(doc(anon, INFO)))
  })

  test('세션 없는 익명 로그인도 못 읽는다', async () => {
    const s = asStudent(env(), 'noSession')
    await assertFails(getDoc(doc(s, MEMBERS)))
    await assertFails(getDoc(doc(s, INFO)))
  })

  test('활성 학생 세션은 읽는다', async () => {
    const s = asStudent(env(), STUDENT_A_UID)
    await assertSucceeds(getDoc(doc(s, MEMBERS)))
    await assertSucceeds(getDoc(doc(s, INFO)))
  })

  test('링크가 죽은(비활성) 학생 세션은 못 읽는다', async () => {
    await seed(env(), (db) => setDoc(doc(db, `students/${TOKEN_A}`), { ...STUDENT_A, active: false }))
    const s = asStudent(env(), STUDENT_A_UID)
    await assertFails(getDoc(doc(s, MEMBERS)))
    await assertFails(getDoc(doc(s, INFO)))
  })

  test('세션이 가리키는 학생 문서가 없으면 못 읽는다', async () => {
    await seed(env(), (db) => setDoc(doc(db, 'studentSessions/ghost'), { token: 'Gh0st_Tok-q8Zr2Lm5Nx7' }))
    const s = asStudent(env(), 'ghost')
    await assertFails(getDoc(doc(s, MEMBERS)))
    await assertFails(getDoc(doc(s, INFO)))
  })

  test('임시저장 주보의 members 는 학생이 못 읽고 선생님은 읽는다', async () => {
    await seed(env(), (db) => setDoc(doc(db, `bulletins/${DATE}`), { date: DATE, published: false }))
    const s = asStudent(env(), STUDENT_A_UID)
    await assertFails(getDoc(doc(s, MEMBERS)))
    await assertSucceeds(getDoc(doc(asUser(env(), TEACHER_A), MEMBERS)))
    await assertSucceeds(getDoc(doc(s, INFO)))
  })

  test('초대 없는 Google 계정은 못 읽는다', async () => {
    const o = asUser(env(), OUTSIDER)
    await assertFails(getDoc(doc(o, MEMBERS)))
    await assertFails(getDoc(doc(o, INFO)))
  })

  test('쓰기는 관리자만, main 문서에 정해진 키만', async () => {
    const admin = asUser(env(), ADMIN)
    await assertSucceeds(setDoc(doc(admin, MEMBERS), { newFriends: [], birthdays: [] }))
    await assertFails(setDoc(doc(asUser(env(), TEACHER_A), MEMBERS), { newFriends: [], birthdays: [] }))
    await assertFails(setDoc(doc(asStudent(env(), STUDENT_A_UID), MEMBERS), { newFriends: [], birthdays: [] }))
    await assertFails(setDoc(doc(admin, `bulletins/${DATE}/members/other`), { newFriends: [], birthdays: [] }))
    await assertFails(setDoc(doc(admin, MEMBERS), { newFriends: [], birthdays: [], offerings: ['x'] }))
    await assertSucceeds(setDoc(doc(admin, INFO), { servants: [], contacts: [] }))
    await assertFails(setDoc(doc(admin, INFO), { servants: [], contacts: [], x: 1 }))
    await assertFails(setDoc(doc(admin, 'memberInfo/other'), { servants: [], contacts: [] }))
    await assertFails(setDoc(doc(asUser(env(), TEACHER_A), INFO), { servants: [], contacts: [] }))
  })

  test('활성 학생 세션이라도 memberInfo·members 를 쓰지 못한다', async () => {
    const s = asStudent(env(), STUDENT_A_UID)
    await assertFails(setDoc(doc(s, INFO), { servants: [], contacts: [] }))
    await assertFails(setDoc(doc(s, MEMBERS), { newFriends: [], birthdays: [] }))
  })

  test('members·memberInfo 는 목록 질의가 안 된다', async () => {
    for (const db of [asStudent(env(), STUDENT_A_UID), asUser(env(), TEACHER_A)]) {
      await assertFails(getDocs(collection(db, 'memberInfo')))
      await assertFails(getDocs(collection(db, 'bulletins', DATE, 'members')))
    }
  })

  test('members 컬렉션 그룹 질의는 누구도 안 된다', async () => {
    for (const db of [asAnon(env()), asStudent(env(), STUDENT_A_UID), asUser(env(), TEACHER_A), asUser(env(), ADMIN)]) {
      await assertFails(getDocs(collectionGroup(db, 'members')))
    }
  })

  test('members·memberInfo 삭제는 선생님·학생 세션이 못 하고, 관리자도 main 이 아닌 문서는 못 지운다', async () => {
    for (const db of [asUser(env(), TEACHER_A), asStudent(env(), STUDENT_A_UID)]) {
      await assertFails(deleteDoc(doc(db, MEMBERS)))
      await assertFails(deleteDoc(doc(db, INFO)))
    }
    const admin = asUser(env(), ADMIN)
    await assertFails(deleteDoc(doc(admin, `bulletins/${DATE}/members/other`)))
    await assertFails(deleteDoc(doc(admin, 'memberInfo/other')))
    await assertSucceeds(deleteDoc(doc(admin, MEMBERS)))
    await assertSucceeds(deleteDoc(doc(admin, INFO)))
  })

  test('부모 주보가 없는 members 는 학생 세션이 못 읽는다', async () => {
    const ORPHAN = '2026-11-22'
    await seed(env(), (db) => setDoc(doc(db, `bulletins/${ORPHAN}/members/main`), { newFriends: ['다온'], birthdays: [] }))
    await assertFails(getDoc(doc(asStudent(env(), STUDENT_A_UID), `bulletins/${ORPHAN}/members/main`)))
    await assertSucceeds(getDoc(doc(asUser(env(), TEACHER_A), `bulletins/${ORPHAN}/members/main`)))
  })
})
