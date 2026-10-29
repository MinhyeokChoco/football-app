import { DestroyRef, Injectable, WritableSignal, inject, signal } from '@angular/core';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { Auth } from './auth';
import { db } from './firebase';
import {
  Activity,
  Attendee,
  EventInput,
  FootballEvent,
  RsvpStatus,
  Teams,
} from './models';

const eventRef = (id: string) => doc(db, 'events', id);
const attendeeRef = (id: string, name: string) => doc(db, 'events', id, 'attendees', name);
const activityRef = (id: string) => doc(collection(db, 'events', id, 'activities'));
const adminRef = (id: string) => doc(db, 'events', id, 'private', 'admin');
const hostRef = (id: string, uid: string) => doc(db, 'events', id, 'hosts', uid);

// 주최자 링크에 붙는 키. 추측할 수 없을 만큼 길게
function newKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

const toDate = (t: unknown) => (t instanceof Timestamp ? t.toDate() : new Date());

function toEvent(id: string, d: Record<string, any>): FootballEvent {
  return {
    id,
    title: d['title'],
    place: d['place'],
    eventAt: toDate(d['eventAt']),
    minPeople: d['minPeople'],
    teams: d['teams'] ? { a: d['teams'].a, b: d['teams'].b, at: toDate(d['teams'].at) } : null,
  };
}

/** 이름이 문서 id 가 되니 Firestore 가 못 쓰는 문자는 막는다 */
export function nameProblem(name: string): string | null {
  if (!name) return '이름부터 써줘!';
  if (name.length > 12) return '이름은 12자까지야';
  if (name.includes('/') || /^\.\.?$/.test(name) || /^__.*__$/.test(name)) {
    return '이름에 쓸 수 없는 글자가 있어';
  }
  return null;
}

export class NameTakenError extends Error {
  constructor(name: string) {
    super(`'${name}'은 이미 명단에 있어. 다른 이름을 쓰거나, 본인이면 주최자한테 지워달라고 해줘`);
  }
}

/** 한 모임 화면이 보는 실시간 상태. 화면이 사라지면 구독도 끊는다. */
export interface EventWatch {
  event: WritableSignal<FootballEvent | null>;
  attendees: WritableSignal<Attendee[]>;
  activities: WritableSignal<Activity[]>;
  missing: WritableSignal<boolean>;
}

@Injectable({ providedIn: 'root' })
export class EventStore {
  private readonly auth = inject(Auth);

  // ── 읽기 ─────────────────────────────────────────────

  /** 모임·명단·기록을 실시간으로 본다. 친구가 누르는 순간 내 화면도 바뀐다. */
  watch(eventId: string, destroyRef: DestroyRef): EventWatch {
    const w: EventWatch = {
      event: signal(null),
      attendees: signal([]),
      activities: signal([]),
      missing: signal(false),
    };

    const stops = [
      onSnapshot(
        eventRef(eventId),
        // 캐시에 없다고 바로 "없는 모임"이라 하지 않고 서버 답을 기다린다
        { includeMetadataChanges: true },
        (snap) => {
          if (snap.exists()) w.event.set(toEvent(snap.id, snap.data()));
          else if (!snap.metadata.fromCache) w.missing.set(true);
        },
        () => w.missing.set(true),
      ),
      onSnapshot(
        query(collection(db, 'events', eventId, 'attendees'), orderBy('createdAt')),
        (snap) =>
          w.attendees.set(
            snap.docs.map((d) => ({
              name: d.id,
              status: d.get('status'),
              uid: d.get('uid'),
              createdAt: toDate(d.get('createdAt')),
            })),
          ),
      ),
      onSnapshot(
        query(collection(db, 'events', eventId, 'activities'), orderBy('at', 'desc'), limit(30)),
        (snap) =>
          w.activities.set(
            snap.docs.map((d) => ({
              id: d.id,
              kind: d.get('kind'),
              name: d.get('name'),
              status: d.get('status'),
              place: d.get('place'),
              // 내가 방금 쓴 기록은 서버 시간이 오기 전까지 null 이다
              at: toDate(d.get('at', { serverTimestamps: 'estimate' })),
            })),
          ),
      ),
    ];
    destroyRef.onDestroy(() => stops.forEach((stop) => stop()));
    return w;
  }

  // ── 모임 만들기 ───────────────────────────────────────

  /** 모임, 주최자 키, 나를 주최자로 한 번에 만든다. 주최자 키를 돌려준다. */
  async create(input: EventInput): Promise<{ id: string; key: string }> {
    const { uid } = await this.auth.user();
    const ref = doc(collection(db, 'events'));
    const key = newKey();

    const batch = writeBatch(db);
    batch.set(ref, {
      ...input,
      eventAt: Timestamp.fromDate(input.eventAt),
      teams: null,
      createdBy: uid,
      createdAt: serverTimestamp(),
    });
    batch.set(adminRef(ref.id), { key });
    batch.set(hostRef(ref.id, uid), { key });
    await batch.commit();
    return { id: ref.id, key };
  }

  // ── 주최자 ────────────────────────────────────────────

  async isHost(eventId: string): Promise<boolean> {
    const { uid } = await this.auth.user();
    try {
      return (await getDoc(hostRef(eventId, uid))).exists();
    } catch {
      return false;
    }
  }

  /** 주최자 링크(?key=)로 들어온 기기를 주최자로 등록한다. 키가 틀리면 false */
  async claimHost(eventId: string, key: string): Promise<boolean> {
    const { uid } = await this.auth.user();
    try {
      await setDoc(hostRef(eventId, uid), { key });
      return true;
    } catch {
      return false;
    }
  }

  /** 주최자 링크를 다시 복사할 때. 주최자만 읽을 수 있다 */
  async hostKey(eventId: string): Promise<string | null> {
    try {
      return ((await getDoc(adminRef(eventId))).get('key') as string) ?? null;
    } catch {
      return null;
    }
  }

  async update(before: FootballEvent, input: EventInput) {
    const { uid } = await this.auth.user();
    const batch = writeBatch(db);
    batch.update(eventRef(before.id), { ...input, eventAt: Timestamp.fromDate(input.eventAt) });

    if (input.place !== before.place) {
      batch.set(activityRef(before.id), { kind: 'place', place: input.place, by: uid, at: serverTimestamp() });
    }
    if (input.eventAt.getTime() !== before.eventAt.getTime()) {
      batch.set(activityRef(before.id), { kind: 'time', by: uid, at: serverTimestamp() });
    }
    await batch.commit();
  }

  /** 주최자가 나눈 팀을 모두에게 보여준다. null 이면 내린다 */
  async publishTeams(eventId: string, teams: Omit<Teams, 'at'> | null) {
    const { uid } = await this.auth.user();
    const batch = writeBatch(db);
    batch.update(eventRef(eventId), {
      teams: teams ? { ...teams, at: serverTimestamp() } : null,
    });
    if (teams) batch.set(activityRef(eventId), { kind: 'teams', by: uid, at: serverTimestamp() });
    await batch.commit();
  }

  /** 주최자가 기록을 전부 지운다. 화면에 안 보이는 오래된 기록까지 */
  async clearActivities(eventId: string) {
    await this.auth.user();
    const snap = await getDocs(collection(db, 'events', eventId, 'activities'));
    // batch 하나에 500개까지라 나눠서 지운다
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }

  // ── 응답 ─────────────────────────────────────────────

  /**
   * 참석/불참. 같은 이름이 있으면 내 것일 때만 바꾼다.
   * 남의 이름이면 규칙에서도 막히지만, 그 전에 알아듣기 쉬운 문구로 알려준다.
   */
  async rsvp(eventId: string, name: string, status: RsvpStatus, current: Attendee | undefined) {
    const { uid } = await this.auth.user();
    if (current && current.uid !== uid) throw new NameTakenError(name);
    if (current?.status === status) return;

    const batch = writeBatch(db);
    if (current) {
      batch.update(attendeeRef(eventId, name), { status, updatedAt: serverTimestamp() });
    } else {
      batch.set(attendeeRef(eventId, name), {
        name,
        status,
        uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    batch.set(activityRef(eventId), {
      kind: current ? 'change' : 'join',
      name,
      status,
      by: uid,
      at: serverTimestamp(),
    });

    try {
      await batch.commit();
    } catch (err) {
      // 화면에 아직 안 보였지만 그 사이 누가 같은 이름으로 먼저 응답한 경우
      if ((err as { code?: string }).code === 'permission-denied') throw new NameTakenError(name);
      throw err;
    }
  }

  /** 내 응답 취소, 또는 주최자가 남의 응답을 지운다 */
  async remove(eventId: string, attendee: Attendee) {
    const { uid } = await this.auth.user();
    const batch = writeBatch(db);
    batch.delete(attendeeRef(eventId, attendee.name));
    batch.set(activityRef(eventId), {
      kind: attendee.uid === uid ? 'cancel' : 'remove',
      name: attendee.name,
      by: uid,
      at: serverTimestamp(),
    });
    await batch.commit();
  }
}
