export type RsvpStatus = 'YES' | 'NO';

export interface Teams {
  a: string[];
  b: string[];
  at: Date;
}

export interface FootballEvent {
  id: string;
  title: string;
  place: string;
  eventAt: Date;
  minPeople: number;
  /** 정원. 넘치면 대기 명단으로 간다. 없으면 null */
  maxPeople: number | null;
  /** 1인 회비(원). 안 받으면 null */
  fee: number | null;
  account: string | null;
  /** 주최자가 마감하면 명단을 더 못 바꾼다 */
  closed: boolean;
  /** 주최자가 나눠서 모두에게 보여주는 팀. 없으면 null */
  teams: Teams | null;
}

export interface Attendee {
  /** 문서 id 가 이름이다 */
  name: string;
  status: RsvpStatus;
  uid: string;
  /** 같이 데려오는 친구 수 */
  guests: number;
  /** 회비 냈는지. 주최자만 바꾼다 */
  paid: boolean;
  createdAt: Date;
  /** 마지막으로 참석/불참을 누른 시각. 정원이 찼을 때 이 순서로 줄을 선다 */
  updatedAt: Date;
}

export type ActivityKind =
  | 'join'
  | 'change'
  | 'cancel'
  | 'remove'
  | 'guests'
  | 'close'
  | 'place'
  | 'time'
  | 'teams';

export interface Activity {
  id: string;
  kind: ActivityKind;
  name?: string;
  status?: RsvpStatus;
  guests?: number;
  closed?: boolean;
  place?: string;
  at: Date;
}

// 모임 만들기·수정 폼에서 넘기는 값
export interface EventInput {
  title: string;
  place: string;
  eventAt: Date;
  minPeople: number;
  maxPeople: number | null;
  fee: number | null;
  account: string | null;
}
