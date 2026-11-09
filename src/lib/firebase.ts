// 앱 전용 Firebase 초기화. data/* 함수는 이 파일을 import 하지 않고 db·auth 를 인자로 받는다
// (tests/ 에서 import 하면 실제 프로젝트나 에뮬레이터에 붙으므로 금지).
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
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
