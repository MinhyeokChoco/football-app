// 이름 뒤에 붙는 조사를 받침에 맞춰 고른다. "철수가", "민혁이", "강남으로", "잠실로"

function lastSyllable(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  // 한글이 아니면(영어 이름 등) 받침 없는 쪽으로 친다
  return code >= 0 && code <= 11171 ? code % 28 : 0;
}

/** 이/가 */
export const iga = (word: string) => word + (lastSyllable(word) ? '이' : '가');

/** 으로/로. ㄹ 받침은 "로" */
export const euro = (word: string) => {
  const jong = lastSyllable(word);
  return word + (jong && jong !== 8 ? '으로' : '로');
};
