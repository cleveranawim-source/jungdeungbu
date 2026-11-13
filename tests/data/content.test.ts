import { doc, getDoc, Timestamp } from 'firebase/firestore'
import { expect, test } from 'vitest'
import {
  activeAnnouncements,
  deleteAnnouncement,
  getBulletin,
  getSermon,
  getTemplate,
  listAllBulletins,
  listAnnouncements,
  listBulletins,
  listSermons,
  saveAnnouncement,
  saveBulletin,
  saveSermon,
  saveTemplate,
} from '../../src/data/content'
import { DEFAULT_ORDER, EMPTY_BULLETIN_EXTRAS } from '../../src/types'
import { ADMIN, asAnon, asUser, TEACHER_A, useRulesEnv } from '../rules/setup'

const env = useRulesEnv()

const bulletin = (date: string, published: boolean) => ({
  date,
  order: [{ type: '기도', title: '대표기도', detail: '김집사' }],
  hymns: ['찬송 1장'],
  scripture: '시편 23:1',
  sermonTitle: `설교 ${date}`,
  published,
  ...EMPTY_BULLETIN_EXTRAS,
})

test('saveBulletin·getBulletin: updatedBy·updatedAt을 붙인다', async () => {
  await saveBulletin(asUser(env(), ADMIN), ADMIN.uid, bulletin('2026-11-15', true))
  const b = await getBulletin(asAnon(env()), '2026-11-15')
  expect(b).toMatchObject({ ...bulletin('2026-11-15', true), updatedBy: ADMIN.uid })
  expect(b?.updatedAt).toBeInstanceOf(Timestamp)
  expect(await getBulletin(asAnon(env()), '2026-11-22')).toBeNull()
  await expect(
    saveBulletin(asUser(env(), TEACHER_A), TEACHER_A.uid, bulletin('2026-11-15', true)),
  ).rejects.toMatchObject({ code: 'permission-denied' })
})

test('getBulletin: 임시저장 주보는 학생·익명에게 null(permission-denied), 교사에게는 그대로', async () => {
  await saveBulletin(asUser(env(), ADMIN), ADMIN.uid, bulletin('2026-11-22', false))
  expect(await getBulletin(asAnon(env()), '2026-11-22')).toBeNull()
  expect(await getBulletin(asUser(env(), TEACHER_A), '2026-11-22')).toMatchObject({ published: false })
  expect(await getBulletin(asUser(env(), ADMIN), '2026-11-22')).toMatchObject({ published: false })
})

test('listBulletins는 게시본만 최신순, listAllBulletins는 전부', async () => {
  const admin = asUser(env(), ADMIN)
  await saveBulletin(admin, ADMIN.uid, bulletin('2026-11-01', true))
  await saveBulletin(admin, ADMIN.uid, bulletin('2026-11-15', true))
  await saveBulletin(admin, ADMIN.uid, bulletin('2026-11-22', false))
  await saveBulletin(admin, ADMIN.uid, bulletin('2026-11-08', true))
  expect((await listBulletins(asAnon(env()))).map((b) => b.date)).toEqual(['2026-11-15', '2026-11-08', '2026-11-01'])
  expect((await listBulletins(asAnon(env()), 2)).map((b) => b.date)).toEqual(['2026-11-15', '2026-11-08'])
  expect((await listAllBulletins(admin)).map((b) => b.date)).toEqual([
    '2026-11-22',
    '2026-11-15',
    '2026-11-08',
    '2026-11-01',
  ])
})

test('설교: save·get·list 최신순', async () => {
  const admin = asUser(env(), ADMIN)
  const sermon = (date: string) => ({ date, title: `t${date}`, scripture: '요 3:16', summary: 's', body: 'b', questions: ['q1'] })
  await saveSermon(admin, sermon('2026-11-08'))
  await saveSermon(admin, sermon('2026-11-15'))
  expect(await getSermon(asAnon(env()), '2026-11-08')).toEqual(sermon('2026-11-08'))
  expect(await getSermon(asAnon(env()), '2026-11-01')).toBeNull()
  expect((await listSermons(asAnon(env()))).map((s) => s.date)).toEqual(['2026-11-15', '2026-11-08'])
  expect(await listSermons(asAnon(env()), 1)).toHaveLength(1)
})

test('광고: 새로 만들고 고쳐도 createdAt 유지, 유효기간 필터와 고정 우선', async () => {
  const admin = asUser(env(), ADMIN)
  const ad = (title: string, startDate: string, endDate: string, pinned = false) => ({
    title,
    body: '',
    startDate,
    endDate,
    pinned,
  })
  const a = await saveAnnouncement(admin, null, ad('수련회', '2026-11-09', '2026-11-21'))
  const b = await saveAnnouncement(admin, null, ad('성탄', '2026-11-15', '2026-12-25', true))
  await saveAnnouncement(admin, null, ad('지난 광고', '2026-10-01', '2026-11-14'))
  await saveAnnouncement(admin, null, ad('미래 광고', '2026-11-16', '2026-11-30'))

  const before = (await getDoc(doc(admin, `announcements/${a}`))).data()?.createdAt as Timestamp
  expect(await saveAnnouncement(admin, a, ad('수련회 안내', '2026-11-09', '2026-11-21'))).toBe(a)
  const after = await getDoc(doc(admin, `announcements/${a}`))
  expect(after.data()?.title).toBe('수련회 안내')
  expect((after.data()?.createdAt as Timestamp).isEqual(before)).toBe(true)

  const active = await activeAnnouncements(asAnon(env()), '2026-11-15')
  expect(active.map((x) => x.id)).toEqual([b, a])
  expect(active[1].title).toBe('수련회 안내')
  expect(await listAnnouncements(asAnon(env()))).toHaveLength(4)

  await deleteAnnouncement(admin, b)
  expect((await activeAnnouncements(asAnon(env()), '2026-11-15')).map((x) => x.id)).toEqual([a])
})

test('getTemplate: 없으면 DEFAULT_ORDER, 저장하면 그 값', async () => {
  expect(await getTemplate(asAnon(env()))).toEqual({ order: DEFAULT_ORDER })
  const order = [{ type: '찬양', title: '', detail: '' }]
  await saveTemplate(asUser(env(), ADMIN), { order })
  expect(await getTemplate(asAnon(env()))).toEqual({ order })
})
