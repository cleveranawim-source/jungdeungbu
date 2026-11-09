import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach } from 'vitest'

export type TestUser = { uid: string; email: string }
export type TestDb = ReturnType<ReturnType<RulesTestEnvironment['authenticatedContext']>['firestore']>

export const ADMIN: TestUser = { uid: 'admin1', email: 'admin@example.com' }
export const TEACHER_A: TestUser = { uid: 'tA', email: 'a@example.com' } // 반 classA 담당
export const TEACHER_B: TestUser = { uid: 'tB', email: 'b@example.com' } // 반 classB 담당
export const OUTSIDER: TestUser = { uid: 'xU', email: 'x@example.com' } // 로그인했지만 초대·교사 문서 없음

// 학생 링크 토큰(22자 base64url, src/lib/token.ts TOKEN_RE와 같은 형식)
export const TOKEN_A = 'Tok3n_A-q8Zr2Lm5Nx7Pw1' // classA 학생
export const TOKEN_B = 'Tok3n_B-k4Ys9Hv6Jd0Fc3' // classB 학생

export const STUDENT_A = {
  name: '김하늘',
  classId: 'classA',
  birthday: '03-15',
  active: true,
  streak: 0,
  lastPresent: null,
}
export const STUDENT_B = {
  name: '이바다',
  classId: 'classB',
  birthday: null,
  active: true,
  streak: 0,
  lastPresent: null,
}

export async function makeEnv(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: 'demo-jungdeungbu',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
}

export function asUser(env: RulesTestEnvironment, u: TestUser) {
  return env.authenticatedContext(u.uid, { email: u.email, email_verified: true }).firestore()
}

export function asAnon(env: RulesTestEnvironment) {
  return env.unauthenticatedContext().firestore()
}

export async function seed(env: RulesTestEnvironment, writer: (db: TestDb) => Promise<void>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await writer(ctx.firestore())
  })
}

/** 모든 규칙 시험이 공유하는 기본 데이터: 초대 3건, 교사 3명, 반 2개, 학생 2명. */
export async function seedBase(env: RulesTestEnvironment) {
  await seed(env, async (db) => {
    await Promise.all([
      setDoc(doc(db, 'invites/admin@example.com'), { name: '관리자', role: 'admin', classIds: [] }),
      setDoc(doc(db, 'invites/a@example.com'), { name: '선생님A', role: 'teacher', classIds: ['classA'] }),
      setDoc(doc(db, 'invites/b@example.com'), { name: '선생님B', role: 'teacher', classIds: ['classB'] }),
      setDoc(doc(db, 'teachers/admin1'), { email: ADMIN.email, name: '관리자', role: 'admin', classIds: [] }),
      setDoc(doc(db, 'teachers/tA'), { email: TEACHER_A.email, name: '선생님A', role: 'teacher', classIds: ['classA'] }),
      setDoc(doc(db, 'teachers/tB'), { email: TEACHER_B.email, name: '선생님B', role: 'teacher', classIds: ['classB'] }),
      setDoc(doc(db, 'classes/classA'), { name: '1학년 1반', grade: 1, order: 1 }),
      setDoc(doc(db, 'classes/classB'), { name: '1학년 2반', grade: 1, order: 2 }),
      setDoc(doc(db, `students/${TOKEN_A}`), STUDENT_A),
      setDoc(doc(db, `students/${TOKEN_B}`), STUDENT_B),
    ])
  })
}

/**
 * 시험 파일 공통 수명 주기: beforeAll에서 env 생성, beforeEach에서 비우고 seedBase,
 * afterAll에서 cleanup. 돌려받은 함수로 현재 env를 꺼낸다.
 * (모든 파일이 같은 에뮬레이터·projectId를 쓰므로 test:rules는 --no-file-parallelism으로 돈다.)
 */
export function useRulesEnv(): () => RulesTestEnvironment {
  let env: RulesTestEnvironment | undefined
  beforeAll(async () => {
    env = await makeEnv()
  })
  beforeEach(async () => {
    await env!.clearFirestore()
    await seedBase(env!)
  })
  afterAll(async () => {
    await env?.cleanup()
  })
  return () => {
    if (!env) throw new Error('rules env not initialised')
    return env
  }
}
