import { ago, daysUntil, fromSeoul, seoulDay, seoulTime } from './time';

describe('time', () => {
  it('한국 시간 입력을 그대로 되돌린다', () => {
    const d = fromSeoul('2026-11-01', '07:30');
    expect(d.toISOString()).toBe('2026-10-31T22:30:00.000Z');
    expect(seoulDay(d)).toBe('2026-11-01');
    expect(seoulTime(d)).toBe('07:30');
  });

  it('한국 날짜 기준으로 며칠 남았는지 센다', () => {
    const now = fromSeoul('2026-11-01', '23:50');
    expect(daysUntil(fromSeoul('2026-11-02', '00:10'), now)).toBe(1);
    expect(daysUntil(fromSeoul('2026-11-01', '00:10'), now)).toBe(0);
  });

  it('지난 시간을 사람 말로', () => {
    const now = Date.now();
    expect(ago(new Date(now - 5_000), now)).toBe('방금');
    expect(ago(new Date(now - 3 * 60_000), now)).toBe('3분 전');
    expect(ago(new Date(now - 2 * 3600_000), now)).toBe('2시간 전');
  });
});
