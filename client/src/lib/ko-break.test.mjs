// node src/lib/ko-break.test.mjs
import assert from 'node:assert/strict';
import { koGlue, koLines } from './ko-break.js';

const N = ' ';
assert.equal(koGlue('오늘 세션을 한 단어로 남긴다면?'), `오늘 세션을 한${N}단어로 남긴다면?`);
assert.equal(koGlue('첫 직장을 고른다면 무엇을 가장 크게 볼까요?'), `첫${N}직장을 고른다면 무엇을 가장 크게 볼까요?`);
assert.equal(koGlue('새 상황에 대응하는 능력'), `새${N}상황에 대응하는 능력`);
assert.equal(koGlue('여러 사람이 모였어요'), `여러${N}사람이 모였어요`);
assert.equal(koGlue('그 사람을 떠올려 보세요'), `그${N}사람을 떠올려 보세요`);

// 접착 대상이 없으면 원문 그대로
assert.equal(koGlue('임팩트를 만들고 싶은 영역은 어디에 가까운가요?'), '임팩트를 만들고 싶은 영역은 어디에 가까운가요?');
// 어절 중간에 들어간 같은 글자는 건드리지 않는다
assert.equal(koGlue('한국어 문장'), '한국어 문장');
// 수동 마커
assert.deepEqual(koLines('오늘 세션을 / 한 단어로 남긴다면?'), ['오늘 세션을', `한${N}단어로 남긴다면?`]);
assert.deepEqual(koLines('마커 없음'), ['마커 없음']);
assert.deepEqual(koLines(null), ['']);

console.log('ko-break 테스트 10개 통과');
