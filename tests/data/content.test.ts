import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { expect, test } from 'vitest'
import {
  activeAnnouncements,
  deleteAnnouncement,
  getBulletin,
  getBulletinMembers,
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
import { ADMIN, asAnon, asStudent, asUser, seed, STUDENT_A_UID, TEACHER_A, useRulesEnv } from '../rules/setup'

const env = useRulesEnv()

const NO_MEMBERS = { newFriends: [], birthdays: [] }

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
  await saveBulletin(asUser(env(), ADMIN), ADMIN.uid, bulletin('2026-11-15', true), NO_MEMBERS)
  const b = await getBulletin(asAnon(env()), '2026-11-15')
  expect(b).toMatchObject({ ...bulletin('2026-11-15', true), updatedBy: ADMIN.uid })
  expect(b?.updatedAt).toBeInstanceOf(Timestamp)
  expect(await getBulletin(asAnon(env()), '2026-11-22')).toBeNull()
  await expect(
    saveBulletin(asUser(env(), TEACHER_A), TEACHER_A.uid, bulletin('2026-11-15', true), NO_MEMBERS),
  ).rejects.toMatchObject({ code: 'permission-denied' })
})

test('getBulletin: 임시저장 주보는 학생·익명에게 null(permission-denied), 교사에게는 그대로', async () => {
  await saveBulletin(asUser(env(), ADMIN), ADMIN.uid, bulletin('2026-11-22', false), NO_MEMBERS)
  expect(await getBulletin(asAnon(env()), '2026-11-22')).toBeNull()
  expect(await getBulletin(asUser(env(), TEACHER_A), '2026-11-22')).toMatchObject({ published: false })
  expect(await getBulletin(asUser(env(), ADMIN), '2026-11-22')).toMatchObject({ published: false })
})

test('listBulletins는 게시본만 최신순, listAllBulletins는 전부', async () => {
  const admin = asUser(env(), ADMIN)
  await saveBulletin(admin, ADMIN.uid, bulletin('2026-11-01', true), NO_MEMBERS)
  await saveBulletin(admin, ADMIN.uid, bulletin('2026-11-15', true), NO_MEMBERS)
  await saveBulletin(admin, ADMIN.uid, bulletin('2026-11-22', false), NO_MEMBERS)
  await saveBulletin(admin, ADMIN.uid, bulletin('2026-11-08', true), NO_MEMBERS)
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

test('옛 모양 주보(새 칸 없음)도 빈 값으로 채워 읽는다', async () => {
  await seed(env(), (db) =>
    setDoc(doc(db, 'bulletins/2026-11-15'), {
      date: '2026-11-15',
      order: [{ type: '설교', title: 't', detail: '' }],
      hymns: [],
      scripture: '',
      sermonTitle: '',
      published: true,
      updatedBy: 'x',
      updatedAt: Timestamp.fromDate(new Date('2026-11-01T02:00:00Z')),
    }),
  )
  const b = await getBulletin(asAnon(env()), '2026-11-15')
  expect(b).toMatchObject({ issue: '', leader: '', opening: { text: '', ref: '' }, nextServers: [], attendance: null })
  const [listed] = await listBulletins(asAnon(env()))
  expect(listed).toMatchObject({ issue: '', nextServers: [], attendance: null })
  const [all] = await listAllBulletins(asUser(env(), ADMIN))
  expect(all).toMatchObject({ leader: '', opening: { text: '', ref: '' } })
})

test('saveBulletin 은 주보와 잠긴 문서를 함께 쓴다', async () => {
  const members = { newFriends: ['새봄'], birthdays: [{ name: '다온', date: '11-03' }] }
  await saveBulletin(
    asUser(env(), ADMIN),
    ADMIN.uid,
    { ...bulletin('2026-11-15', true), issue: '제 12 호', leader: '교역자', opening: { text: '여호와는 나의 목자', ref: '시 23:1' } },
    members,
  )
  expect(await getBulletinMembers(asStudent(env(), STUDENT_A_UID), '2026-11-15')).toEqual(members)
  expect(await getBulletinMembers(asAnon(env()), '2026-11-15')).toBeNull()
  const raw = await getDoc(doc(asUser(env(), ADMIN), 'bulletins/2026-11-15'))
  expect(raw.data()).not.toHaveProperty('newFriends')
  expect(raw.data()).not.toHaveProperty('birthdays')
  expect(raw.data()).toMatchObject({ issue: '제 12 호', leader: '교역자' })
})

test('교사(관리자 아님)의 saveBulletin 은 두 문서 모두 쓰이지 않는다', async () => {
  await expect(
    saveBulletin(asUser(env(), TEACHER_A), TEACHER_A.uid, bulletin('2026-11-15', true), {
      newFriends: ['새봄'],
      birthdays: [],
    }),
  ).rejects.toMatchObject({ code: 'permission-denied' })
  await seed(env(), async (db) => {
    expect((await getDoc(doc(db, 'bulletins/2026-11-15/members/main'))).exists()).toBe(false)
    expect((await getDoc(doc(db, 'bulletins/2026-11-15'))).exists()).toBe(false)
  })
})

test('saveBulletin: 출석 반 줄에 반 ID가 섞여 와도 이름·인원만 저장한다', async () => {
  const sneaky = {
    sunday: '2026-11-08',
    classes: [{ classId: 'classA', name: '1-1', present: 5, total: 8, extra: 'x' }],
    students: { present: 5, total: 8 },
    teachers: null,
  }
  await saveBulletin(asUser(env(), ADMIN), ADMIN.uid,
    { ...bulletin('2026-11-15', true), attendance: sneaky as never }, NO_MEMBERS)
  let raw: Record<string, unknown> | undefined
  await env().withSecurityRulesDisabled(async (ctx) => {
    raw = (await getDoc(doc(ctx.firestore() as never, 'bulletins/2026-11-15'))).data()
  })
  expect(raw?.attendance).toEqual({
    sunday: '2026-11-08', classes: [{ name: '1-1', present: 5, total: 8 }], students: { present: 5, total: 8 }, teachers: null,
  })
})

test('saveBulletin: 반 줄이 하나도 없는 출석은 싣지 않는다(학생 0/0 금지)', async () => {
  const empty = { sunday: '2026-11-08', classes: [], students: { present: 0, total: 0 }, teachers: { present: 3, total: 4 } }
  await saveBulletin(asUser(env(), ADMIN), ADMIN.uid, { ...bulletin('2026-11-15', true), attendance: empty }, NO_MEMBERS)
  expect((await getBulletin(asAnon(env()), '2026-11-15'))?.attendance).toBeNull()
})

test('getBulletin: 손으로 넣은 옛 문서의 반 ID는 읽을 때 버린다', async () => {
  await seed(env(), (db) => setDoc(doc(db, 'bulletins/2026-11-15'), {
    ...bulletin('2026-11-15', true),
    attendance: { sunday: '2026-11-08', classes: [{ classId: 'classA', name: '1-1', present: 5, total: 8 }], students: { present: 5, total: 8 }, teachers: null },
  }))
  const b = await getBulletin(asAnon(env()), '2026-11-15')
  expect(b?.attendance?.classes).toEqual([{ name: '1-1', present: 5, total: 8 }])
  expect(JSON.stringify(b)).not.toContain('classA')
})
