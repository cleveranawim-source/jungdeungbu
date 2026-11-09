import { disableNetwork, doc, enableNetwork, onSnapshot, Timestamp, writeBatch, type Firestore } from 'firebase/firestore'
import { expect, test } from 'vitest'
import { listAttendanceByDate, listStudentAttendance, setAttendance } from '../../src/data/attendance'
import { getStudent } from '../../src/data/students'
import { ADMIN, asStudent, asUser, seed, STUDENT_A_UID, TEACHER_A, TEACHER_B, TOKEN_A, TOKEN_B, useRulesEnv } from '../rules/setup'

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

test('이번 주를 눌렀다 취소하면 지난주까지의 streak 2가 그대로, lastPresent는 지난 주(취소 기록은 기준일이 아니다)', async () => {
  const db = asUser(env(), TEACHER_A)
  await setAttendance(db, TEACHER_A.uid, TOKEN_A, '2026-11-01', true)
  await setAttendance(db, TEACHER_A.uid, TOKEN_A, '2026-11-08', true)
  expect(await setAttendance(db, TEACHER_A.uid, TOKEN_A, '2026-11-15', true)).toEqual({ streak: 3, lastPresent: '2026-11-15' })
  const result = await setAttendance(db, TEACHER_A.uid, TOKEN_A, '2026-11-15', false)
  // 예전에는 11-15(present:false)가 기준일이 되어 0이었다. 이제 기준일은 마지막 출석 11-08 → 11-08·11-01 로 2
  expect(result).toEqual({ streak: 2, lastPresent: '2026-11-08' })
  expect(await getStudent(db, TOKEN_A)).toMatchObject({ streak: 2, lastPresent: '2026-11-08' })
})

test('출석 기록이 하나도 없으면(결석만) 기준일은 그 날짜, streak 0', async () => {
  const db = asUser(env(), TEACHER_A)
  expect(await setAttendance(db, TEACHER_A.uid, TOKEN_A, '2026-11-15', false)).toEqual({ streak: 0, lastPresent: null })
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

/** 로컬 캐시에 그 문서(대기 중인 쓰기 포함)가 보일 때까지 기다린다. */
function waitForLocalDoc(db: Firestore, path: string): Promise<void> {
  return new Promise((resolve) => {
    const unsub = onSnapshot(doc(db, path), { includeMetadataChanges: true }, (snap) => {
      if (snap.exists()) {
        unsub()
        resolve()
      }
    })
  })
}

test('오프라인(캐시 읽기)에서는 출석만 쓰고 streak은 건드리지 않고 null', async () => {
  const AT = Timestamp.fromDate(new Date('2026-11-08T02:00:00Z'))
  await seed(env(), async (db) => {
    const batch = writeBatch(db)
    batch.update(doc(db, `students/${TOKEN_A}`), { streak: 7, lastPresent: '2026-11-08' })
    for (const date of ['2026-09-27', '2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25', '2026-11-01', '2026-11-08']) {
      batch.set(doc(db, `students/${TOKEN_A}/attendance/${date}`), { date, present: true, by: 'tA', at: AT })
    }
    await batch.commit()
  })

  // 이 기기는 그 학생의 출석 기록을 한 번도 받지 않았다(캐시 비어 있음) → 오프라인 읽기는 빈 결과
  const db = asUser(env(), TEACHER_A)
  await disableNetwork(db)
  const pending = setAttendance(db, TEACHER_A.uid, TOKEN_A, '2026-11-15', true)
  await waitForLocalDoc(db, `students/${TOKEN_A}/attendance/2026-11-15`)
  await enableNetwork(db)
  expect(await pending).toBeNull()

  const admin = asUser(env(), ADMIN)
  expect(await getStudent(admin, TOKEN_A)).toMatchObject({ streak: 7, lastPresent: '2026-11-08' })
  const records = await listStudentAttendance(admin, TOKEN_A)
  expect(records).toHaveLength(8)
  expect(records.at(-1)).toMatchObject({ date: '2026-11-15', present: true, by: TEACHER_A.uid })

  // 다시 온라인에서 토글하면 전체 기록으로 계산된다
  expect(await setAttendance(db, TEACHER_A.uid, TOKEN_A, '2026-11-15', true)).toEqual({
    streak: 8,
    lastPresent: '2026-11-15',
  })
})
