// e2e 시드: 규칙을 끄고 에뮬레이터 Firestore 를 직접 쓴다(앱과 같은 projectId).
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';

const PROJECT_ID = 'demo-jungdeungbu';

// withSecurityRulesDisabled 가 주는 firestore()는 compat 타입이지만 실제 인스턴스는 모듈식 함수에 그대로 쓸 수 있다
// (tests/rules/setup.ts 와 같은 캐스트).
const modular = (db: unknown): Firestore => db as Firestore;

async function withEnv<T>(fn: (env: RulesTestEnvironment) => Promise<T>): Promise<T> {
  const env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: '127.0.0.1', port: 8080 },
  });
  try {
    return await fn(env);
  } finally {
    await env.cleanup();
  }
}

/** 규칙을 끈 채로 마음대로 쓴다(다음 시험들의 데이터 준비용). */
export async function seed(writer: (db: Firestore) => Promise<void>): Promise<void> {
  await withEnv((env) => env.withSecurityRulesDisabled((ctx) => writer(modular(ctx.firestore()))));
}

/** 규칙을 끈 채로 문서 하나를 그대로 읽는다(앱이 실제로 무엇을 저장했는지 확인용). 없으면 undefined. */
export async function readRaw(path: string): Promise<Record<string, unknown> | undefined> {
  return withEnv((env) => {
    let data: Record<string, unknown> | undefined;
    return env.withSecurityRulesDisabled(async (ctx) => {
      data = (await getDoc(doc(modular(ctx.firestore()), path))).data();
    }).then(() => data);
  });
}

/** invites/{email} 관리자 초대. 그 이메일로 로그인하면 관리자 교사 문서가 생긴다. */
export async function seedAdmin(email: string): Promise<void> {
  await seed((db) => setDoc(doc(db, 'invites', email.toLowerCase()), { name: '관리자', role: 'admin', classIds: [] }));
}

/** 에뮬레이터 Firestore 를 모두 비운다. */
export async function clear(): Promise<void> {
  await withEnv((env) => env.clearFirestore());
}
