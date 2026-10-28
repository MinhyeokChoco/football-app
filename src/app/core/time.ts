// 날짜·시간은 전부 한국 시간 기준으로 다룬다. Firestore 에는 Timestamp 로 저장한다.

// 날짜 비교는 한국 시간 기준 YYYY-MM-DD 로 한다.
export const seoulDay = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d);

// <input type="time"> 에 넣을 한국 시간 HH:mm
export const seoulTime = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);

// 폼에서 받은 한국 날짜·시간을 Date 로
export const fromSeoul = (date: string, time: string) => new Date(`${date}T${time}:00+09:00`);

// "10월 11일 (토) 오후 7:00" 같은 표시용 문자열
export const whenLabel = (d: Date) =>
  new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);

// 오늘 기준 며칠 남았는지. 지난 날이면 음수
export const daysUntil = (d: Date, now = new Date()) =>
  Math.round((Date.parse(seoulDay(d)) - Date.parse(seoulDay(now))) / 86400000);

export const ddayLabel = (d: Date) => {
  const diff = daysUntil(d);
  return diff === 0 ? 'D-DAY · 오늘 경기' : diff > 0 ? `D-${diff}` : '지난 경기';
};

// 기록 옆에 붙는 "3분 전"
export function ago(d: Date, now = Date.now()) {
  const sec = Math.max(0, Math.round((now - d.getTime()) / 1000));
  if (sec < 60) return '방금';
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  return `${Math.floor(sec / 86400)}일 전`;
}
