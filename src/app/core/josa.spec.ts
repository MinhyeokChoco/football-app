import { euro, iga } from './josa';

describe('josa', () => {
  it('이/가', () => {
    expect(iga('민혁')).toBe('민혁이');
    expect(iga('철수')).toBe('철수가');
    expect(iga('Tom')).toBe('Tom가');
  });

  it('으로/로', () => {
    expect(euro('강남 풋살파크')).toBe('강남 풋살파크로');
    expect(euro('잠실')).toBe('잠실로');
    expect(euro('2구장')).toBe('2구장으로');
  });
});
