import { expect, test } from 'vitest'
import { listAttendanceByDate, listStudentAttendance, setAttendance } from '../../src/data/attendance'
import { getStudent } from '../../src/data/students'
import { ADMIN, asStudent, asUser, STUDENT_A_UID, TEACHER_A, TEACHER_B, TOKEN_A, TOKEN_B, useRulesEnv } from '../rules/setup'

const env = useRulesEnv()

test('3주 연속 출석 뒤 streak 3', async () => {
  const db = asUser(env(), TEACHER_A)
  await setAttendance(db, TEACHER_A.uid, TOKEN_A, '2026-11-01', true)
  await setAttendance(db, TEACHER_A.uid, TOKEN_A, '2026-11-08', true)
  const result = await setAttendance(db, TEACHER_A.uid, TOKEN_A, '2026-11-15', true)
  expect(result).toEqual({ streak: 3, lastPresent: '2026-11-15' })

  const student = await getStudent(db, TOKEN_A)
  expect(student?.streak).toBe(3)
  expect(student?.lastPresent).toBe('2026-11-15')

  const records = await listStudentAttendance(db, TOKEN_A)
  expect(records.map((r) => r.date)).toEqual(['2026-11-01', '2026-11-08', '2026-11-15'])
  expect(records.every((r) => r.present && r.by === TEACHER_A.uid)).toBe(true)
})

test('이번 주 취소하면 streak 0, lastPresent는 지난 주', async () => {
  const db = asUser(env(), TEACHER_A)
  await setAttendance(db, TEACHER_A.uid, TOKEN_A, '2026-11-08', true)
  await setAttendance(db, TEACHER_A.uid, TOKEN_A, '2026-11-15', true)
  const result = await setAttendance(db, TEACHER_A.uid, TOKEN_A, '2026-11-15', false)
  expect(result).toEqual({ streak: 0, lastPresent: '2026-11-08' })
  expect(await getStudent(db, TOKEN_A)).toMatchObject({ streak: 0, lastPresent: '2026-11-08' })
})

test('두 교사가 순서 바꿔 토글해도 같은 streak', async () => {
  const admin = asUser(env(), ADMIN)
  // 학생 A: 관리자가 11-08 → 반 교사가 11-15
  await setAttendance(admin, ADMIN.uid, TOKEN_A, '2026-11-08', true)
  await setAttendance(asUser(env(), TEACHER_A), TEACHER_A.uid, TOKEN_A, '2026-11-15', true)
  // 학생 B: 반 교사가 11-15 → 관리자가 11-08 (반대 순서)
  await setAttendance(asUser(env(), TEACHER_B), TEACHER_B.uid, TOKEN_B, '2026-11-15', true)
  await setAttendance(admin, ADMIN.uid, TOKEN_B, '2026-11-08', true)

  const a = await getStudent(admin, TOKEN_A)
  const b = await getStudent(admin, TOKEN_B)
  expect(a).toMatchObject({ streak: 2, lastPresent: '2026-11-15' })
  expect(b).toMatchObject({ streak: a!.streak, lastPresent: a!.lastPresent })
})

test('지난 날짜를 고쳐도 streak은 가장 최근 기록된 주일 기준', async () => {
  const db = asUser(env(), TEACHER_A)
  await setAttendance(db, TEACHER_A.uid, TOKEN_A, '2026-11-08', true)
  await setAttendance(db, TEACHER_A.uid, TOKEN_A, '2026-11-15', true)
  expect(await setAttendance(db, TEACHER_A.uid, TOKEN_A, '2026-11-01', true)).toEqual({
    streak: 3,
    lastPresent: '2026-11-15',
  })
  expect(await setAttendance(db, TEACHER_A.uid, TOKEN_A, '2026-10-18', false)).toEqual({
    streak: 3,
    lastPresent: '2026-11-15',
  })
})

test('listAttendanceByDate는 토큰→present 맵', async () => {
  await setAttendance(asUser(env(), TEACHER_A), TEACHER_A.uid, TOKEN_A, '2026-11-15', true)
  await setAttendance(asUser(env(), TEACHER_A), TEACHER_A.uid, TOKEN_A, '2026-11-08', true)
  await setAttendance(asUser(env(), TEACHER_B), TEACHER_B.uid, TOKEN_B, '2026-11-15', false)

  const map = await listAttendanceByDate(asUser(env(), TEACHER_A), '2026-11-15')
  expect(map).toEqual(
    new Map([
      [TOKEN_A, true],
      [TOKEN_B, false],
    ]),
  )
  expect((await listAttendanceByDate(asUser(env(), TEACHER_A), '2026-11-22')).size).toBe(0)
})

test('학생 기기는 listAttendanceByDate 불가', async () => {
  await expect(listAttendanceByDate(asStudent(env(), STUDENT_A_UID), '2026-11-15')).rejects.toMatchObject({
    code: 'permission-denied',
  })
})

test('다른 반 교사의 setAttendance는 permission-denied로 거부', async () => {
  const db = asUser(env(), TEACHER_B)
  await expect(setAttendance(db, TEACHER_B.uid, TOKEN_A, '2026-11-15', true)).rejects.toMatchObject({
    code: 'permission-denied',
  })
  expect(await listStudentAttendance(db, TOKEN_A)).toEqual([])
  expect((await getStudent(db, TOKEN_A))?.streak).toBe(0)
})
