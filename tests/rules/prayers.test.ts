import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import {
  addDoc,
  collection,
  collectionGroup,
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
  asStudent,
  asUser,
  OUTSIDER,
  seed,
  STUDENT_A,
  STUDENT_A_UID,
  STUDENT_B,
  STUDENT_B_UID,
  TEACHER_A,
  TEACHER_B,
  TOKEN_A,
  useRulesEnv,
} from './setup'

const env = useRulesEnv()

const TOKEN_INACTIVE = 'Tok3n_I-inactiveStud01' // classA, active:false (재발급으로 비활성된 옛 링크)
const INACTIVE_UID = 'stuI' // 비활성 학생에 묶인 세션(규칙을 끈 시드로만 만들 수 있다)
const NO_SESSION_UID = 'stuNone' // 익명 로그인했지만 세션을 묶지 않음

type Fields = Record<string, unknown>
const classPrayer = (over: Fields = {}): Fields => ({
  authorUid: STUDENT_A_UID,
  studentName: STUDENT_A.name,
  text: '시험 잘 보게 해주세요',
  createdAt: serverTimestamp(),
  ...over,
})
const teacherPrayer = (over: Fields = {}): Fields => classPrayer({ classId: 'classA', ...over })

beforeEach(async () => {
  await seed(env(), async (db) => {
    await setDoc(doc(db, `students/${TOKEN_INACTIVE}`), { ...STUDENT_A, name: '옛링크', active: false })
    await setDoc(doc(db, `studentSessions/${INACTIVE_UID}`), { token: TOKEN_INACTIVE })
    const createdAt = Timestamp.fromDate(new Date('2026-11-08T01:00:00Z'))
    await setDoc(doc(db, 'classes/classA/prayers/p1'), { ...classPrayer(), createdAt })
    await setDoc(doc(db, 'classes/classB/prayers/pB'), {
      ...classPrayer({ authorUid: STUDENT_B_UID, studentName: STUDENT_B.name }),
      createdAt,
    })
    await setDoc(doc(db, 'prayers/t1'), { ...teacherPrayer(), createdAt })
    await setDoc(doc(db, 'prayers/t2'), {
      ...teacherPrayer({ authorUid: STUDENT_B_UID, studentName: STUDENT_B.name, classId: 'classB' }),
      createdAt,
    })
  })
})

describe('우리 반 기도 생성', () => {
  test('학생 토큰으로 자기 반 기도 생성', async () => {
    const ref = await assertSucceeds(
      addDoc(collection(asStudent(env(), STUDENT_A_UID), 'classes/classA/prayers'), classPrayer()),
    )
    const snap = await getDoc(ref)
    expect(snap.data()?.text).toBe('시험 잘 보게 해주세요')
  })

  test('다른 반 경로에 생성하면 거부', async () => {
    const stuA = asStudent(env(), STUDENT_A_UID)
    await assertSucceeds(addDoc(collection(stuA, 'classes/classA/prayers'), classPrayer()))
    await assertFails(addDoc(collection(stuA, 'classes/classB/prayers'), classPrayer()))
  })

  test('이름이 학생 문서와 다르면 거부', async () => {
    const col = collection(asStudent(env(), STUDENT_A_UID), 'classes/classA/prayers')
    await assertSucceeds(addDoc(col, classPrayer()))
    await assertFails(addDoc(col, classPrayer({ studentName: '다른사람' })))
    await assertFails(addDoc(col, classPrayer({ studentName: STUDENT_B.name })))
  })

  test('authorUid가 내 UID가 아니면 거부(남의 이름으로 쓰기)', async () => {
    const stuB = asStudent(env(), STUDENT_B_UID)
    await assertSucceeds(
      addDoc(
        collection(stuB, 'classes/classB/prayers'),
        classPrayer({ authorUid: STUDENT_B_UID, studentName: STUDENT_B.name }),
      ),
    )
    // 이유 하나만 다르게: 반·이름은 stuB 의 것(위 성공과 같다)이고 authorUid 만 stuA
    await assertFails(
      addDoc(
        collection(stuB, 'classes/classB/prayers'),
        classPrayer({ authorUid: STUDENT_A_UID, studentName: STUDENT_B.name }),
      ),
    )
    // stuB가 stuA 행세: authorUid·이름·반 모두 stuA 것으로 맞춰도, 세션이 가리키는 학생은 B
    await assertFails(addDoc(collection(stuB, 'classes/classA/prayers'), classPrayer()))
  })

  test('500자 초과 거부', async () => {
    const col = collection(asStudent(env(), STUDENT_A_UID), 'classes/classA/prayers')
    await assertSucceeds(addDoc(col, classPrayer({ text: '가'.repeat(500) })))
    await assertFails(addDoc(col, classPrayer({ text: '가'.repeat(501) })))
    await assertFails(addDoc(col, classPrayer({ text: '' })))
    await assertFails(addDoc(col, classPrayer({ text: 42 })))
    await assertFails(addDoc(col, classPrayer({ text: ['가'] })))
  })

  test('기도 문서에 토큰 필드가 있으면 거부', async () => {
    const col = collection(asStudent(env(), STUDENT_A_UID), 'classes/classA/prayers')
    await assertSucceeds(addDoc(col, classPrayer()))
    await assertFails(addDoc(col, classPrayer({ studentToken: TOKEN_A })))
    await assertFails(addDoc(col, classPrayer({ token: TOKEN_A })))
  })

  test('클라이언트 시각, 여분 키(hidden·classId 포함)는 거부', async () => {
    const col = collection(asStudent(env(), STUDENT_A_UID), 'classes/classA/prayers')
    await assertSucceeds(addDoc(col, classPrayer()))
    await assertFails(addDoc(col, classPrayer({ createdAt: Timestamp.fromMillis(Date.now() - 60_000) })))
    await assertFails(addDoc(col, classPrayer({ hidden: false })))
    await assertFails(addDoc(col, classPrayer({ classId: 'classA' })))
    const { createdAt: _c, ...noCreatedAt } = classPrayer()
    await assertFails(addDoc(col, noCreatedAt))
  })

  test('세션이 없는 익명 UID는 글 쓰기 불가', async () => {
    await assertSucceeds(addDoc(collection(asStudent(env(), STUDENT_A_UID), 'classes/classA/prayers'), classPrayer()))
    await assertFails(
      addDoc(
        collection(asStudent(env(), NO_SESSION_UID), 'classes/classA/prayers'),
        classPrayer({ authorUid: NO_SESSION_UID }),
      ),
    )
    // 로그인하지 않은 요청도 불가
    await assertFails(addDoc(collection(asAnon(env()), 'classes/classA/prayers'), classPrayer()))
  })

  test('세션 토큰이 비활성 학생이면 글 쓰기 불가', async () => {
    await assertSucceeds(addDoc(collection(asStudent(env(), STUDENT_A_UID), 'classes/classA/prayers'), classPrayer()))
    await assertFails(
      addDoc(
        collection(asStudent(env(), INACTIVE_UID), 'classes/classA/prayers'),
        classPrayer({ authorUid: INACTIVE_UID, studentName: '옛링크' }),
      ),
    )
    // 세션을 묶은 뒤 재발급으로 비활성되면 그 기기도 더는 못 쓴다
    await assertSucceeds(updateDoc(doc(asUser(env(), ADMIN), `students/${TOKEN_A}`), { active: false }))
    await assertFails(addDoc(collection(asStudent(env(), STUDENT_A_UID), 'classes/classA/prayers'), classPrayer()))
  })
})

describe('우리 반 기도 읽기·수정·삭제', () => {
  test('반 ID를 아는 누구나 우리 반 기도 목록을 읽는다(토큰은 들어 있지 않다)', async () => {
    const anon = asAnon(env())
    const list = await assertSucceeds(
      getDocs(query(collection(anon, 'classes/classA/prayers'), orderBy('createdAt', 'desc'), limit(50))),
    )
    expect(list.size).toBe(1)
    expect(Object.keys(list.docs[0].data()).sort()).toEqual(['authorUid', 'createdAt', 'studentName', 'text'])
    await assertSucceeds(getDoc(doc(anon, 'classes/classA/prayers/p1')))
  })

  test('기도는 누구도 수정할 수 없다', async () => {
    await assertFails(updateDoc(doc(asStudent(env(), STUDENT_A_UID), 'classes/classA/prayers/p1'), { text: '바꿔치기' }))
    await assertFails(updateDoc(doc(asAnon(env()), 'classes/classA/prayers/p1'), { hidden: true }))
    await assertFails(updateDoc(doc(asUser(env(), TEACHER_A), 'classes/classA/prayers/p1'), { text: '교사 수정' }))
    await assertFails(updateDoc(doc(asUser(env(), ADMIN), 'classes/classA/prayers/p1'), { text: '관리자 수정' }))
  })

  test('본인 글 삭제 가능, 다른 학생 글 삭제 불가', async () => {
    await assertFails(deleteDoc(doc(asStudent(env(), STUDENT_B_UID), 'classes/classA/prayers/p1')))
    await assertFails(deleteDoc(doc(asStudent(env(), NO_SESSION_UID), 'classes/classA/prayers/p1')))
    await assertFails(deleteDoc(doc(asAnon(env()), 'classes/classA/prayers/p1')))
    await assertFails(deleteDoc(doc(asUser(env(), OUTSIDER), 'classes/classA/prayers/p1')))
    await assertSucceeds(deleteDoc(doc(asStudent(env(), STUDENT_A_UID), 'classes/classA/prayers/p1')))
  })

  test('우리 반 기도는 교사가 삭제할 수 있다', async () => {
    await assertSucceeds(deleteDoc(doc(asUser(env(), TEACHER_A), 'classes/classA/prayers/p1')))
    await assertSucceeds(deleteDoc(doc(asUser(env(), ADMIN), 'classes/classB/prayers/pB')))
  })

  test("collectionGroup('prayers')는 교사도 거부", async () => {
    // 같은 교사가 반 경로로는 읽을 수 있다(대조군)
    await assertSucceeds(getDocs(collection(asUser(env(), TEACHER_A), 'classes/classA/prayers')))
    await assertFails(getDocs(collectionGroup(asUser(env(), TEACHER_A), 'prayers')))
    await assertFails(getDocs(collectionGroup(asUser(env(), ADMIN), 'prayers')))
    await assertFails(getDocs(collectionGroup(asAnon(env()), 'prayers')))
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
    // 글쓴이 학생도 읽을 수 없다
    await assertFails(getDoc(doc(asStudent(env(), STUDENT_A_UID), 'prayers/t1')))
  })

  test('학생 세션으로 선생님께만 보내는 기도 생성', async () => {
    await assertSucceeds(addDoc(collection(asStudent(env(), STUDENT_A_UID), 'prayers'), teacherPrayer()))
    await assertSucceeds(
      addDoc(
        collection(asStudent(env(), STUDENT_B_UID), 'prayers'),
        teacherPrayer({ authorUid: STUDENT_B_UID, studentName: STUDENT_B.name, classId: 'classB' }),
      ),
    )
  })

  test('교사 전용 prayers 생성 시 classId가 학생 반과 다르면 거부', async () => {
    const col = collection(asStudent(env(), STUDENT_A_UID), 'prayers')
    await assertSucceeds(addDoc(col, teacherPrayer()))
    await assertFails(addDoc(col, teacherPrayer({ classId: 'classB' })))
    const { classId: _c, ...noClassId } = teacherPrayer()
    await assertFails(addDoc(col, noClassId))
  })

  test('교사 전용 prayers도 글쓴이·이름·길이·시각·키·세션 검사를 한다', async () => {
    const col = collection(asStudent(env(), STUDENT_A_UID), 'prayers')
    await assertSucceeds(addDoc(col, teacherPrayer()))
    await assertFails(addDoc(col, teacherPrayer({ authorUid: STUDENT_B_UID })))
    await assertFails(addDoc(col, teacherPrayer({ studentName: '다른사람' })))
    await assertFails(addDoc(col, teacherPrayer({ text: '가'.repeat(501) })))
    await assertFails(addDoc(col, teacherPrayer({ createdAt: Timestamp.fromMillis(Date.now() - 60_000) })))
    await assertFails(addDoc(col, teacherPrayer({ studentToken: TOKEN_A })))
    await assertFails(addDoc(collection(asAnon(env()), 'prayers'), teacherPrayer()))
    await assertFails(
      addDoc(
        collection(asStudent(env(), NO_SESSION_UID), 'prayers'),
        teacherPrayer({ authorUid: NO_SESSION_UID }),
      ),
    )
    await assertFails(
      addDoc(
        collection(asStudent(env(), INACTIVE_UID), 'prayers'),
        teacherPrayer({ authorUid: INACTIVE_UID, studentName: '옛링크' }),
      ),
    )
  })

  test('교사 전용 prayers는 수정 불가, 삭제는 교사만(글쓴이 학생도 불가)', async () => {
    await assertFails(updateDoc(doc(asStudent(env(), STUDENT_A_UID), 'prayers/t1'), { text: '수정' }))
    await assertFails(updateDoc(doc(asUser(env(), TEACHER_A), 'prayers/t1'), { text: '수정' }))
    await assertFails(updateDoc(doc(asUser(env(), ADMIN), 'prayers/t1'), { text: '수정' }))
    await assertFails(deleteDoc(doc(asStudent(env(), STUDENT_A_UID), 'prayers/t1')))
    await assertFails(deleteDoc(doc(asAnon(env()), 'prayers/t1')))
    await assertFails(deleteDoc(doc(asUser(env(), OUTSIDER), 'prayers/t1')))
    await assertSucceeds(deleteDoc(doc(asUser(env(), TEACHER_B), 'prayers/t2')))
  })
})
