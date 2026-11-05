import { Level } from './lineup';

// 이 기기에만 남겨두는 편의용 값. 지워져도 앱은 그대로 동작해야 한다.

const NAME_KEY = 'football:name';
const RECENT_KEY = 'football:recent';
const SKILL_KEY = 'football:skills';
const RECENT_MAX = 8;

export interface RecentEvent {
  id: string;
  title: string;
  eventAt: number; // ms
  host: boolean;
  // "다시 만들기"에 쓰는 값. 예전에 저장된 항목에는 없다
  place?: string;
  minPeople?: number;
  maxPeople?: number | null;
  fee?: number | null;
  account?: string | null;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // 시크릿 모드이거나 저장된 값이 깨졌으면 없는 것으로 친다
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장이 안 돼도 다음에 이름을 한 번 더 쓰면 그만이다
  }
}

// 모임마다 이름을 다시 쓰지 않도록 마지막에 쓴 이름을 기억한다
export const lastName = () => read<string>(NAME_KEY, '');
export const rememberName = (name: string) => write(NAME_KEY, name);

// 홈에서 "최근 모임"으로 다시 들어갈 수 있게. 최근에 본 순서
export const recentEvents = () => read<RecentEvent[]>(RECENT_KEY, []);

export function rememberEvent(e: RecentEvent) {
  const prev = recentEvents().find((r) => r.id === e.id);
  const next = { ...e, host: e.host || !!prev?.host };
  write(RECENT_KEY, [next, ...recentEvents().filter((r) => r.id !== e.id)].slice(0, RECENT_MAX));
}

export function forgetEvent(id: string) {
  write(RECENT_KEY, recentEvents().filter((r) => r.id !== id));
}

// 주최자가 매긴 실력. 남한테 보이면 안 돼서 서버에 안 올리고 이 기기에만 둔다.
// 이름으로 저장하니 다음 모임에도 그대로 쓴다.
export const skills = () => read<Record<string, Level>>(SKILL_KEY, {});

export function rememberSkill(name: string, level: Level | null) {
  const next = { ...skills() };
  if (level == null) delete next[name];
  else next[name] = level;
  write(SKILL_KEY, next);
}
