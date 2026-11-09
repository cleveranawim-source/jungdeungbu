import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { describe, expect, test } from 'vitest'
import {
  ADMIN,
  asAnon,
  asStudent,
  asUser,
  OUTSIDER,
  seed,
  STUDENT_A,
  STUDENT_A_UID,
  STUDENT_B_UID,
  TEACHER_A,
  TEACHER_B,
  TOKEN_A,
  TOKEN_B,
  useRulesEnv,
} from './setup'

const env = useRulesEnv()

const NEW_TOKEN = 'Tok3n_N-newStudent0001'
const NEW_STUDENT = { name: '박새봄', classId: 'classA', birthday: null, active: true, streak: 0, lastPresent: null }
const TOKEN_INACTIVE = 'Tok3n_I-inactiveStud01'
const TOKEN_NONE = 'Tok3n_Z-noStudentDoc00'

async function seedInactive() {
  await seed(env(), (db) => setDoc(doc(db, `students/${TOKEN_INACTIVE}`), { ...STUDENT_A, active: false }))
}

describe('students 읽기', () => {
  test('익명도 토큰으로 학생 get 가능', async () => {
    const snap = await assertSucceeds(getDoc(doc(asAnon(env()), `students/${TOKEN_A}`)))
    expect(snap.data()).toEqual(STUDENT_A)
  })

  test('비활성 학생은 토큰으로 get 불가, 교사는 가능', async () => {
    await seedInactive()
    await assertSucceeds(getDoc(doc(asAnon(env()), `students/${TOKEN_A}`)))
    await assertFails(getDoc(doc(asAnon(env()), `students/${TOKEN_INACTIVE}`)))
    await assertFails(getDoc(doc(asStudent(env(), STUDENT_A_UID), `students/${TOKEN_INACTIVE}`)))
    await assertFails(getDoc(doc(asUser(env(), OUTSIDER), `students/${TOKEN_INACTIVE}`)))
    // 교사는 반과 상관없이 비활성 문서도 읽는다(재발급·관리 화면)
    await assertSucceeds(getDoc(doc(asUser(env(), TEACHER_B), `students/${TOKEN_INACTIVE}`)))
    await assertSucceeds(getDoc(doc(asUser(env(), ADMIN), `students/${TOKEN_INACTIVE}`)))
  })

  test('없는 토큰 get도 익명에게는 거부된다(비활성과 구분되지 않음)', async () => {
    await assertSucceeds(getDoc(doc(asAnon(env()), `students/${TOKEN_A}`)))
    await assertFails(getDoc(doc(asAnon(env()), `students/${TOKEN_NONE}`)))
    const snap = await assertSucceeds(getDoc(doc(asUser(env(), TEACHER_A), `students/${TOKEN_NONE}`)))
    expect(snap.exists()).toBe(false)
  })

  test('익명·교사 아닌 로그인은 students list 불가, 교사는 가능', async () => {
    const byTeacher = await assertSucceeds(getDocs(collection(asUser(env(), TEACHER_A), 'students')))
    expect(byTeacher.size).toBe(2)
    const byAdmin = await assertSucceeds(
      getDocs(query(collection(asUser(env(), ADMIN), 'students'), where('classId', '==', 'classB'))),
    )
    expect(byAdmin.size).toBe(1)
    await assertFails(getDocs(collection(asAnon(env()), 'students')))
    await assertFails(getDocs(collection(asUser(env(), OUTSIDER), 'students')))
    await assertFails(getDocs(query(collection(asAnon(env()), 'students'), where('classId', '==', 'classA'))))
  })
})

describe('students 쓰기', () => {
  test('학생 생성·삭제는 admin만', async () => {
    await assertFails(setDoc(doc(asUser(env(), TEACHER_A), `students/${NEW_TOKEN}`), NEW_STUDENT))
    await assertFails(setDoc(doc(asAnon(env()), `students/${NEW_TOKEN}`), NEW_STUDENT))
    await assertSucceeds(setDoc(doc(asUser(env(), ADMIN), `students/${NEW_TOKEN}`), NEW_STUDENT))

    await assertFails(deleteDoc(doc(asUser(env(), TEACHER_A), `students/${TOKEN_A}`)))
    await assertFails(deleteDoc(doc(asAnon(env()), `students/${TOKEN_A}`)))
    await assertSucceeds(deleteDoc(doc(asUser(env(), ADMIN), `students/${TOKEN_A}`)))
  })

  test('학생 문서 ID가 토큰 형식이 아니면 admin도 생성 불가', async () => {
    const admin = asUser(env(), ADMIN)
    await assertSucceeds(setDoc(doc(admin, `students/${NEW_TOKEN}`), NEW_STUDENT))
    await assertFails(setDoc(doc(admin, 'students/notAToken'), NEW_STUDENT))
    await assertFails(setDoc(doc(admin, `students/${NEW_TOKEN}x`), NEW_STUDENT))
  })

  test('반 교사는 자기 반 학생의 streak·lastPresent만 수정', async () => {
    const a = asUser(env(), TEACHER_A)
    await assertSucceeds(updateDoc(doc(a, `students/${TOKEN_A}`), { streak: 3, lastPresent: '2026-11-08' }))
    await assertSucceeds(updateDoc(doc(a, `students/${TOKEN_A}`), { streak: 0, lastPresent: null }))
    await assertFails(updateDoc(doc(a, `students/${TOKEN_A}`), { name: '바뀐이름' }))
    await assertFails(updateDoc(doc(a, `students/${TOKEN_A}`), { streak: 1, active: false }))
    await assertFails(updateDoc(doc(a, `students/${TOKEN_A}`), { classId: 'classB' }))
  })

  test('streak·lastPresent 값 형식이 틀리면 반 교사도 거부', async () => {
    const a = asUser(env(), TEACHER_A)
    await assertSucceeds(updateDoc(doc(a, `students/${TOKEN_A}`), { streak: 1, lastPresent: '2026-11-08' }))
    await assertFails(updateDoc(doc(a, `students/${TOKEN_A}`), { streak: '3' }))
    await assertFails(updateDoc(doc(a, `students/${TOKEN_A}`), { streak: 1.5 }))
    await assertFails(updateDoc(doc(a, `students/${TOKEN_A}`), { streak: -1 }))
    await assertFails(updateDoc(doc(a, `students/${TOKEN_A}`), { lastPresent: '11/08' }))
  })

  test('반 교사는 다른 반 학생 streak 수정 불가', async () => {
    await assertSucceeds(updateDoc(doc(asUser(env(), TEACHER_B), `students/${TOKEN_B}`), { streak: 1 }))
    await assertFails(updateDoc(doc(asUser(env(), TEACHER_B), `students/${TOKEN_A}`), { streak: 1 }))
    await assertFails(updateDoc(doc(asUser(env(), OUTSIDER), `students/${TOKEN_A}`), { streak: 1 }))
    await assertFails(updateDoc(doc(asAnon(env()), `students/${TOKEN_A}`), { streak: 1 }))
  })

  test('admin은 학생의 어떤 필드든 수정(재발급 시 active:false 포함)', async () => {
    const admin = asUser(env(), ADMIN)
    await assertSucceeds(updateDoc(doc(admin, `students/${TOKEN_A}`), { name: '김하늘2', birthday: '04-01' }))
    await assertSucceeds(updateDoc(doc(admin, `students/${TOKEN_B}`), { active: false }))
  })
})

describe('classes', () => {
  test('classes get 누구나, list 교사만, write admin만', async () => {
    await assertSucceeds(getDoc(doc(asAnon(env()), 'classes/classA')))
    await assertSucceeds(getDoc(doc(asUser(env(), OUTSIDER), 'classes/classB')))

    const list = await assertSucceeds(getDocs(collection(asUser(env(), TEACHER_A), 'classes')))
    expect(list.size).toBe(2)
    await assertFails(getDocs(collection(asAnon(env()), 'classes')))
    await assertFails(getDocs(collection(asUser(env(), OUTSIDER), 'classes')))

    const newClass = { name: '2학년 1반', grade: 2, order: 3 }
    await assertFails(setDoc(doc(asUser(env(), TEACHER_A), 'classes/classC'), newClass))
    await assertFails(updateDoc(doc(asUser(env(), TEACHER_A), 'classes/classA'), { name: '바뀐반' }))
    await assertFails(deleteDoc(doc(asUser(env(), TEACHER_A), 'classes/classA')))
    await assertFails(setDoc(doc(asAnon(env()), 'classes/classC'), newClass))
    const admin = asUser(env(), ADMIN)
    await assertSucceeds(setDoc(doc(admin, 'classes/classC'), newClass))
    await assertSucceeds(updateDoc(doc(admin, 'classes/classA'), { name: '바뀐반' }))
    await assertSucceeds(deleteDoc(doc(admin, 'classes/classC')))
  })
})

describe('studentSessions', () => {
  test('학생 기기는 활성 토큰에 자기 세션을 묶고, 다른 링크로 다시 묶을 수 있다', async () => {
    const stu = asStudent(env(), 'stuNew')
    await assertSucceeds(setDoc(doc(stu, 'studentSessions/stuNew'), { token: TOKEN_A }))
    await assertSucceeds(setDoc(doc(stu, 'studentSessions/stuNew'), { token: TOKEN_B }))
    const snap = await assertSucceeds(getDoc(doc(stu, 'studentSessions/stuNew')))
    expect(snap.data()).toEqual({ token: TOKEN_B })
  })

  test('다른 UID의 세션은 만들거나 덮어쓸 수 없다', async () => {
    const stu = asStudent(env(), 'stuNew')
    await assertSucceeds(setDoc(doc(stu, 'studentSessions/stuNew'), { token: TOKEN_A }))
    await assertFails(setDoc(doc(stu, 'studentSessions/someoneElse'), { token: TOKEN_A }))
    await assertFails(setDoc(doc(stu, `studentSessions/${STUDENT_B_UID}`), { token: TOKEN_A }))
    await assertFails(setDoc(doc(asAnon(env()), 'studentSessions/stuNew'), { token: TOKEN_A }))
  })

  test('비활성·없는·형식이 틀린 토큰이나 여분 키로는 묶을 수 없다', async () => {
    await seedInactive()
    const stu = asStudent(env(), 'stuNew')
    const ref = doc(stu, 'studentSessions/stuNew')
    await assertFails(setDoc(ref, { token: TOKEN_INACTIVE }))
    await assertFails(setDoc(ref, { token: TOKEN_NONE }))
    await assertFails(setDoc(ref, { token: 'short' }))
    // 토큰 형식이 아닌 ID의 활성 학생 문서(콘솔에서 손으로 만든 경우)가 있어도 형식 검사로 거부
    await seed(env(), (db) => setDoc(doc(db, 'students/notAToken'), STUDENT_A))
    await assertFails(setDoc(ref, { token: 'notAToken' }))
    await assertFails(setDoc(ref, { token: TOKEN_A, classId: 'classA' }))
    await assertSucceeds(setDoc(ref, { token: TOKEN_A }))
    // 이미 묶은 세션을 비활성 토큰으로 바꾸는 update도 거부
    await assertFails(setDoc(ref, { token: TOKEN_INACTIVE }))
  })

  test('세션은 본인만 get, list·delete는 누구도 불가', async () => {
    const stuA = asStudent(env(), STUDENT_A_UID)
    await assertSucceeds(getDoc(doc(stuA, `studentSessions/${STUDENT_A_UID}`)))
    await assertFails(getDoc(doc(asStudent(env(), STUDENT_B_UID), `studentSessions/${STUDENT_A_UID}`)))
    await assertFails(getDoc(doc(asUser(env(), TEACHER_A), `studentSessions/${STUDENT_A_UID}`)))
    await assertFails(getDoc(doc(asUser(env(), ADMIN), `studentSessions/${STUDENT_A_UID}`)))
    await assertFails(getDoc(doc(asAnon(env()), `studentSessions/${STUDENT_A_UID}`)))
    await assertFails(getDocs(collection(stuA, 'studentSessions')))
    await assertFails(getDocs(collection(asUser(env(), ADMIN), 'studentSessions')))
    await assertFails(deleteDoc(doc(stuA, `studentSessions/${STUDENT_A_UID}`)))
    await assertFails(deleteDoc(doc(asUser(env(), ADMIN), `studentSessions/${STUDENT_A_UID}`)))
  })
})
