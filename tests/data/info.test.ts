import { doc, getDoc, setDoc } from 'firebase/firestore'
import { expect, test } from 'vitest'
import { getChurchInfo, getMemberInfo, saveInfo } from '../../src/data/info'
import { EMPTY_CHURCH_INFO, type ChurchInfo, type MemberInfo } from '../../src/types'
import { ADMIN, asAnon, asStudent, asUser, seed, STUDENT_A_UID, TEACHER_A, useRulesEnv } from '../rules/setup'

const env = useRulesEnv()

const church: ChurchInfo = {
  motto: { title: '제목', subtitle: '부제', verse: '말씀', ref: '요 3:16' },
  etiquette: ['예배 전 휴대폰 끄기'],
  place: { name: '중등부실', address: '서울시', mapUrl: 'https://example.com/map' },
  churchPhone: '02-303-2501',
}
const members: MemberInfo = {
  servants: [{ role: '부장', names: '가나다' }],
  contacts: [{ label: '교역자', phone: '010-0000-0000' }],
}

test('안내가 없으면 빈 값', async () => {
  expect(await getChurchInfo(asAnon(env()))).toEqual(EMPTY_CHURCH_INFO)
  expect(await getMemberInfo(asStudent(env(), STUDENT_A_UID))).toBeNull()
})

test('관리자가 저장한 것을 학생 세션은 읽고, 로그인 없는 사람은 공개 칸만', async () => {
  const admin = asUser(env(), ADMIN)
  await saveInfo(admin, church, members)
  expect(await getChurchInfo(asAnon(env()))).toEqual(church)
  expect(await getMemberInfo(asAnon(env()))).toBeNull()
  expect(await getMemberInfo(asStudent(env(), STUDENT_A_UID))).toEqual(members)
})

test('빠진 칸이 있는 안내 문서도 읽힌다', async () => {
  await seed(env(), (db) => setDoc(doc(db, 'settings/info'), { churchPhone: '02-303-2501' }))
  const info = await getChurchInfo(asAnon(env()))
  expect(info.motto.title).toBe('')
  expect(info.etiquette).toEqual([])
  expect(info.place).toEqual(EMPTY_CHURCH_INFO.place)
  expect(info.churchPhone).toBe('02-303-2501')
})

/** 규칙을 끄고 두 문서를 그대로 읽는다 */
async function rawBoth() {
  let out: unknown[] = []
  await env().withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as never
    out = [(await getDoc(doc(db, 'settings/info'))).data(), (await getDoc(doc(db, 'memberInfo/main'))).data()]
  })
  return out
}

test('saveInfo: 관리자는 두 문서를 함께 쓴다', async () => {
  await saveInfo(asUser(env(), ADMIN), church, members)
  expect(await rawBoth()).toEqual([church, members])
})

test('saveInfo: 관리자가 아니면 거절되고 두 문서 모두 쓰이지 않는다', async () => {
  await expect(saveInfo(asUser(env(), TEACHER_A), church, members)).rejects.toMatchObject({ code: 'permission-denied' })
  expect(await rawBoth()).toEqual([undefined, undefined])
})

test('saveInfo: 한쪽이 규칙에 걸리면 다른 쪽도 쓰이지 않는다(한 번에 쓰기)', async () => {
  const admin = asUser(env(), ADMIN)
  await saveInfo(admin, church, members)
  const changed = { ...church, churchPhone: '010-0000-0000' }
  await expect(saveInfo(admin, changed, { ...members, extra: 1 } as unknown as MemberInfo))
    .rejects.toMatchObject({ code: 'permission-denied' })
  expect(await rawBoth()).toEqual([church, members])
})
