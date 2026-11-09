import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { beforeEach, describe, expect, test } from 'vitest'
import { ADMIN, asAnon, asStudent, asUser, OUTSIDER, seed, STUDENT_A_UID, TEACHER_A, useRulesEnv } from './setup'

const env = useRulesEnv()

const DATE = '2026-11-15'
const bulletin = (date = DATE) => ({
  date,
  order: [{ type: '설교', title: '빛과 소금', detail: '' }],
  hymns: ['찬송가 1장'],
  scripture: '마태복음 5:13-16',
  sermonTitle: '빛과 소금',
  published: true,
  updatedBy: 'admin1',
  updatedAt: serverTimestamp(),
})
const sermon = (date = DATE) => ({
  date,
  title: '빛과 소금',
  scripture: '마태복음 5:13-16',
  summary: '요약',
  body: '본문',
  questions: ['나는 어디서 빛이 될까?'],
})
const announcement = {
  title: '수련회',
  body: '겨울 수련회 신청',
  startDate: '2026-11-15',
  endDate: '2026-12-20',
  pinned: false,
  createdAt: serverTimestamp(),
}
const template = { order: [{ type: '묵도', title: '', detail: '' }] }

describe('콘텐츠 읽기', () => {
  beforeEach(async () => {
    await seed(env(), async (db) => {
      await setDoc(doc(db, `bulletins/${DATE}`), bulletin())
      await setDoc(doc(db, `sermons/${DATE}`), sermon())
      await setDoc(doc(db, 'announcements/ann1'), announcement)
      await setDoc(doc(db, 'settings/bulletinTemplate'), template)
    })
  })

  test('익명이 주보·설교·광고·settings를 읽는다', async () => {
    const anon = asAnon(env())
    await assertSucceeds(getDoc(doc(anon, `bulletins/${DATE}`)))
    const bulletins = await assertSucceeds(
      getDocs(query(collection(anon, 'bulletins'), where('published', '==', true))),
    )
    expect(bulletins.size).toBe(1)
    await assertSucceeds(getDoc(doc(anon, `sermons/${DATE}`)))
    expect((await assertSucceeds(getDocs(collection(anon, 'sermons')))).size).toBe(1)
    await assertSucceeds(getDoc(doc(anon, 'announcements/ann1')))
    expect((await assertSucceeds(getDocs(collection(anon, 'announcements')))).size).toBe(1)
    const tpl = await assertSucceeds(getDoc(doc(anon, 'settings/bulletinTemplate')))
    expect(tpl.data()).toEqual(template)
    await assertSucceeds(getDocs(collection(anon, 'settings')))
  })
})

describe('임시저장 주보 읽기', () => {
  const DRAFT = '2026-11-22'
  beforeEach(async () => {
    await seed(env(), async (db) => {
      await setDoc(doc(db, `bulletins/${DATE}`), bulletin())
      await setDoc(doc(db, `bulletins/${DRAFT}`), { ...bulletin(DRAFT), published: false })
    })
  })

  test('익명·학생은 임시저장 주보를 get 못 한다, 게시본은 된다', async () => {
    const anon = asAnon(env())
    await assertFails(getDoc(doc(anon, `bulletins/${DRAFT}`)))
    await assertSucceeds(getDoc(doc(anon, `bulletins/${DATE}`)))
    await assertFails(getDoc(doc(asStudent(env(), STUDENT_A_UID), `bulletins/${DRAFT}`)))
    await assertFails(getDoc(doc(asUser(env(), OUTSIDER), `bulletins/${DRAFT}`)))
  })

  test('없는 주보 get은 누구나 된다(빈 결과)', async () => {
    const snap = await assertSucceeds(getDoc(doc(asAnon(env()), 'bulletins/2026-12-06')))
    expect(snap.exists()).toBe(false)
  })

  test('익명 list: 조건 없으면 실패, published == true면 성공', async () => {
    const anon = asAnon(env())
    await assertFails(getDocs(collection(anon, 'bulletins')))
    await assertFails(getDocs(query(collection(anon, 'bulletins'), where('published', '==', false))))
    const ok = await assertSucceeds(getDocs(query(collection(anon, 'bulletins'), where('published', '==', true))))
    expect(ok.docs.map((d) => d.id)).toEqual([DATE])
  })

  test('교사는 임시저장 주보를 get·list 한다', async () => {
    for (const u of [TEACHER_A, ADMIN]) {
      const db = asUser(env(), u)
      const snap = await assertSucceeds(getDoc(doc(db, `bulletins/${DRAFT}`)))
      expect(snap.data()?.published).toBe(false)
      expect((await assertSucceeds(getDocs(collection(db, 'bulletins')))).size).toBe(2)
    }
  })
})

describe('콘텐츠 쓰기', () => {
  test('반 교사는 주보를 못 쓴다, admin은 쓴다', async () => {
    await assertFails(setDoc(doc(asUser(env(), TEACHER_A), `bulletins/${DATE}`), bulletin()))
    await assertFails(setDoc(doc(asAnon(env()), `bulletins/${DATE}`), bulletin()))
    const admin = asUser(env(), ADMIN)
    await assertSucceeds(setDoc(doc(admin, `bulletins/${DATE}`), bulletin()))
    await assertFails(updateDoc(doc(asUser(env(), TEACHER_A), `bulletins/${DATE}`), { published: false }))
    await assertFails(deleteDoc(doc(asUser(env(), TEACHER_A), `bulletins/${DATE}`)))
    await assertSucceeds(updateDoc(doc(admin, `bulletins/${DATE}`), { published: false }))
    await assertSucceeds(deleteDoc(doc(admin, `bulletins/${DATE}`)))
  })

  test('설교·광고·settings도 admin만 쓴다', async () => {
    const a = asUser(env(), TEACHER_A)
    const x = asUser(env(), OUTSIDER)
    const anon = asAnon(env())
    for (const db of [a, x, anon]) {
      await assertFails(setDoc(doc(db, `sermons/${DATE}`), sermon()))
      await assertFails(setDoc(doc(db, 'announcements/ann2'), announcement))
      await assertFails(setDoc(doc(db, 'settings/bulletinTemplate'), template))
    }
    const admin = asUser(env(), ADMIN)
    await assertSucceeds(setDoc(doc(admin, `sermons/${DATE}`), sermon()))
    await assertSucceeds(setDoc(doc(admin, 'announcements/ann2'), announcement))
    await assertSucceeds(setDoc(doc(admin, 'settings/bulletinTemplate'), template))
    await assertFails(deleteDoc(doc(a, 'announcements/ann2')))
    await assertFails(updateDoc(doc(a, `sermons/${DATE}`), { title: '바뀐 제목' }))
    await assertSucceeds(updateDoc(doc(admin, `sermons/${DATE}`), { title: '바뀐 제목' }))
    await assertSucceeds(deleteDoc(doc(admin, 'announcements/ann2')))
  })

  test('bulletins 문서 ID가 날짜 형식이 아니면 거부', async () => {
    const admin = asUser(env(), ADMIN)
    await assertSucceeds(setDoc(doc(admin, `bulletins/${DATE}`), bulletin()))
    await assertFails(setDoc(doc(admin, 'bulletins/latest'), bulletin('latest')))
    await assertFails(setDoc(doc(admin, 'bulletins/2026-11-15x'), bulletin('2026-11-15x')))
  })

  test('sermons 문서 ID가 날짜 형식이 아니면 거부', async () => {
    const admin = asUser(env(), ADMIN)
    await assertSucceeds(setDoc(doc(admin, `sermons/${DATE}`), sermon()))
    await assertFails(setDoc(doc(admin, 'sermons/20261115'), sermon('20261115')))
  })
})
