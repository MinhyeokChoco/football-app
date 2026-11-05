import { Attendee } from './models';

// 명단 계산. 화면에서만 쓰는 값이라 저장하지 않고 매번 명단에서 다시 셈한다.

/** 데려오는 친구까지 센 머릿수 */
export const headcount = (list: Attendee[]) => list.reduce((n, a) => n + 1 + a.guests, 0);

/**
 * 참석을 누른 순서대로 정원까지 채우고 나머지는 대기로 돌린다.
 * 앞사람이 빠지면 다음 계산에서 대기 1번이 저절로 올라온다.
 * 한 번 넘친 뒤로는 뒷사람이 빈자리에 맞더라도 새치기하지 않는다.
 */
export function lineup(attendees: Attendee[], maxPeople: number | null) {
  const yes = attendees
    .filter((a) => a.status === 'YES')
    .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
  const confirmed: Attendee[] = [];
  const waiting: Attendee[] = [];
  let count = 0;
  for (const a of yes) {
    if (!waiting.length && (maxPeople == null || count + 1 + a.guests <= maxPeople)) {
      confirmed.push(a);
      count += 1 + a.guests;
    } else {
      waiting.push(a);
    }
  }
  return { confirmed, waiting, count };
}

/** 팀에 들어갈 이름. 데려오는 친구는 "민혁+1" 처럼 */
export const playerNames = (list: Attendee[]) =>
  list.flatMap((a) => [a.name, ...Array.from({ length: a.guests }, (_, i) => `${a.name}+${i + 1}`)]);

// 1 하 · 2 중 · 3 상. 안 매긴 사람과 친구는 중으로 친다
export type Level = 1 | 2 | 3;

function shuffle<T>(list: T[], random: () => number) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 잘하는 사람부터 실력 합이 낮은 팀에 넣는다. 인원은 많아야 한 명 차이.
 * 실력을 아무도 안 매겼으면 그냥 무작위로 반 나누는 것과 같다.
 */
export function balancedSplit(
  names: string[],
  levelOf: (name: string) => Level,
  random: () => number = Math.random,
) {
  // 같은 실력끼리는 섞여 있어야 매번 다른 팀이 나온다
  const order = shuffle(names, random).sort((x, y) => levelOf(y) - levelOf(x));
  const half = Math.ceil(names.length / 2);
  const a: string[] = [];
  const b: string[] = [];
  let sumA = 0;
  let sumB = 0;
  for (const n of order) {
    const toA =
      b.length >= half ? true
      : a.length >= half ? false
      : sumA !== sumB ? sumA < sumB
      : a.length !== b.length ? a.length < b.length
      : random() < 0.5;
    if (toA) {
      a.push(n);
      sumA += levelOf(n);
    } else {
      b.push(n);
      sumB += levelOf(n);
    }
  }
  return { a, b };
}

/** 모임을 다시 만들 때. 같은 요일·시각으로 적어도 한 주 뒤, 아직 안 지난 첫 날 */
export function nextSameSlot(prev: Date, now = new Date()) {
  const week = 7 * 24 * 3600 * 1000;
  let t = prev.getTime() + week;
  while (t <= now.getTime()) t += week;
  return new Date(t);
}
