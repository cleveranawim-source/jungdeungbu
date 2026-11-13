import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { expect, test } from 'vitest'
import { getBulletin, getBulletinMembers } from '../../src/data/content'
import {
  discardBulletinDraft,
  loadBulletinForEdit,
  publishBulletin,
  saveBulletinDraft,
  unpublishBulletin,
} from '../../src/data/bulletinDrafts'
import { EMPTY_BULLETIN_EXTRAS, type BulletinContent, type BulletinMembers } from '../../src/types'
import { ADMIN, asAnon, asStudent, asUser, seed, STUDENT_A_UID, TEACHER_A, useRulesEnv } from '../rules/setup'

const env = useRulesEnv()

const DATE = '2026-11-15'

const content = (sermonTitle: string, date = DATE): BulletinContent => ({
  date,
  order: [{ type: '기도', title: '대표기도', detail: '김집사' }],
  hymns: ['찬송 1장'],
  scripture: '시편 23:1',
  sermonTitle,
  ...EMPTY_BULLETIN_EXTRAS,
})
const members = (...names: string[]): BulletinMembers => ({ newFriends: names, birthdays: [] })

const raw = async (path: string) => {
  let out: Record<string, unknown> | null = null
  await env().withSecurityRulesDisabled(async (ctx) => {
    const snap = await getDoc(doc(ctx.firestore() as never, path))
    out = snap.exists() ? snap.data() : null
  })
  return out
}

const admin = () => asUser(env(), ADMIN)

async function publishedV1WithDraftV2() {
  await publishBulletin(admin(), ADMIN.uid, content('A'), members('새봄'))
  await saveBulletinDraft(admin(), ADMIN.uid, content('B'), members('다온'))
}

test('초안 저장은 게시된 주보를 건드리지 않는다', async () => {
  await publishedV1WithDraftV2()
  const b = await getBulletin(asAnon(env()), DATE)
  expect(b).toMatchObject({ sermonTitle: 'A', published: true })
  expect((await getBulletinMembers(asStudent(env(), STUDENT_A_UID), DATE))?.newFriends).toEqual(['새봄'])
  const e = await loadBulletinForEdit(admin(), DATE)
  expect(e.status).toBe('published-with-draft')
  expect(e.content?.sermonTitle).toBe('B')
  expect(e.members.newFriends).toEqual(['다온'])
  expect(e.draftSavedAt).toBeInstanceOf(Timestamp)
  expect(e.publishedAt).toBeInstanceOf(Timestamp)
})

test('게시하면 초안이 사라지고 학생에게 새 내용이 보인다', async () => {
  await publishedV1WithDraftV2()
  await publishBulletin(admin(), ADMIN.uid, content('B'), members('다온'))
  expect((await getBulletin(asAnon(env()), DATE))?.sermonTitle).toBe('B')
  expect((await getBulletinMembers(asStudent(env(), STUDENT_A_UID), DATE))?.newFriends).toEqual(['다온'])
  expect(await raw(`bulletinDrafts/${DATE}`)).toBeNull()
  expect((await loadBulletinForEdit(admin(), DATE)).status).toBe('published')
})

test('게시 내리기: 학생에게서 내려가고 내용은 남는다', async () => {
  await publishBulletin(admin(), ADMIN.uid, content('A'), members('새봄'))
  await unpublishBulletin(admin(), ADMIN.uid, DATE)
  expect(await getBulletin(asAnon(env()), DATE)).toBeNull()
  expect(await getBulletinMembers(asStudent(env(), STUDENT_A_UID), DATE)).toBeNull()
  const e = await loadBulletinForEdit(admin(), DATE)
  expect(e.status).toBe('draft')
  expect(e.content).toMatchObject(content('A'))
  expect(e.members).toEqual(members('새봄'))
})

test('새 주보: 초안만 저장하면 학생에게는 아무것도 없다', async () => {
  await saveBulletinDraft(admin(), ADMIN.uid, content('초안만'), members('새봄'))
  expect(await getBulletin(asAnon(env()), DATE)).toBeNull()
  expect(await raw(`bulletins/${DATE}`)).toBeNull()
  expect((await loadBulletinForEdit(admin(), DATE)).status).toBe('draft')
  const none = await loadBulletinForEdit(admin(), '2026-11-22')
  expect(none).toMatchObject({ status: 'new', content: null, members: { newFriends: [], birthdays: [] } })
  expect(none.draftSavedAt).toBeNull()
  expect(none.publishedAt).toBeNull()
})

test('예전 임시저장 문서(미게시 주보)는 초안처럼 읽힌다', async () => {
  await seed(env(), (db) =>
    setDoc(doc(db, `bulletins/${DATE}`), {
      date: DATE, order: [], hymns: [], scripture: '', sermonTitle: '옛 임시', published: false, updatedBy: 'x',
    }),
  )
  const e = await loadBulletinForEdit(admin(), DATE)
  expect(e.status).toBe('draft')
  expect(e.content).toMatchObject({
    sermonTitle: '옛 임시', issue: '', leader: '', opening: { text: '', ref: '' }, nextServers: [], attendance: null,
  })
  expect(e.content).not.toHaveProperty('published')
  expect(e.content).not.toHaveProperty('updatedBy')
  expect(e.content).not.toHaveProperty('updatedAt')
  expect(e.members).toEqual({ newFriends: [], birthdays: [] })
})

test('초안 버리기', async () => {
  await publishedV1WithDraftV2()
  await discardBulletinDraft(admin(), DATE)
  const e = await loadBulletinForEdit(admin(), DATE)
  expect(e.status).toBe('published')
  expect(e.content?.sermonTitle).toBe('A')
  expect(e.members.newFriends).toEqual(['새봄'])
  expect(e.draftSavedAt).toBeNull()
})

test('초안에도 반 ID 가 들어가지 않는다', async () => {
  const attendance = {
    sunday: DATE,
    classes: [{ name: '1학년 1반', present: 3, total: 4, classId: 'classA-secret' }],
    students: { present: 3, total: 4 },
    teachers: null,
  }
  await saveBulletinDraft(
    admin(), ADMIN.uid, { ...content('A'), attendance: attendance as never }, members(),
  )
  const json = JSON.stringify(await raw(`bulletinDrafts/${DATE}`))
  expect(json).not.toContain('classId')
  expect(json).not.toContain('classA-secret')
  expect(json).toContain('1학년 1반')
})

test('관리자가 아니면 모두 거절되고 아무것도 쓰이지 않는다', async () => {
  const t = asUser(env(), TEACHER_A)
  await expect(saveBulletinDraft(t, TEACHER_A.uid, content('X'), members('새봄'))).rejects.toMatchObject({ code: 'permission-denied' })
  await expect(publishBulletin(t, TEACHER_A.uid, content('X'), members('새봄'))).rejects.toMatchObject({ code: 'permission-denied' })
  await expect(unpublishBulletin(t, TEACHER_A.uid, DATE)).rejects.toBeTruthy()
  await expect(discardBulletinDraft(t, DATE)).rejects.toMatchObject({ code: 'permission-denied' })
  await expect(loadBulletinForEdit(t, DATE)).rejects.toMatchObject({ code: 'permission-denied' })
  expect(await raw(`bulletinDrafts/${DATE}`)).toBeNull()
  expect(await raw(`bulletins/${DATE}`)).toBeNull()
  expect(await raw(`bulletins/${DATE}/members/main`)).toBeNull()

  // 이미 게시된 주보도 교사가 내리거나 지우지 못한다
  await publishBulletin(admin(), ADMIN.uid, content('A'), members('새봄'))
  await saveBulletinDraft(admin(), ADMIN.uid, content('B'), members('다온'))
  await expect(unpublishBulletin(t, TEACHER_A.uid, DATE)).rejects.toMatchObject({ code: 'permission-denied' })
  await expect(discardBulletinDraft(t, DATE)).rejects.toMatchObject({ code: 'permission-denied' })
  expect(await raw(`bulletins/${DATE}`)).toMatchObject({ published: true, sermonTitle: 'A' })
  expect(await raw(`bulletinDrafts/${DATE}`)).toMatchObject({ bulletin: { sermonTitle: 'B' } })
})
