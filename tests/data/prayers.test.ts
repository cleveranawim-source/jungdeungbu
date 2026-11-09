import { collection, doc, getDocs, setDoc, Timestamp, writeBatch } from 'firebase/firestore'
import { expect, test } from 'vitest'
import {
  addPrayer,
  bindStudentSession,
  deleteClassPrayer,
  deleteTeacherPrayer,
  listClassPrayers,
  listTeacherPrayers,
} from '../../src/data/prayers'
import {
  ADMIN,
  asAnon,
  asStudent,
  asUser,
  seed,
  STUDENT_A,
  STUDENT_A_UID,
  STUDENT_B,
  STUDENT_B_UID,
  TEACHER_A,
  TEACHER_B,
  TOKEN_A,
  useRulesEnv,
} from '../rules/setup'

const env = useRulesEnv()

const asA = () => asStudent(env(), STUDENT_A_UID)
const prayerA = (text: string, visibility: 'class' | 'teachers') => ({
  studentName: STUDENT_A.name,
  classId: 'classA',
  text,
  visibility,
})

test('bindStudentSession 뒤에야 기도 제목을 올릴 수 있다', async () => {
  const db = asStudent(env(), 'stuNew')
  await expect(addPrayer(db, 'stuNew', prayerA('먼저', 'class'))).rejects.toMatchObject({
    code: 'permission-denied',
  })
  await bindStudentSession(db, 'stuNew', TOKEN_A)
  await addPrayer(db, 'stuNew', prayerA('묶은 뒤', 'class'))
  expect((await listClassPrayers(asAnon(env()), 'classA')).map((p) => p.text)).toEqual(['묶은 뒤'])
})

test('addPrayer(class): 우리 반 목록에 보이고 토큰은 없다', async () => {
  await addPrayer(asA(), STUDENT_A_UID, prayerA('시험 잘 보게', 'class'))
  const list = await listClassPrayers(asAnon(env()), 'classA')
  expect(list).toHaveLength(1)
  expect(list[0]).toMatchObject({ authorUid: STUDENT_A_UID, studentName: STUDENT_A.name, text: '시험 잘 보게' })
  expect(Object.keys(list[0]).sort()).toEqual(['authorUid', 'createdAt', 'id', 'studentName', 'text'])
  expect(list[0].createdAt).toBeInstanceOf(Timestamp)
  expect(await listTeacherPrayers(asUser(env(), TEACHER_A), ['classA'])).toEqual([])
})

test('addPrayer(teachers): 선생님 목록에만 보인다', async () => {
  await addPrayer(asA(), STUDENT_A_UID, prayerA('비밀 기도', 'teachers'))
  expect(await listClassPrayers(asAnon(env()), 'classA')).toEqual([])
  const list = await listTeacherPrayers(asUser(env(), TEACHER_A), ['classA'])
  expect(list).toHaveLength(1)
  expect(list[0]).toMatchObject({
    authorUid: STUDENT_A_UID,
    studentName: STUDENT_A.name,
    classId: 'classA',
    text: '비밀 기도',
  })
  // 학생은 prayers를 읽을 수 없다
  await expect(listTeacherPrayers(asA(), ['classA'])).rejects.toMatchObject({ code: 'permission-denied' })
})

test('addPrayer: 다른 반으로는 올릴 수 없다', async () => {
  await expect(
    addPrayer(asA(), STUDENT_A_UID, { ...prayerA('x', 'class'), classId: 'classB' }),
  ).rejects.toMatchObject({ code: 'permission-denied' })
  await expect(
    addPrayer(asA(), STUDENT_A_UID, { ...prayerA('x', 'teachers'), classId: 'classB' }),
  ).rejects.toMatchObject({ code: 'permission-denied' })
})

test('listTeacherPrayers([])는 질의 없이 []', async () => {
  expect(await listTeacherPrayers(asUser(env(), TEACHER_A), [])).toEqual([])
  expect(await listTeacherPrayers(asAnon(env()), [])).toEqual([])
})

test('listTeacherPrayers: 반 30개 넘으면 나눠 묻고 최신순으로 합친다', async () => {
  await seed(env(), async (db) => {
    await setDoc(doc(db, 'prayers/old'), {
      authorUid: STUDENT_A_UID,
      studentName: STUDENT_A.name,
      classId: 'classA',
      text: '먼저',
      createdAt: Timestamp.fromDate(new Date('2026-11-01T00:00:00Z')),
    })
    await setDoc(doc(db, 'prayers/new'), {
      authorUid: STUDENT_B_UID,
      studentName: STUDENT_B.name,
      classId: 'classB',
      text: '나중',
      createdAt: Timestamp.fromDate(new Date('2026-11-08T00:00:00Z')),
    })
  })
  const filler = Array.from({ length: 30 }, (_, i) => `filler${i}`)
  const list = await listTeacherPrayers(asUser(env(), ADMIN), ['classA', ...filler, 'classB'])
  expect(list.map((p) => p.id)).toEqual(['new', 'old'])
})

test('listClassPrayers: 최신순 최대 50개', async () => {
  await seed(env(), async (db) => {
    const batch = writeBatch(db)
    for (let i = 0; i < 55; i++) {
      batch.set(doc(collection(db, 'classes/classA/prayers')), {
        authorUid: STUDENT_A_UID,
        studentName: STUDENT_A.name,
        text: `기도 ${i}`,
        createdAt: Timestamp.fromMillis(Date.UTC(2026, 10, 1) + i * 60_000),
      })
    }
    await batch.commit()
  })
  const list = await listClassPrayers(asAnon(env()), 'classA')
  expect(list).toHaveLength(50)
  expect(list[0].text).toBe('기도 54')
  expect(list[49].text).toBe('기도 5')
})

test('deleteClassPrayer: 본인 글은 지우고 남의 글은 거부, 교사는 아무 글이나', async () => {
  await addPrayer(asA(), STUDENT_A_UID, prayerA('지울 글', 'class'))
  await addPrayer(asA(), STUDENT_A_UID, prayerA('교사가 지울 글', 'class'))
  const [p2, p1] = await listClassPrayers(asAnon(env()), 'classA')
  expect(p1.text).toBe('지울 글')

  await expect(deleteClassPrayer(asStudent(env(), STUDENT_B_UID), 'classA', p1.id)).rejects.toMatchObject({
    code: 'permission-denied',
  })
  await deleteClassPrayer(asA(), 'classA', p1.id)
  await deleteClassPrayer(asUser(env(), TEACHER_B), 'classA', p2.id)
  expect(await listClassPrayers(asAnon(env()), 'classA')).toEqual([])
})

test('deleteTeacherPrayer: 교사만', async () => {
  await addPrayer(asA(), STUDENT_A_UID, prayerA('선생님께', 'teachers'))
  const [p] = await listTeacherPrayers(asUser(env(), TEACHER_A), ['classA'])
  await expect(deleteTeacherPrayer(asA(), p.id)).rejects.toMatchObject({ code: 'permission-denied' })
  await deleteTeacherPrayer(asUser(env(), TEACHER_A), p.id)
  await seed(env(), async (db) => {
    expect((await getDocs(collection(db, 'prayers'))).size).toBe(0)
  })
})
