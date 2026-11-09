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
} from 'firebase/firestore';
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
 * 이 기기에 남은 Firestore 오프라인 캐시(IndexedDB)를 지운다. 교회 공용 기기에서 선생님이 로그아웃한 뒤
 * 학생 명단·기도 제목이 남지 않게. 지운 뒤 db 는 더 쓸 수 없으므로 부른 쪽이 화면을 새로 불러와야 한다.
 * 다른 탭이 열려 있으면 지우기가 실패할 수 있다(failed-precondition) — 조용히 넘어간다.
 */
export async function clearLocalCache(): Promise<void> {
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch {
    // 지우지 못해도 로그아웃은 이미 끝났다
  }
}
