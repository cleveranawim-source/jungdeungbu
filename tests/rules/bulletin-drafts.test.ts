import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { beforeEach, describe, test } from 'vitest'
import { ADMIN, asAnon, asStudent, asUser, OUTSIDER, seed, STUDENT_A_UID, TEACHER_A, useRulesEnv } from './setup'

const env = useRulesEnv()

const DATE = '2026-11-15'
const DRAFT = `bulletinDrafts/${DATE}`

const validDraft = (date = DATE) => ({
  date,
  bulletin: { date, sermonTitle: '초안 설교' },
  members: { newFriends: ['새봄'], birthdays: [] },
  updatedBy: ADMIN.uid,
  updatedAt: new Date(),
})

describe('주보 초안: bulletinDrafts', () => {
  beforeEach(async () => {
    await seed(env(), (db) => setDoc(doc(db, DRAFT), validDraft()))
  })

  test('로그인 없는 사람·세션 있는 학생·반 교사·초대 없는 계정은 초안을 읽지 못한다', async () => {
    await assertFails(getDoc(doc(asAnon(env()), DRAFT)))
    await assertFails(getDoc(doc(asStudent(env(), STUDENT_A_UID), DRAFT)))
    await assertFails(getDoc(doc(asUser(env(), TEACHER_A), DRAFT)))
    await assertFails(getDoc(doc(asUser(env(), OUTSIDER), DRAFT)))
  })

  test('관리자는 초안을 읽는다', async () => {
    await assertSucceeds(getDoc(doc(asUser(env(), ADMIN), DRAFT)))
  })

  test('쓰기는 관리자만: 올바른 모양은 성공', async () => {
    await assertSucceeds(setDoc(doc(asUser(env(), ADMIN), DRAFT), validDraft()))
  })

  test('교사·학생·익명은 초안을 쓰지 못한다', async () => {
    await assertFails(setDoc(doc(asUser(env(), TEACHER_A), DRAFT), validDraft()))
    await assertFails(setDoc(doc(asStudent(env(), STUDENT_A_UID), DRAFT), validDraft()))
    await assertFails(setDoc(doc(asAnon(env()), DRAFT), validDraft()))
  })

  test('관리자라도 허용 칸 밖의 키가 있으면 거절', async () => {
    await assertFails(setDoc(doc(asUser(env(), ADMIN), DRAFT), { ...validDraft(), published: true }))
  })

  test('관리자라도 date 가 문서 ID 와 다르면 거절', async () => {
    await assertFails(setDoc(doc(asUser(env(), ADMIN), DRAFT), validDraft('2026-11-22')))
  })

  test('관리자라도 날짜가 아닌 문서 ID 는 거절', async () => {
    await assertFails(setDoc(doc(asUser(env(), ADMIN), 'bulletinDrafts/abc'), validDraft('abc')))
  })

  test('삭제는 관리자만', async () => {
    await assertFails(deleteDoc(doc(asUser(env(), TEACHER_A), DRAFT)))
    await assertFails(deleteDoc(doc(asStudent(env(), STUDENT_A_UID), DRAFT)))
    await assertSucceeds(deleteDoc(doc(asUser(env(), ADMIN), DRAFT)))
  })

  test('목록 질의는 누구도 못 한다', async () => {
    await assertFails(getDocs(collection(asUser(env(), ADMIN), 'bulletinDrafts')))
    await assertFails(getDocs(collection(asUser(env(), TEACHER_A), 'bulletinDrafts')))
    await assertFails(getDocs(collection(asStudent(env(), STUDENT_A_UID), 'bulletinDrafts')))
    await assertFails(getDocs(collection(asAnon(env()), 'bulletinDrafts')))
  })
})
