import { EventInput, FootballEvent } from './models';
import { fromSeoul, seoulDay, seoulTime } from './time';

// 모임 만들기와 경기 정보 수정이 같이 쓰는 폼. 날짜·시간은 한국 시간으로 받는다.
// 비워둘 수 있는 숫자 칸은 null 이다.
export interface EventForm {
  title: string;
  date: string;
  time: string;
  place: string;
  minPeople: number;
  maxPeople: number | null;
  fee: number | null;
  account: string;
}

export const EMPTY_FORM: EventForm = {
  title: '',
  date: '',
  time: '',
  place: '',
  minPeople: 10,
  maxPeople: null,
  fee: null,
  account: '',
};

export function formFrom(e: Pick<FootballEvent, 'title' | 'place' | 'eventAt' | 'minPeople' | 'maxPeople' | 'fee' | 'account'>): EventForm {
  return {
    title: e.title,
    date: seoulDay(e.eventAt),
    time: seoulTime(e.eventAt),
    place: e.place,
    minPeople: e.minPeople,
    maxPeople: e.maxPeople,
    fee: e.fee,
    account: e.account ?? '',
  };
}

/** <input type="number"> 를 비우면 NaN 이 온다 */
export const numberOrNull = (v: number) => (Number.isFinite(v) ? v : null);

/** 폼을 검사해서 저장할 값을, 틀렸으면 고칠 점을 돌려준다 */
export function readForm(f: EventForm): { input: EventInput } | { error: string } {
  const title = f.title.trim();
  const place = f.place.trim();
  const account = f.account.trim();
  const minPeople = Math.round(Number(f.minPeople));
  const maxPeople = f.maxPeople == null ? null : Math.round(f.maxPeople);
  const fee = f.fee == null || f.fee === 0 ? null : Math.round(f.fee);

  if (!title || !place) return { error: '제목이랑 장소를 써줘' };
  if (!f.date || !f.time) return { error: '날짜랑 시간을 골라줘' };
  if (!(minPeople >= 1 && minPeople <= 50)) return { error: '최소 인원은 1~50명 사이로' };
  if (maxPeople != null && !(maxPeople >= minPeople && maxPeople <= 50)) {
    return { error: `정원은 최소 인원(${minPeople}명)부터 50명까지` };
  }
  if (fee != null && !(fee >= 1 && fee <= 1_000_000)) return { error: '회비는 100만 원까지' };
  if (account.length > 60) return { error: '계좌는 60자까지' };

  return {
    input: {
      title,
      place,
      eventAt: fromSeoul(f.date, f.time),
      minPeople,
      maxPeople,
      fee,
      account: fee != null && account ? account : null,
    },
  };
}

export const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
