import { Attendee } from './models';
import { balancedSplit, headcount, lineup, nextSameSlot, playerNames } from './lineup';

const at = (min: number) => new Date(Date.UTC(2026, 10, 1, 10, min));
const person = (name: string, min: number, extra: Partial<Attendee> = {}): Attendee => ({
  name,
  status: 'YES',
  uid: name,
  guests: 0,
  paid: false,
  createdAt: at(0),
  updatedAt: at(min),
  ...extra,
});

describe('lineup', () => {
  it('정원이 없으면 참석자 전부 확정', () => {
    const r = lineup([person('a', 2), person('b', 1), person('c', 3, { status: 'NO' })], null);
    expect(r.confirmed.map((a) => a.name)).toEqual(['b', 'a']);
    expect(r.waiting).toEqual([]);
    expect(r.count).toBe(2);
  });

  it('누른 순서대로 정원까지, 나머지는 대기', () => {
    const r = lineup([person('a', 1), person('b', 2), person('c', 3)], 2);
    expect(r.confirmed.map((a) => a.name)).toEqual(['a', 'b']);
    expect(r.waiting.map((a) => a.name)).toEqual(['c']);
  });

  it('친구까지 머릿수로 세고, 넘친 뒤로는 새치기하지 않는다', () => {
    const r = lineup([person('a', 1, { guests: 1 }), person('b', 2, { guests: 1 }), person('c', 3)], 3);
    expect(r.confirmed.map((a) => a.name)).toEqual(['a']);
    expect(r.waiting.map((a) => a.name)).toEqual(['b', 'c']);
    expect(r.count).toBe(2);
  });

  it('앞사람이 빠지면 대기 1번이 올라온다', () => {
    const list = [person('a', 1), person('b', 2), person('c', 3)];
    expect(lineup(list.slice(1), 2).confirmed.map((a) => a.name)).toEqual(['b', 'c']);
  });

  it('머릿수와 팀용 이름에 친구가 들어간다', () => {
    const list = [person('민혁', 1, { guests: 2 }), person('철수', 2)];
    expect(headcount(list)).toBe(4);
    expect(playerNames(list)).toEqual(['민혁', '민혁+1', '민혁+2', '철수']);
  });
});

describe('balancedSplit', () => {
  const levels: Record<string, 1 | 2 | 3> = { a: 3, b: 3, c: 3, d: 1, e: 1, f: 1 };

  it('잘하는 사람이 한쪽에 몰리지 않는다', () => {
    for (let i = 0; i < 50; i++) {
      const { a, b } = balancedSplit(Object.keys(levels), (n) => levels[n]);
      const sum = (t: string[]) => t.reduce((s, n) => s + levels[n], 0);
      expect(a.length).toBe(3);
      expect(b.length).toBe(3);
      expect(Math.abs(sum(a) - sum(b))).toBeLessThanOrEqual(2);
    }
  });

  it('홀수면 한 명 차이', () => {
    const { a, b } = balancedSplit(['a', 'b', 'c', 'd', 'e'], () => 2);
    expect(Math.abs(a.length - b.length)).toBe(1);
    expect([...a, ...b].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('nextSameSlot', () => {
  it('지난 모임이면 같은 요일·시각의 다음 주로', () => {
    const prev = new Date('2026-11-01T20:00:00+09:00');
    const now = new Date('2026-11-05T12:00:00+09:00');
    expect(nextSameSlot(prev, now).toISOString()).toBe(new Date('2026-11-08T20:00:00+09:00').toISOString());
  });

  it('아직 안 지났으면 그 다음 주', () => {
    const prev = new Date('2026-11-08T20:00:00+09:00');
    const now = new Date('2026-11-05T12:00:00+09:00');
    expect(nextSameSlot(prev, now).toISOString()).toBe(new Date('2026-11-15T20:00:00+09:00').toISOString());
  });
});
