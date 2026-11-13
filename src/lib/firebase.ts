// 앱 전용 Firebase 초기화. data/* 함수는 이 파일을 import 하지 않고 db·auth 를 인자로 받는다
// (tests/ 에서 import 하면 실제 프로젝트나 에뮬레이터에 붙으므로 금지).
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  clearIndexedDbPersistence,
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  waitForPendingWrites,
} from 'firebase/firestore';
import { clearDeviceData } from './deviceData';
import { USING_EMULATOR } from './env';

export { USING_EMULATOR };

const env = import.meta.env;

export const app = initializeApp(
  USING_EMULATOR
    ? { apiKey: 'demo-api-key', authDomain: 'demo-jungdeungbu.firebaseapp.com', projectId: 'demo-jungdeungbu' }
    : {
        apiKey: env.VITE_FIREBASE_API_KEY,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: env.VITE_FIREBASE_APP_ID,
      },
);

export const auth = getAuth(app);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (USING_EMULATOR) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
}

/**
 * 이 기기에 남은 흔적을 지운다: 마지막으로 연 학생 링크(jdb:lastStudentToken), 편집 임시본(jdb:draft:*), Firestore 오프라인 캐시(IndexedDB).
 * 교회 공용 기기에서 선생님이 로그아웃한 뒤 학생 명단·기도 제목이 남지 않게. 지운 뒤 db 는 더 쓸 수 없으므로
 * 부른 쪽이 화면을 새로 불러와야 한다. 같은 기기에 다른 탭이 열려 있어도 지우기는 성공하고, 그때 SDK 가 그 탭들의
 * Firestore 도 끝낸다(다시 쓸 수 없음) — 그래서 그 탭들은 계정이 사라진 것을 보고 스스로 새로 불러온다
 * (useAuthRole·useStudentSession). 지우기가 다른 이유로 실패하면 조용히 넘어간다.
 * **오프라인 쓰기 대기열도 함께 지워지므로**, 부르기 전에 flushPendingWrites 로 서버에 닿았는지 확인한다.
 */
export async function clearLocalCache(): Promise<void> {
  await clearDeviceData(async () => {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  });
}

/**
 * 아직 서버에 닿지 않은 쓰기(오프라인에서 찍은 출석 등)가 모두 닿을 때까지 기다린다. timeoutMs 안에 끝나지 않거나
 * 확인이 실패하면 'timeout' — 이때 캐시를 지우면 그 쓰기를 잃는다.
 */
export async function flushPendingWrites(timeoutMs: number): Promise<'flushed' | 'timeout'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => { timer = setTimeout(() => resolve('timeout'), timeoutMs); });
  try {
    return await Promise.race([
      waitForPendingWrites(db).then(() => 'flushed' as const, () => 'timeout' as const),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
