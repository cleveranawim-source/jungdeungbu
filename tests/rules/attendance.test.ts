import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { describe, expect, test } from 'vitest'
import {
  ADMIN,
  asAnon,
  asUser,
  OUTSIDER,
  seed,
  STUDENT_A,
  TEACHER_A,
  TEACHER_B,
  TOKEN_A,
  TOKEN_B,
  type TestUser,
  useRulesEnv,
} from './setup'

const env = useRulesEnv()

const DATE = '2026-11-08'
const att = (token: string, date = DATE) => `students/${token}/attendance/${date}`
const record = (u: TestUser, date = DATE) => ({ date, present: true, by: u.uid, at: serverTimestamp() })

async function seedAttendance() {
  await seed(env(), async (db) => {
    const at = Timestamp.fromDate(new Date('2026-11-08T01:00:00Z'))
    await setDoc(doc(db, att(TOKEN_A, '2026-11-01')), { date: '2026-11-01', present: true, by: 'tA', at })
    await setDoc(doc(db, att(TOKEN_A, DATE)), { date: DATE, present: true, by: 'tA', at })
    await setDoc(doc(db, att(TOKEN_B, DATE)), { date: DATE, present: false, by: 'tB', at })
  })
}

describe('attendance 쓰기', () => {
  test('반 교사는 자기 반 학생 출석 기록', async () => {
    const a = asUser(env(), TEACHER_A)
    await assertSucceeds(setDoc(doc(a, att(TOKEN_A)), record(TEACHER_A)))
    // 다시 토글(= update)
    await assertSucceeds(setDoc(doc(a, att(TOKEN_A)), { ...record(TEACHER_A), present: false }))
    const snap = await getDoc(doc(a, att(TOKEN_A)))
    expect(snap.data()?.present).toBe(false)
  })

  test('data 계층의 출석 배치(출석 문서 + streak·lastPresent)가 통과한다', async () => {
    const a = asUser(env(), TEACHER_A)
    const batch = writeBatch(a)
    batch.set(doc(a, att(TOKEN_A)), record(TEACHER_A))
    batch.update(doc(a, `students/${TOKEN_A}`), { streak: 1, lastPresent: DATE })
    await assertSucceeds(batch.commit())
  })

  test('다른 반 교사는 거부', async () => {
    const b = asUser(env(), TEACHER_B)
    await assertSucceeds(setDoc(doc(b, att(TOKEN_B)), record(TEACHER_B)))
    await assertFails(setDoc(doc(b, att(TOKEN_A)), record(TEACHER_B)))
    const batch = writeBatch(b)
    batch.set(doc(b, att(TOKEN_A)), record(TEACHER_B))
    batch.update(doc(b, `students/${TOKEN_A}`), { streak: 1, lastPresent: DATE })
    await assertFails(batch.commit())
  })

  test('교사 아닌 로그인·익명은 거부', async () => {
    await assertSucceeds(setDoc(doc(asUser(env(), TEACHER_A), att(TOKEN_A)), record(TEACHER_A)))
    await assertFails(setDoc(doc(asUser(env(), OUTSIDER), att(TOKEN_A, '2026-11-15')), record(OUTSIDER, '2026-11-15')))
    await assertFails(
      setDoc(doc(asAnon(env()), att(TOKEN_A, '2026-11-15')), {
        date: '2026-11-15',
        present: true,
        by: 'tA',
        at: serverTimestamp(),
      }),
    )
  })

  test('admin은 어느 반이든 가능', async () => {
    const admin = asUser(env(), ADMIN)
    await assertSucceeds(setDoc(doc(admin, att(TOKEN_A)), record(ADMIN)))
    await assertSucceeds(setDoc(doc(admin, att(TOKEN_B)), record(ADMIN)))
  })

  test('admin 링크 재발급 배치(새 학생 + 출석 복사 + 옛 문서 비활성)가 통과한다', async () => {
    await seedAttendance()
    const admin = asUser(env(), ADMIN)
    const NEW_TOKEN = 'Tok3n_R-reissued000001'
    const old = await getDocs(collection(admin, `students/${TOKEN_A}/attendance`))
    expect(old.size).toBe(2)
    const batch = writeBatch(admin)
    batch.set(doc(admin, `students/${NEW_TOKEN}`), { ...STUDENT_A, streak: 2, lastPresent: DATE })
    // 원래 by(tA)·at(과거 시각)을 그대로 복사
    for (const d of old.docs) batch.set(doc(admin, `students/${NEW_TOKEN}/attendance/${d.id}`), d.data())
    batch.update(doc(admin, `students/${TOKEN_A}`), { active: false })
    await assertSucceeds(batch.commit())
    const copied = await getDocs(collection(asAnon(env()), `students/${NEW_TOKEN}/attendance`))
    expect(copied.size).toBe(2)
  })

  test('교사는 원래 기록을 흉내 낸 복사(by·at 임의 값)를 못 한다', async () => {
    const a = asUser(env(), TEACHER_A)
    const past = Timestamp.fromDate(new Date('2026-11-01T01:00:00Z'))
    await assertSucceeds(setDoc(doc(a, att(TOKEN_A)), record(TEACHER_A)))
    await assertFails(setDoc(doc(a, att(TOKEN_A)), { date: DATE, present: true, by: 'tA', at: past }))
  })

  test('by가 본인 uid가 아니면 거부', async () => {
    const a = asUser(env(), TEACHER_A)
    await assertFails(setDoc(doc(a, att(TOKEN_A)), { ...record(TEACHER_A), by: 'tB' }))
    await assertSucceeds(setDoc(doc(a, att(TOKEN_A)), record(TEACHER_A)))
  })

  test('date 필드와 문서 ID가 다르면 거부', async () => {
    const a = asUser(env(), TEACHER_A)
    await assertFails(setDoc(doc(a, att(TOKEN_A)), { ...record(TEACHER_A), date: '2026-11-15' }))
    await assertFails(setDoc(doc(a, att(TOKEN_A, '20261108')), record(TEACHER_A, '20261108')))
    await assertSucceeds(setDoc(doc(a, att(TOKEN_A)), record(TEACHER_A)))
  })

  test('present가 bool이 아니거나, at이 서버 시각이 아니거나, 여분 키가 있으면 거부', async () => {
    const a = asUser(env(), TEACHER_A)
    await assertFails(setDoc(doc(a, att(TOKEN_A)), { ...record(TEACHER_A), present: 'yes' }))
    await assertFails(setDoc(doc(a, att(TOKEN_A)), { ...record(TEACHER_A), at: Timestamp.now() }))
    await assertFails(setDoc(doc(a, att(TOKEN_A)), { ...record(TEACHER_A), note: '지각' }))
    const { at: _omit, ...noAt } = record(TEACHER_A)
    await assertFails(setDoc(doc(a, att(TOKEN_A)), noAt))
    await assertSucceeds(setDoc(doc(a, att(TOKEN_A)), record(TEACHER_A)))
  })

  test('없는 학생 토큰 아래에는 교사가 쓸 수 없다', async () => {
    await assertSucceeds(setDoc(doc(asUser(env(), TEACHER_A), att(TOKEN_A)), record(TEACHER_A)))
    await assertFails(setDoc(doc(asUser(env(), TEACHER_A), att('Tok3n_Z-noStudentDoc00')), record(TEACHER_A)))
  })

  test('update로 by를 남의 uid로 바꾸면 거부', async () => {
    await seedAttendance()
    const a = asUser(env(), TEACHER_A)
    await assertSucceeds(updateDoc(doc(a, att(TOKEN_A)), { present: false, by: 'tA', at: serverTimestamp() }))
    await assertFails(updateDoc(doc(a, att(TOKEN_A)), { present: true, by: 'tB', at: serverTimestamp() }))
  })

  test('출석 삭제는 그 반 교사 또는 admin', async () => {
    await seedAttendance()
    await assertFails(deleteDoc(doc(asUser(env(), TEACHER_B), att(TOKEN_A))))
    await assertFails(deleteDoc(doc(asAnon(env()), att(TOKEN_A))))
    await assertSucceeds(deleteDoc(doc(asUser(env(), TEACHER_A), att(TOKEN_A))))
    await assertSucceeds(deleteDoc(doc(asUser(env(), ADMIN), att(TOKEN_B))))
  })
})

describe('attendance 읽기', () => {
  test('익명은 토큰 경로로 출석 목록을 읽는다', async () => {
    await seedAttendance()
    const anon = asAnon(env())
    const list = await assertSucceeds(getDocs(collection(anon, `students/${TOKEN_A}/attendance`)))
    expect(list.docs.map((d) => d.id).sort()).toEqual(['2026-11-01', DATE])
    await assertSucceeds(getDoc(doc(anon, att(TOKEN_B))))
  })

  test('컬렉션 그룹 질의는 교사만', async () => {
    await seedAttendance()
    const q = (db: ReturnType<typeof asAnon>) => query(collectionGroup(db, 'attendance'), where('date', '==', DATE))
    const byTeacher = await assertSucceeds(getDocs(q(asUser(env(), TEACHER_A))))
    expect(byTeacher.size).toBe(2)
    await assertSucceeds(getDocs(q(asUser(env(), ADMIN))))
    await assertFails(getDocs(q(asAnon(env()))))
    await assertFails(getDocs(q(asUser(env(), OUTSIDER))))
  })
})
