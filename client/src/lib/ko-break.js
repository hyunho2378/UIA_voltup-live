// 한국어 줄바꿈 보정. 문자열만 다룬다(innerHTML 없음).
//
// 1) 접착: 단음절 관형사와 수관형사는 뒤 어절과 떨어지면 안 읽힌다.
//    "오늘 세션을 한 단어로" 가 "한 / 단어로" 로 갈리는 걸 막는다. 뒤 공백을 NBSP 로 바꾼다.
// 2) 수동 마커: 원문에 " / " 가 있으면 그 자리에서 줄을 강제로 나눈다.
//    9/9~10 실문안이 오면 SOURCE.md 에서 편집자가 직접 지정할 수 있다.

const GLUE = ['한', '두', '세', '네', '첫', '새', '그', '이', '저', '온', '각', '매',
  '여러', '모든', '어느', '무슨', '어떤', '다른', '같은'];

const NBSP = ' ';
const RE = new RegExp(`(^|\\s)(${GLUE.join('|')})\\s+`, 'g');

export function koGlue(text) {
  return String(text ?? '').replace(RE, (_, pre, word) => `${pre}${word}${NBSP}`);
}

// 마커로 먼저 자르고 조각마다 접착한다. 순서를 바꾸면 마커 앞 관형사가 마커를 삼킨다.
export function koLines(text) {
  return String(text ?? '')
    .split(' / ')
    .map(koGlue);
}
