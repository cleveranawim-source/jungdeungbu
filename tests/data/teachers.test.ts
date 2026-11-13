import { doc, getDoc, setDoc } from 'firebase/firestore'
import { expect, test } from 'vitest'
import {
  deleteInvite,
  ensureTeacher,
  listInvites,
  listTeachers,
  removeTeacher,
  saveInvite,
  saveTeacherProfile,
  updateTeacher,
} from '../../src/data/teachers'
import { ADMIN, asUser, OUTSIDER, seed, TEACHER_A, useRulesEnv } from '../rules/setup'

const env = useRulesEnv()

test('ensureTeacher: 초대된 새 uid는 teachers 문서가 생긴다', async () => {
  await seed(env(), (db) =>
    setDoc(doc(db, 'invites/new@example.com'), { name: '새선생님', role: 'teacher', classIds: ['classB'] }),
  )
  // Google 계정 이메일에 대문자가 섞여 있어도 소문자 초대 문서를 찾는다
  const user = { uid: 'newU', email: 'New@Example.com' }
  const db = asUser(env(), user)
  const teacher = await ensureTeacher(db, user)
  expect(teacher).toEqual({ email: 'new@example.com', name: '새선생님', role: 'teacher', classIds: ['classB'] })
  expect((await getDoc(doc(db, 'teachers/newU'))).data()).toEqual(teacher)
  // 두 번째 로그인은 기존 문서를 돌려준다
  expect(await ensureTeacher(db, user)).toEqual(teacher)
})

test('ensureTeacher: 이미 교사면 그 문서', async () => {
  expect(await ensureTeacher(asUser(env(), TEACHER_A), TEACHER_A)).toEqual({
    email: TEACHER_A.email,
    name: '선생님A',
    role: 'teacher',
    classIds: ['classA'],
  })
})

test('ensureTeacher: 초대 없으면 null', async () => {
  expect(await ensureTeacher(asUser(env(), OUTSIDER), OUTSIDER)).toBeNull()
})

test('listTeachers·listInvites (관리자)', async () => {
  const admin = asUser(env(), ADMIN)
  expect((await listTeachers(admin)).map((t) => t.id).sort()).toEqual(['admin1', 'tA', 'tB'])
  const invites = await listInvites(admin)
  expect(invites.find((i) => i.id === 'a@example.com')).toEqual({
    id: 'a@example.com',
    name: '선생님A',
    role: 'teacher',
    classIds: ['classA'],
  })
  await expect(listTeachers(asUser(env(), TEACHER_A))).rejects.toMatchObject({ code: 'permission-denied' })
})

test('saveInvite는 이메일을 소문자로 저장, deleteInvite도 소문자로 지운다', async () => {
  const admin = asUser(env(), ADMIN)
  await saveInvite(admin, 'Mixed@Example.COM', { name: '혼합', role: 'teacher', classIds: ['classA'] })
  expect((await listInvites(admin)).map((i) => i.id)).toContain('mixed@example.com')
  await deleteInvite(admin, 'MIXED@example.com')
  expect((await listInvites(admin)).map((i) => i.id)).not.toContain('mixed@example.com')
})

test('updateTeacher로 담당 반 변경', async () => {
  const admin = asUser(env(), ADMIN)
  await updateTeacher(admin, TEACHER_A.uid, { classIds: ['classA', 'classB'] })
  expect((await getDoc(doc(admin, 'teachers/tA'))).data()?.classIds).toEqual(['classA', 'classB'])
  await expect(updateTeacher(asUser(env(), TEACHER_A), TEACHER_A.uid, { role: 'admin' })).rejects.toMatchObject({
    code: 'permission-denied',
  })
})

test('removeTeacher는 teachers와 invites를 함께 지운다', async () => {
  const admin = asUser(env(), ADMIN)
  await removeTeacher(admin, TEACHER_A.uid, 'A@Example.com')
  expect((await getDoc(doc(admin, 'teachers/tA'))).exists()).toBe(false)
  expect((await getDoc(doc(admin, 'invites/a@example.com'))).exists()).toBe(false)
  // 초대가 없으니 다시 로그인해도 교사가 되지 못한다
  expect(await ensureTeacher(asUser(env(), TEACHER_A), TEACHER_A)).toBeNull()
})

test('ensureTeacher: 초대의 호칭도 함께 옮긴다', async () => {
  await seed(env(), (db) =>
    setDoc(doc(db, 'invites/new@example.com'), { name: '김전도', role: 'teacher', classIds: [], title: '전도사님' }),
  )
  const user = { uid: 'newU', email: 'new@example.com' }
  expect(await ensureTeacher(asUser(env(), user), user)).toEqual({
    email: 'new@example.com', name: '김전도', role: 'teacher', classIds: [], title: '전도사님',
  })
})

test('saveInvite: 호칭은 앞뒤 빈칸을 지우고, 비면 칸을 남기지 않는다', async () => {
  const admin = asUser(env(), ADMIN)
  await saveInvite(admin, 'x1@example.com', { name: '가', role: 'teacher', classIds: [], title: ' 목사님 ' })
  expect((await getDoc(doc(admin, 'invites/x1@example.com'))).data()?.title).toBe('목사님')
  await saveInvite(admin, 'x1@example.com', { name: '가', role: 'teacher', classIds: [], title: '  ' })
  expect((await getDoc(doc(admin, 'invites/x1@example.com'))).data()).not.toHaveProperty('title')
})

test('saveTeacherProfile: 이름·호칭·역할·반을 교사 문서와 초대에 함께 저장, 빈 호칭은 지운다', async () => {
  const admin = asUser(env(), ADMIN)
  await saveTeacherProfile(admin, TEACHER_A.uid, 'A@Example.com', { name: '김하나', title: '전도사님', role: 'teacher', classIds: ['classA'] })
  expect((await getDoc(doc(admin, 'teachers/tA'))).data()).toMatchObject({ name: '김하나', title: '전도사님', classIds: ['classA'] })
  expect((await getDoc(doc(admin, 'invites/a@example.com'))).data()).toEqual({ name: '김하나', title: '전도사님', role: 'teacher', classIds: ['classA'] })
  await saveTeacherProfile(admin, TEACHER_A.uid, 'a@example.com', { name: '김하나', title: '', role: 'teacher', classIds: ['classA'] })
  expect((await getDoc(doc(admin, 'teachers/tA'))).data()).not.toHaveProperty('title')
  expect((await getDoc(doc(admin, 'invites/a@example.com'))).data()).not.toHaveProperty('title')
  await expect(
    saveTeacherProfile(asUser(env(), TEACHER_A), TEACHER_A.uid, 'a@example.com', { name: '나', title: '목사님', role: 'teacher', classIds: [] }),
  ).rejects.toMatchObject({ code: 'permission-denied' })
})
