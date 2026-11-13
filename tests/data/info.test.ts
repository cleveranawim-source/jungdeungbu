import { doc, setDoc } from 'firebase/firestore'
import { expect, test } from 'vitest'
import { getChurchInfo, getMemberInfo, saveChurchInfo, saveMemberInfo } from '../../src/data/info'
import { EMPTY_CHURCH_INFO, type ChurchInfo, type MemberInfo } from '../../src/types'
import { ADMIN, asAnon, asStudent, asUser, seed, STUDENT_A_UID, useRulesEnv } from '../rules/setup'

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
  await saveChurchInfo(admin, church)
  await saveMemberInfo(admin, members)
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
