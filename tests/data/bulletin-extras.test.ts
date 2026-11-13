import { doc, setDoc, Timestamp } from 'firebase/firestore'
import { expect, test } from 'vitest'
import { loadBulletinExtras } from '../../src/data/bulletinExtras'
import { ADMIN, asUser, seed, STUDENT_A, STUDENT_B, TOKEN_A, TOKEN_B, useRulesEnv, type TestDb } from '../rules/setup'

const env = useRulesEnv()

const DATE = '2026-11-15'
const NEW = 'Tok3n_N-newFriend00001'
const OLDNEW = 'Tok3n_O-oldNewFriend001'
const DEAD = 'Tok3n_D-deadToken000001'
const AT = Timestamp.fromDate(new Date('2026-11-01T02:00:00Z'))

const mark = (db: TestDb, token: string, date: string, present: boolean) =>
  setDoc(doc(db, `students/${token}/attendance/${date}`), { date, present, by: 'tA', at: AT })

async function prepare(opts: { sunday08?: boolean; sunday01?: boolean; sunday15?: boolean } = {}) {
  const { sunday08 = true, sunday01 = true, sunday15 = false } = opts
  await seed(env(), async (db) => {
    await setDoc(doc(db, `students/${NEW}`), { ...STUDENT_A, name: '새봄', birthday: '11-20', newcomer: true })
    await setDoc(doc(db, `students/${OLDNEW}`), { ...STUDENT_B, name: '다온', birthday: null, newcomer: true })
    await setDoc(doc(db, `students/${DEAD}`), { ...STUDENT_A, name: '지난링크', active: false })
    if (sunday01) {
      await mark(db, TOKEN_A, '2026-11-01', true)
      await mark(db, OLDNEW, '2026-11-01', true)
    }
    if (sunday08) {
      await mark(db, TOKEN_A, '2026-11-08', true)
      await mark(db, TOKEN_B, '2026-11-08', false)
      await mark(db, NEW, '2026-11-08', true)
      await mark(db, OLDNEW, '2026-11-08', true)
      await mark(db, DEAD, '2026-11-08', true)
    }
    if (sunday15) await mark(db, TOKEN_A, DATE, true)
  })
}

test('가장 최근 출석 주일로 반별 인원·새 친구·이번 달 생일을 채운다', async () => {
  await prepare()
  const r = await loadBulletinExtras(asUser(env(), ADMIN), DATE)
  expect(r.attendance).toEqual({
    sunday: '2026-11-08',
    classes: [
      { classId: 'classA', name: '1학년 1반', present: 2, total: 2 },
      { classId: 'classB', name: '1학년 2반', present: 1, total: 2 },
    ],
    students: { present: 3, total: 4 },
    teachers: null,
  })
  expect(r.members.newFriends).toEqual(['새봄'])
  expect(r.members.birthdays).toEqual([{ name: '새봄', date: '11-20' }])
})

test('바로 앞 주일에 기록이 없으면 그 앞 주일을 쓴다', async () => {
  await prepare({ sunday08: false })
  const r = await loadBulletinExtras(asUser(env(), ADMIN), DATE)
  expect(r.attendance?.sunday).toBe('2026-11-01')
})

test('8주 안에 출석 기록이 없으면 출석은 null, 새 친구는 빈 목록, 생일은 그대로', async () => {
  await prepare({ sunday08: false, sunday01: false })
  const r = await loadBulletinExtras(asUser(env(), ADMIN), DATE)
  expect(r.attendance).toBeNull()
  expect(r.members.newFriends).toEqual([])
  expect(r.members.birthdays).toEqual([{ name: '새봄', date: '11-20' }])
})

test('주보 날짜 당일·이후의 출석은 세지 않는다', async () => {
  await prepare({ sunday08: false, sunday01: false, sunday15: true })
  const r = await loadBulletinExtras(asUser(env(), ADMIN), DATE)
  expect(r.attendance).toBeNull()
})

test('죽은 토큰의 출석만 있는 주일은 기록 없음으로 본다', async () => {
  await seed(env(), async (db) => {
    await setDoc(doc(db, `students/${DEAD}`), { ...STUDENT_A, name: '지난링크', active: false })
    await mark(db, DEAD, '2026-11-08', true)
  })
  const r = await loadBulletinExtras(asUser(env(), ADMIN), DATE)
  expect(r.attendance).toBeNull()
})
