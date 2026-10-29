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
