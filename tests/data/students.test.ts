import { doc, getDoc, setDoc, Timestamp, writeBatch } from 'firebase/firestore'
import { expect, test } from 'vitest'
import { listStudentAttendance } from '../../src/data/attendance'
import {
  bulkCreateStudents,
  createStudent,
  deactivateStudent,
  getStudent,
  listStudents,
  reissueToken,
  updateStudent,
} from '../../src/data/students'
import { addDays, toDateId } from '../../src/lib/dates'
import { isToken } from '../../src/lib/token'
import { ADMIN, asAnon, asUser, seed, STUDENT_A, TEACHER_A, TOKEN_A, TOKEN_B, useRulesEnv } from '../rules/setup'

const env = useRulesEnv()

const TOKEN_INACTIVE = 'Tok3n_I-inactiveStud01'
const AT = Timestamp.fromDate(new Date('2026-11-01T02:00:00Z'))

test('createStudent는 22자 토큰을 돌려주고 getStudent로 읽힌다', async () => {
  const token = await createStudent(asUser(env(), ADMIN), { name: '박새벽', classId: 'classA', birthday: '07-01' })
  expect(token).toHaveLength(22)
  expect(isToken(token)).toBe(true)
  expect(await getStudent(asAnon(env()), token)).toEqual({
    name: '박새벽',
    classId: 'classA',
    birthday: '07-01',
    active: true,
    streak: 0,
    lastPresent: null,
  })
})

test('반 교사는 createStudent 불가', async () => {
  await expect(
    createStudent(asUser(env(), TEACHER_A), { name: '박새벽', classId: 'classA', birthday: null }),
  ).rejects.toMatchObject({ code: 'permission-denied' })
})

test('getStudent: 없는 토큰·비활성 토큰은 누구에게나 null', async () => {
  await seed(env(), (db) => setDoc(doc(db, `students/${TOKEN_INACTIVE}`), { ...STUDENT_A, active: false }))
  expect(await getStudent(asAnon(env()), 'Tok3n_X-doesNotExist01')).toBeNull()
  expect(await getStudent(asAnon(env()), TOKEN_INACTIVE)).toBeNull()
  expect(await getStudent(asUser(env(), TEACHER_A), 'Tok3n_X-doesNotExist01')).toBeNull()
  // 교사는 비활성 문서도 읽는다
  expect(await getStudent(asUser(env(), TEACHER_A), TOKEN_INACTIVE)).toMatchObject({ active: false })
})

test('reissueToken은 출석 기록을 옮기고 옛 토큰을 비활성화한다', async () => {
  await seed(env(), async (db) => {
    const batch = writeBatch(db)
    batch.update(doc(db, `students/${TOKEN_A}`), { streak: 2, lastPresent: '2026-11-08' })
    batch.set(doc(db, `students/${TOKEN_A}/attendance/2026-11-01`), { date: '2026-11-01', present: true, by: 'tA', at: AT })
    batch.set(doc(db, `students/${TOKEN_A}/attendance/2026-11-08`), { date: '2026-11-08', present: true, by: 'admin1', at: AT })
    await batch.commit()
  })

  const newToken = await reissueToken(asUser(env(), ADMIN), TOKEN_A)
  expect(isToken(newToken)).toBe(true)
  expect(newToken).not.toBe(TOKEN_A)

  const anon = asAnon(env())
  expect(await getStudent(anon, newToken)).toEqual({ ...STUDENT_A, streak: 2, lastPresent: '2026-11-08' })
  const copied = await listStudentAttendance(anon, newToken)
  expect(copied).toHaveLength(2)
  expect(copied[0]).toMatchObject({ date: '2026-11-01', present: true, by: 'tA' })
  expect(copied[1]).toMatchObject({ date: '2026-11-08', present: true, by: 'admin1' })
  expect(copied.every((r) => r.at.isEqual(AT))).toBe(true)

  // 옛 링크는 즉시 죽는다
  expect(await getStudent(anon, TOKEN_A)).toBeNull()
  await expect(listStudentAttendance(anon, TOKEN_A)).rejects.toMatchObject({ code: 'permission-denied' })

  const ids = (await listStudents(asUser(env(), TEACHER_A), 'classA')).map((s) => s.id)
  expect(ids).toEqual([newToken])
})

test('reissueToken: 출석 기록이 500건을 넘어도 여러 배치로 옮긴다', async () => {
  const COUNT = 520
  await seed(env(), async (db) => {
    let batch = writeBatch(db)
    const start = new Date(2016, 0, 3)
    for (let i = 0; i < COUNT; i++) {
      const date = toDateId(addDays(start, 7 * i))
      batch.set(doc(db, `students/${TOKEN_A}/attendance/${date}`), { date, present: true, by: 'tA', at: AT })
      if ((i + 1) % 400 === 0) {
        await batch.commit()
        batch = writeBatch(db)
      }
    }
    await batch.commit()
  })

  const newToken = await reissueToken(asUser(env(), ADMIN), TOKEN_A)
  const admin = asUser(env(), ADMIN)
  expect(await listStudentAttendance(admin, newToken)).toHaveLength(COUNT)
  expect((await getDoc(doc(admin, `students/${TOKEN_A}`))).data()?.active).toBe(false)
  expect((await getStudent(admin, newToken))?.active).toBe(true)
})

test('bulkCreateStudents 3명', async () => {
  const rows = [
    { name: '가', classId: 'classA', birthday: '01-02' },
    { name: '나', classId: 'classA', birthday: null },
    { name: '다', classId: 'classB', birthday: '12-31' },
  ]
  const tokens = await bulkCreateStudents(asUser(env(), ADMIN), rows)
  expect(tokens).toHaveLength(3)
  expect(new Set(tokens).size).toBe(3)
  expect(tokens.every(isToken)).toBe(true)
  const anon = asAnon(env())
  for (const [i, t] of tokens.entries()) {
    expect(await getStudent(anon, t)).toEqual({ ...rows[i], active: true, streak: 0, lastPresent: null })
  }
  expect(await listStudents(asUser(env(), ADMIN))).toHaveLength(5)
})

test('listStudents는 활성 학생만, 반으로 거른다', async () => {
  const admin = asUser(env(), ADMIN)
  await deactivateStudent(admin, TOKEN_B)
  expect((await listStudents(admin)).map((s) => s.id)).toEqual([TOKEN_A])
  expect(await listStudents(admin, 'classB')).toEqual([])
  const [a] = await listStudents(asUser(env(), TEACHER_A), 'classA')
  expect(a).toEqual({ id: TOKEN_A, ...STUDENT_A })
})

test('비교사는 listStudents 불가', async () => {
  await expect(listStudents(asAnon(env()))).rejects.toMatchObject({ code: 'permission-denied' })
})

test('updateStudent로 반 이동', async () => {
  const admin = asUser(env(), ADMIN)
  await updateStudent(admin, TOKEN_A, { classId: 'classB', birthday: null })
  expect(await getStudent(admin, TOKEN_A)).toMatchObject({ classId: 'classB', birthday: null, name: STUDENT_A.name })
  await expect(updateStudent(asUser(env(), TEACHER_A), TOKEN_B, { name: '바꿈' })).rejects.toMatchObject({
    code: 'permission-denied',
  })
})
