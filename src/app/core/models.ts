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
  /** 주최자가 나눠서 모두에게 보여주는 팀. 없으면 null */
  teams: Teams | null;
}

export interface Attendee {
  /** 문서 id 가 이름이다 */
  name: string;
  status: RsvpStatus;
  uid: string;
  createdAt: Date;
}

export type ActivityKind = 'join' | 'change' | 'cancel' | 'remove' | 'place' | 'time' | 'teams';

export interface Activity {
  id: string;
  kind: ActivityKind;
  name?: string;
  status?: RsvpStatus;
  place?: string;
  at: Date;
}

// 모임 만들기·수정 폼에서 넘기는 값
export interface EventInput {
  title: string;
  place: string;
  eventAt: Date;
  minPeople: number;
}
