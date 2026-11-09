import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { beforeEach, describe, expect, test } from 'vitest'
import {
  ADMIN,
  asAnon,
  asUser,
  OUTSIDER,
  seed,
  STUDENT_A,
  STUDENT_B,
  TEACHER_A,
  TEACHER_B,
  TOKEN_A,
  TOKEN_B,
  useRulesEnv,
} from './setup'

const env = useRulesEnv()

const TOKEN_INACTIVE = 'Tok3n_I-inactiveStud01' // classA, active:false (재발급으로 비활성된 옛 링크)
const TOKEN_NONE = 'Tok3n_Z-noStudentDoc00' // 형식은 맞지만 학생 문서 없음

const classPrayer = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  studentToken: TOKEN_A,
  studentName: STUDENT_A.name,
  text: '시험 잘 보게 해주세요',
  hidden: false,
  createdAt: serverTimestamp(),
  ...over,
})
const teacherPrayer = (over: Record<string, unknown> = {}) => classPrayer({ classId: 'classA', ...over })

beforeEach(async () => {
  await seed(env(), async (db) => {
    await setDoc(doc(db, `students/${TOKEN_INACTIVE}`), { ...STUDENT_A, name: '옛링크', active: false })
    const createdAt = Timestamp.fromDate(new Date('2026-11-08T01:00:00Z'))
    await setDoc(doc(db, 'classes/classA/prayers/p1'), { ...classPrayer(), createdAt })
    await setDoc(doc(db, 'prayers/t1'), { ...teacherPrayer(), createdAt })
    await setDoc(doc(db, 'prayers/t2'), {
      ...teacherPrayer({ studentToken: TOKEN_B, studentName: STUDENT_B.name, classId: 'classB' }),
      createdAt,
    })
  })
})

describe('우리 반 기도 생성', () => {
  test('학생 토큰으로 자기 반 기도 생성', async () => {
    const ref = await assertSucceeds(addDoc(collection(asAnon(env()), 'classes/classA/prayers'), classPrayer()))
    const snap = await getDoc(ref)
    expect(snap.data()?.text).toBe('시험 잘 보게 해주세요')
  })

  test('다른 반 경로에 생성하면 거부', async () => {
    const anon = asAnon(env())
    await assertSucceeds(addDoc(collection(anon, 'classes/classA/prayers'), classPrayer()))
    await assertFails(addDoc(collection(anon, 'classes/classB/prayers'), classPrayer()))
  })

  test('이름이 학생 문서와 다르면 거부', async () => {
    const anon = asAnon(env())
    await assertSucceeds(addDoc(collection(anon, 'classes/classA/prayers'), classPrayer()))
    await assertFails(addDoc(collection(anon, 'classes/classA/prayers'), classPrayer({ studentName: '다른사람' })))
    // 다른 반 학생 이름을 빌려도 거부
    await assertFails(
      addDoc(collection(anon, 'classes/classA/prayers'), classPrayer({ studentName: STUDENT_B.name })),
    )
  })

  test('500자 초과 거부', async () => {
    const anon = asAnon(env())
    await assertSucceeds(addDoc(collection(anon, 'classes/classA/prayers'), classPrayer({ text: '가'.repeat(500) })))
    await assertFails(addDoc(collection(anon, 'classes/classA/prayers'), classPrayer({ text: '가'.repeat(501) })))
    await assertFails(addDoc(collection(anon, 'classes/classA/prayers'), classPrayer({ text: '' })))
    await assertFails(addDoc(collection(anon, 'classes/classA/prayers'), classPrayer({ text: 42 })))
    await assertFails(addDoc(collection(anon, 'classes/classA/prayers'), classPrayer({ text: ['가'] })))
  })

  test('hidden:true로 생성, 클라이언트 시각, 여분·누락 키는 거부', async () => {
    const anon = asAnon(env())
    const col = collection(anon, 'classes/classA/prayers')
    await assertSucceeds(addDoc(col, classPrayer()))
    await assertFails(addDoc(col, classPrayer({ hidden: true })))
    await assertFails(addDoc(col, classPrayer({ createdAt: Timestamp.now() })))
    await assertFails(addDoc(col, classPrayer({ classId: 'classA' })))
    await assertFails(addDoc(col, classPrayer({ likes: 0 })))
    const { hidden: _h, ...noHidden } = classPrayer()
    await assertFails(addDoc(col, noHidden))
  })

  test('토큰 형식이 틀리거나 학생 문서가 없거나 비활성 링크면 거부', async () => {
    // 토큰 형식이 아닌 ID의 학생 문서가 있어도 형식 검사로 거부해야 한다
    await seed(env(), (db) => setDoc(doc(db, 'students/notAToken'), { ...STUDENT_A, name: '형식밖' }))
    const col = collection(asAnon(env()), 'classes/classA/prayers')
    await assertSucceeds(addDoc(col, classPrayer()))
    await assertFails(addDoc(col, classPrayer({ studentToken: 'notAToken', studentName: '형식밖' })))
    await assertFails(addDoc(col, classPrayer({ studentToken: 'short' })))
    await assertFails(addDoc(col, classPrayer({ studentToken: `${TOKEN_A}/x` })))
    await assertFails(addDoc(col, classPrayer({ studentToken: TOKEN_NONE })))
    await assertFails(addDoc(col, classPrayer({ studentToken: TOKEN_INACTIVE, studentName: '옛링크' })))
  })
})

describe('우리 반 기도 읽기·숨기기·삭제', () => {
  test('반 ID를 아는 누구나 우리 반 기도 목록을 읽는다', async () => {
    const anon = asAnon(env())
    const list = await assertSucceeds(
      getDocs(
        query(
          collection(anon, 'classes/classA/prayers'),
          where('hidden', '==', false),
          orderBy('createdAt', 'desc'),
          limit(50),
        ),
      ),
    )
    expect(list.size).toBe(1)
    await assertSucceeds(getDoc(doc(anon, 'classes/classA/prayers/p1')))
  })

  test('hidden 만 바꾸는 업데이트는 누구나, text 수정은 거부', async () => {
    const anon = asAnon(env())
    const ref = doc(anon, 'classes/classA/prayers/p1')
    await assertFails(updateDoc(ref, { text: '바꿔치기' }))
    await assertFails(updateDoc(ref, { hidden: true, text: '바꿔치기' }))
    await assertFails(updateDoc(ref, { studentName: STUDENT_B.name }))
    await assertSucceeds(updateDoc(ref, { hidden: true }))
    // 숨긴 글을 익명이 다시 꺼낼 수는 없다
    await assertFails(updateDoc(ref, { hidden: false }))
  })

  test('우리 반 기도 삭제는 교사만', async () => {
    await assertFails(deleteDoc(doc(asAnon(env()), 'classes/classA/prayers/p1')))
    await assertFails(deleteDoc(doc(asUser(env(), OUTSIDER), 'classes/classA/prayers/p1')))
    await assertSucceeds(deleteDoc(doc(asUser(env(), TEACHER_A), 'classes/classA/prayers/p1')))
  })
})

describe('선생님만 보는 기도(prayers)', () => {
  test('교사 전용 prayers는 익명 읽기 거부, 교사 읽기 성공', async () => {
    const a = asUser(env(), TEACHER_A)
    const mine = await assertSucceeds(
      getDocs(query(collection(a, 'prayers'), where('classId', 'in', ['classA']), orderBy('createdAt', 'desc'))),
    )
    expect(mine.size).toBe(1)
    await assertSucceeds(getDoc(doc(a, 'prayers/t1')))
    expect((await assertSucceeds(getDocs(collection(asUser(env(), ADMIN), 'prayers')))).size).toBe(2)

    await assertFails(getDoc(doc(asAnon(env()), 'prayers/t1')))
    await assertFails(getDocs(collection(asAnon(env()), 'prayers')))
    await assertFails(getDocs(query(collection(asAnon(env()), 'prayers'), where('classId', '==', 'classA'))))
    await assertFails(getDocs(collection(asUser(env(), OUTSIDER), 'prayers')))
  })

  test('학생 토큰으로 선생님께만 보내는 기도 생성', async () => {
    await assertSucceeds(addDoc(collection(asAnon(env()), 'prayers'), teacherPrayer()))
    await assertSucceeds(
      addDoc(
        collection(asAnon(env()), 'prayers'),
        teacherPrayer({ studentToken: TOKEN_B, studentName: STUDENT_B.name, classId: 'classB' }),
      ),
    )
  })

  test('교사 전용 prayers 생성 시 classId가 학생 반과 다르면 거부', async () => {
    const col = collection(asAnon(env()), 'prayers')
    await assertSucceeds(addDoc(col, teacherPrayer()))
    await assertFails(addDoc(col, teacherPrayer({ classId: 'classB' })))
    const { classId: _c, ...noClassId } = teacherPrayer()
    await assertFails(addDoc(col, noClassId))
  })

  test('교사 전용 prayers도 이름·길이·hidden·시각·키 검사를 한다', async () => {
    const col = collection(asAnon(env()), 'prayers')
    await assertSucceeds(addDoc(col, teacherPrayer()))
    await assertFails(addDoc(col, teacherPrayer({ studentName: '다른사람' })))
    await assertFails(addDoc(col, teacherPrayer({ text: '가'.repeat(501) })))
    await assertFails(addDoc(col, teacherPrayer({ hidden: true })))
    await assertFails(addDoc(col, teacherPrayer({ createdAt: Timestamp.now() })))
    await assertFails(addDoc(col, teacherPrayer({ extra: 1 })))
    await assertFails(addDoc(col, teacherPrayer({ studentToken: TOKEN_INACTIVE, studentName: '옛링크' })))
  })

  test('교사 전용 prayers는 수정 불가, 삭제는 교사만', async () => {
    await assertFails(updateDoc(doc(asAnon(env()), 'prayers/t1'), { hidden: true }))
    await assertFails(updateDoc(doc(asUser(env(), TEACHER_A), 'prayers/t1'), { hidden: true }))
    await assertFails(updateDoc(doc(asUser(env(), ADMIN), 'prayers/t1'), { text: '수정' }))
    await assertFails(deleteDoc(doc(asAnon(env()), 'prayers/t1')))
    await assertFails(deleteDoc(doc(asUser(env(), OUTSIDER), 'prayers/t1')))
    await assertSucceeds(deleteDoc(doc(asUser(env(), TEACHER_B), 'prayers/t2')))
  })
})
