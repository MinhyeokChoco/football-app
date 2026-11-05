import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import {
  collection,
  deleteDoc,
  doc,
  Firestore,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const HOST = 'host'; // 모임을 만든 사람
const AMY = 'amy'; // 링크 받은 친구
const EVE = 'eve'; // 남의 이름을 쓰려는 사람
const E = 'e1';
const KEY = 'k'.repeat(24);

const eventAt = Timestamp.fromMillis(Date.now() + 7 * 24 * 3600 * 1000);
const baseEvent = { title: '토요일 풋살', place: '잠실', eventAt, minPeople: 10, teams: null };

let env: RulesTestEnvironment;
const as = (uid: string) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

const activity = (db: Firestore) => doc(collection(db, 'events', E, 'activities'));

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-football-rules',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'events', E), { ...baseEvent, createdBy: HOST, createdAt: Timestamp.now() });
    await setDoc(doc(db, 'events', E, 'private', 'admin'), { key: KEY });
    await setDoc(doc(db, 'events', E, 'hosts', HOST), { key: KEY });
    await setDoc(doc(db, 'events', E, 'attendees', '에이미'), {
      name: '에이미',
      status: 'YES',
      uid: AMY,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  });
});

// 앱이 하는 것과 똑같이 batch 로 모임을 만든다
function createBatch(db: Firestore, uid: string, id: string, opts: { hostKey?: string } = {}) {
  const b = writeBatch(db);
  b.set(doc(db, 'events', id), {
    ...baseEvent,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
  b.set(doc(db, 'events', id, 'private', 'admin'), { key: KEY });
  b.set(doc(db, 'events', id, 'hosts', uid), { key: opts.hostKey ?? KEY });
  return b;
}

describe('모임', () => {
  it('로그인 없이도 모임과 명단을 읽을 수 있다', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'events', E)));
    await assertSucceeds(getDocs(collection(anon(), 'events', E, 'attendees')));
  });

  it('주최자 키·주최자 등록과 함께 batch 로 만든다', async () => {
    await assertSucceeds(createBatch(as(AMY), AMY, 'new').commit());
  });

  it('주최자 등록 없이 모임만 만들 수 없다', async () => {
    const db = as(AMY);
    await assertFails(
      setDoc(doc(db, 'events', 'new'), { ...baseEvent, createdBy: AMY, createdAt: serverTimestamp() }),
    );
  });

  it('주최자 키와 다른 키로 자기를 등록할 수 없다', async () => {
    await assertFails(createBatch(as(AMY), AMY, 'new', { hostKey: 'x'.repeat(24) }).commit());
  });

  it('로그인 안 했으면 만들 수 없다', async () => {
    await assertFails(createBatch(anon(), 'nobody', 'new').commit());
  });

  it('입력값 범위를 벗어나면 만들 수 없다', async () => {
    const db = as(AMY);
    const b = createBatch(db, AMY, 'new');
    b.set(doc(db, 'events', 'new'), {
      ...baseEvent,
      minPeople: 99,
      createdBy: AMY,
      createdAt: serverTimestamp(),
    });
    await assertFails(b.commit());
  });

  it('주최자만 수정할 수 있다', async () => {
    await assertSucceeds(updateDoc(doc(as(HOST), 'events', E), { title: '일요일 풋살' }));
    await assertFails(updateDoc(doc(as(AMY), 'events', E), { title: '일요일 풋살' }));
  });

  it('주최자도 만든 사람은 바꿀 수 없다', async () => {
    await assertFails(updateDoc(doc(as(HOST), 'events', E), { createdBy: AMY }));
  });

  it('팀을 공개한 뒤에도 경기 정보를 고칠 수 있다', async () => {
    const db = as(HOST);
    await assertSucceeds(
      updateDoc(doc(db, 'events', E), { teams: { a: ['에이미'], b: [], at: serverTimestamp() } }),
    );
    await assertSucceeds(updateDoc(doc(db, 'events', E), { place: '강남' }));
  });

  it('팀의 시각은 서버 시각이어야 한다', async () => {
    await assertFails(
      updateDoc(doc(as(HOST), 'events', E), {
        teams: { a: [], b: [], at: Timestamp.fromMillis(0) },
      }),
    );
  });

  it('주최자가 팀을 공개할 수 있다', async () => {
    await assertSucceeds(
      updateDoc(doc(as(HOST), 'events', E), {
        teams: { a: ['에이미'], b: ['밥'], at: serverTimestamp() },
      }),
    );
    await assertFails(
      updateDoc(doc(as(AMY), 'events', E), {
        teams: { a: ['에이미'], b: ['밥'], at: serverTimestamp() },
      }),
    );
  });
});

describe('주최자 키', () => {
  it('주최자만 키를 읽는다', async () => {
    await assertSucceeds(getDoc(doc(as(HOST), 'events', E, 'private', 'admin')));
    await assertFails(getDoc(doc(as(AMY), 'events', E, 'private', 'admin')));
  });

  it('이미 있는 모임에 키를 새로 심을 수 없다', async () => {
    await assertFails(setDoc(doc(as(EVE), 'events', E, 'private', 'admin'), { key: 'e'.repeat(24) }));
  });

  it('키를 알면 다른 기기도 주최자가 된다', async () => {
    await assertSucceeds(setDoc(doc(as(AMY), 'events', E, 'hosts', AMY), { key: KEY }));
    await assertSucceeds(updateDoc(doc(as(AMY), 'events', E), { title: '바뀜' }));
  });

  it('키가 틀리면 주최자가 될 수 없다', async () => {
    await assertFails(setDoc(doc(as(EVE), 'events', E, 'hosts', EVE), { key: 'x'.repeat(24) }));
  });

  it('남의 uid 로 등록할 수 없다', async () => {
    await assertFails(setDoc(doc(as(EVE), 'events', E, 'hosts', AMY), { key: KEY }));
  });

  it('남이 주최자인지 조회할 수 없다', async () => {
    await assertSucceeds(getDoc(doc(as(HOST), 'events', E, 'hosts', HOST)));
    await assertFails(getDoc(doc(as(AMY), 'events', E, 'hosts', HOST)));
  });
});

describe('응답', () => {
  const join = (db: Firestore, uid: string, name: string, status = 'YES') => {
    const b = writeBatch(db);
    b.set(doc(db, 'events', E, 'attendees', name), {
      name,
      status,
      uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    b.set(activity(db), { kind: 'join', name, status, by: uid, at: serverTimestamp() });
    return b.commit();
  };

  it('새 이름으로 응답할 수 있다', async () => {
    await assertSucceeds(join(as(EVE), EVE, '이브'));
  });

  it('남이 쓴 이름으로는 응답을 바꿀 수 없다', async () => {
    await assertFails(join(as(EVE), EVE, '에이미', 'NO'));
    await assertFails(
      updateDoc(doc(as(EVE), 'events', E, 'attendees', '에이미'), {
        status: 'NO',
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('내 응답은 바꿀 수 있다', async () => {
    const db = as(AMY);
    const b = writeBatch(db);
    b.update(doc(db, 'events', E, 'attendees', '에이미'), { status: 'NO', updatedAt: serverTimestamp() });
    b.set(activity(db), { kind: 'change', name: '에이미', status: 'NO', by: AMY, at: serverTimestamp() });
    await assertSucceeds(b.commit());
  });

  it('응답의 주인은 바꿀 수 없다', async () => {
    await assertFails(
      updateDoc(doc(as(AMY), 'events', E, 'attendees', '에이미'), { uid: EVE }),
    );
  });

  it('문서 id 와 이름이 다르면 안 된다', async () => {
    await assertFails(
      setDoc(doc(as(EVE), 'events', E, 'attendees', '이브'), {
        name: '에이미',
        status: 'YES',
        uid: EVE,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('너무 길거나 앞뒤 공백이 있는 이름은 안 된다', async () => {
    await assertFails(join(as(EVE), EVE, '열세글자이름이너무길어요요'));
    await assertFails(join(as(EVE), EVE, ' 이브'));
  });

  it('없는 모임에는 응답할 수 없다', async () => {
    const db = as(EVE);
    await assertFails(
      setDoc(doc(db, 'events', 'nope', 'attendees', '이브'), {
        name: '이브',
        status: 'YES',
        uid: EVE,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('본인과 주최자만 지울 수 있다', async () => {
    await assertFails(deleteDoc(doc(as(EVE), 'events', E, 'attendees', '에이미')));
    await assertSucceeds(deleteDoc(doc(as(HOST), 'events', E, 'attendees', '에이미')));
  });

  it('본인은 지울 수 있다', async () => {
    await assertSucceeds(deleteDoc(doc(as(AMY), 'events', E, 'attendees', '에이미')));
  });
});

describe('기록', () => {
  it('실제로 일어나지 않은 응답 기록은 남길 수 없다', async () => {
    await assertFails(
      setDoc(activity(as(EVE)), { kind: 'join', name: '에이미', status: 'YES', by: EVE, at: serverTimestamp() }),
    );
  });

  it('주최자가 아니면 장소 변경 기록을 남길 수 없다', async () => {
    await assertFails(
      setDoc(activity(as(EVE)), { kind: 'place', place: '강남', by: EVE, at: serverTimestamp() }),
    );
    await assertFails(setDoc(activity(as(EVE)), { kind: 'time', by: EVE, at: serverTimestamp() }));
  });

  it('주최자의 장소 변경은 실제 변경과 함께여야 한다', async () => {
    const db = as(HOST);
    await assertFails(setDoc(activity(db), { kind: 'place', place: '강남', by: HOST, at: serverTimestamp() }));

    const b = writeBatch(db);
    b.update(doc(db, 'events', E), { place: '강남' });
    b.set(activity(db), { kind: 'place', place: '강남', by: HOST, at: serverTimestamp() });
    await assertSucceeds(b.commit());
  });

  it('취소 기록은 내 응답을 지울 때만', async () => {
    const db = as(AMY);
    const b = writeBatch(db);
    b.delete(doc(db, 'events', E, 'attendees', '에이미'));
    b.set(activity(db), { kind: 'cancel', name: '에이미', by: AMY, at: serverTimestamp() });
    await assertSucceeds(b.commit());
  });

  it('주최자는 남의 응답을 지우며 기록을 남긴다', async () => {
    const db = as(HOST);
    const b = writeBatch(db);
    b.delete(doc(db, 'events', E, 'attendees', '에이미'));
    b.set(activity(db), { kind: 'remove', name: '에이미', by: HOST, at: serverTimestamp() });
    await assertSucceeds(b.commit());
  });

  it('남의 uid 로 기록할 수 없고, 기록은 고칠 수 없다', async () => {
    await assertFails(setDoc(activity(as(EVE)), { kind: 'time', by: HOST, at: serverTimestamp() }));

    const ref = doc(collection(as(HOST), 'events', E, 'activities'), 'a1');
    await assertSucceeds(setDoc(ref, { kind: 'time', by: HOST, at: serverTimestamp() }));
    await assertFails(updateDoc(ref, { kind: 'teams' }));
  });

  it('기록은 주최자만 지울 수 있다', async () => {
    const ref = doc(collection(as(HOST), 'events', E, 'activities'), 'a1');
    await assertSucceeds(setDoc(ref, { kind: 'time', by: HOST, at: serverTimestamp() }));
    await assertFails(deleteDoc(doc(as(AMY), 'events', E, 'activities', 'a1')));
    await assertFails(deleteDoc(doc(anon(), 'events', E, 'activities', 'a1')));
    await assertSucceeds(deleteDoc(ref));
  });
});

describe('정원·회비', () => {
  it('정원·회비·계좌를 넣어 만들 수 있다', async () => {
    const db = as(AMY);
    const b = createBatch(db, AMY, 'new');
    b.set(doc(db, 'events', 'new'), {
      ...baseEvent,
      maxPeople: 12,
      fee: 10000,
      account: '토스 1000-0000',
      closed: false,
      createdBy: AMY,
      createdAt: serverTimestamp(),
    });
    await assertSucceeds(b.commit());
  });

  it('정원이 최소 인원보다 적으면 안 된다', async () => {
    await assertFails(updateDoc(doc(as(HOST), 'events', E), { maxPeople: 5 }));
    await assertSucceeds(updateDoc(doc(as(HOST), 'events', E), { maxPeople: 12 }));
  });

  it('처음부터 마감된 모임은 만들 수 없다', async () => {
    const db = as(AMY);
    const b = createBatch(db, AMY, 'new');
    b.set(doc(db, 'events', 'new'), { ...baseEvent, closed: true, createdBy: AMY, createdAt: serverTimestamp() });
    await assertFails(b.commit());
  });

  it('회비 냈는지는 주최자만 표시한다', async () => {
    const ref = (db: Firestore) => doc(db, 'events', E, 'attendees', '에이미');
    await assertFails(updateDoc(ref(as(AMY)), { paid: true }));
    await assertSucceeds(updateDoc(ref(as(HOST)), { paid: true }));
    // 회비 표시 권한으로 남의 응답을 바꿀 수는 없다
    await assertFails(updateDoc(ref(as(HOST)), { paid: false, status: 'NO' }));
  });
});

describe('친구 데려가기', () => {
  const ref = (db: Firestore) => doc(db, 'events', E, 'attendees', '에이미');
  const setGuests = (db: Firestore, uid: string, guests: number) => {
    const b = writeBatch(db);
    b.update(ref(db), { guests });
    b.set(activity(db), { kind: 'guests', name: '에이미', guests, by: uid, at: serverTimestamp() });
    return b.commit();
  };

  it('내 응답에 친구 수를 붙일 수 있다', async () => {
    await assertSucceeds(setGuests(as(AMY), AMY, 2));
  });

  it('남의 응답이나 5명 넘게는 안 된다', async () => {
    await assertFails(setGuests(as(EVE), EVE, 1));
    await assertFails(setGuests(as(AMY), AMY, 6));
  });

  it('친구 수만 바꾸면서 대기 순서(updatedAt)를 바꿀 수 없다', async () => {
    await assertFails(updateDoc(ref(as(AMY)), { guests: 1, updatedAt: serverTimestamp() }));
  });

  it('참석/불참을 바꿀 땐 updatedAt 이 서버 시각이어야 한다', async () => {
    await assertFails(updateDoc(ref(as(AMY)), { status: 'NO' }));
    await assertFails(updateDoc(ref(as(AMY)), { status: 'NO', updatedAt: Timestamp.fromMillis(0) }));
  });

  it('바뀌지 않은 친구 수로 기록을 남길 수 없다', async () => {
    await assertFails(
      setDoc(activity(as(AMY)), { kind: 'guests', name: '에이미', guests: 0, by: AMY, at: serverTimestamp() }),
    );
  });
});

describe('마감', () => {
  const close = (db: Firestore, uid: string, closed = true) => {
    const b = writeBatch(db);
    b.update(doc(db, 'events', E), { closed });
    b.set(activity(db), { kind: 'close', closed, by: uid, at: serverTimestamp() });
    return b.commit();
  };

  it('주최자만 마감한다', async () => {
    await assertFails(close(as(AMY), AMY));
    await assertSucceeds(close(as(HOST), HOST));
    await assertSucceeds(close(as(HOST), HOST, false));
  });

  it('마감되면 다른 사람은 명단을 못 바꾼다', async () => {
    await close(as(HOST), HOST);
    await assertFails(
      setDoc(doc(as(EVE), 'events', E, 'attendees', '이브'), {
        name: '이브',
        status: 'YES',
        uid: EVE,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    const mine = doc(as(AMY), 'events', E, 'attendees', '에이미');
    await assertFails(updateDoc(mine, { status: 'NO', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(mine, { guests: 1 }));
    await assertFails(deleteDoc(mine));
  });

  it('마감돼도 주최자는 명단을 고치고 회비를 체크한다', async () => {
    await close(as(HOST), HOST);
    const db = as(HOST);
    await assertSucceeds(updateDoc(doc(db, 'events', E, 'attendees', '에이미'), { paid: true }));
    await assertSucceeds(
      setDoc(doc(db, 'events', E, 'attendees', '호스트'), {
        name: '호스트',
        status: 'YES',
        uid: HOST,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(deleteDoc(doc(db, 'events', E, 'attendees', '에이미')));
  });
});

describe('모임 삭제', () => {
  // 앱처럼: 명단·기록을 먼저 지우고 마지막에 모임·키·주최자를 함께
  async function deleteAll(db: Firestore) {
    await deleteDoc(doc(db, 'events', E, 'attendees', '에이미'));
    const hosts = await getDocs(collection(db, 'events', E, 'hosts'));
    const b = writeBatch(db);
    b.delete(doc(db, 'events', E, 'private', 'admin'));
    b.delete(doc(db, 'events', E));
    hosts.docs.forEach((d) => b.delete(d.ref));
    return b.commit();
  }

  it('주최자는 모임을 통째로 지운다', async () => {
    await assertSucceeds(setDoc(doc(as(AMY), 'events', E, 'hosts', AMY), { key: KEY }));
    await assertSucceeds(deleteAll(as(HOST)));
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      if ((await getDoc(doc(db, 'events', E))).exists()) throw new Error('모임이 남았다');
      if (!(await getDocs(collection(db, 'events', E, 'hosts'))).empty) throw new Error('주최자가 남았다');
    });
  });

  it('주최자가 아니면 지울 수 없고 주최자 명단도 못 본다', async () => {
    await assertFails(deleteDoc(doc(as(AMY), 'events', E)));
    await assertFails(getDocs(collection(as(AMY), 'events', E, 'hosts')));
    await assertFails(deleteDoc(doc(as(AMY), 'events', E, 'hosts', HOST)));
  });
});
