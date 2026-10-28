import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

// localhost 에서는 에뮬레이터(npm run dev)에 붙는다. Firebase 프로젝트가 없어도 개발할 수 있다.
const useEmulators = ['localhost', '127.0.0.1'].includes(location.hostname);

// 웹 앱에 그대로 노출되는 공개 설정값. 접근 제어는 firestore.rules 에서 한다.
const prodConfig = {
  apiKey: 'AIzaSyDeFQ0FLpZO9Ra2RZctItkMH_wZXQpKw5A',
  authDomain: 'football-mh.firebaseapp.com',
  projectId: 'football-mh',
  storageBucket: 'football-mh.firebasestorage.app',
  messagingSenderId: '71318026261',
  appId: '1:71318026261:web:3969ab08bdfd52dcae761c',
};

// demo- 로 시작하는 프로젝트 id 는 에뮬레이터 전용이라 실제 서버로 새어 나가지 않는다
const emulatorConfig = { apiKey: 'demo', projectId: 'demo-football', appId: 'demo' };

export const firebaseApp = initializeApp(useEmulators ? emulatorConfig : prodConfig);

export const auth = getAuth(firebaseApp);

// 한 번 본 모임은 오프라인에서도 열린다 (홈 화면 앱으로 경기장에서 열 때)
export const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
});

if (useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
