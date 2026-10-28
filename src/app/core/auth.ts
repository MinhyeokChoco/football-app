import { Injectable, signal } from '@angular/core';
import { onAuthStateChanged, signInAnonymously, User } from 'firebase/auth';
import { auth } from './firebase';

// 가입 없이 익명 로그인한다. 이 기기의 uid 가 예전 attendee token / admin token 역할을 한다.
// 같은 브라우저에서는 uid 가 유지되니 "내 응답"을 다시 알아볼 수 있다.
@Injectable({ providedIn: 'root' })
export class Auth {
  /** 로그인 전에는 null */
  readonly uid = signal<string | null>(null);

  private readonly ready: Promise<User>;

  constructor() {
    this.ready = new Promise((resolve, reject) => {
      onAuthStateChanged(auth, (user) => {
        this.uid.set(user?.uid ?? null);
        if (user) resolve(user);
      });
      // 저장된 계정이 없을 때만 새로 만든다
      auth.authStateReady().then(() => {
        if (!auth.currentUser) signInAnonymously(auth).catch(reject);
      });
    });
  }

  /** 쓰기 전에 기다린다. 처음 들어온 사람은 여기서 익명 계정이 만들어진다. */
  user(): Promise<User> {
    return this.ready;
  }
}
