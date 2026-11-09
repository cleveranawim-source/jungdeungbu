import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'

export type TestUser = { uid: string; email: string }
export type TestDb = ReturnType<ReturnType<RulesTestEnvironment['authenticatedContext']>['firestore']>

export const ADMIN: TestUser = { uid: 'admin1', email: 'admin@example.com' }
export const TEACHER_A: TestUser = { uid: 'tA', email: 'a@example.com' } // 반 classA 담당
export const TEACHER_B: TestUser = { uid: 'tB', email: 'b@example.com' } // 반 classB 담당

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
