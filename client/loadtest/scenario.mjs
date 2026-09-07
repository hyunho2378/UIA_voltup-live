// 행사 당일 순서를 한 번에 재현하는 저연결 E2E 하네스.
// 최대 연결: screen 1 + voter 1 + admin HTTP/RPC 클라이언트 1 = 3.
// node loadtest/scenario.mjs --env=.env --allow-prod

import { createClient } from '@supabase/supabase-js';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applySessionAction, resetVotes, SESSION_ID } from '../api/_lib/session-actions.js';
import { acceptsBroadcast, visibleResults } from '../src/lib/screen-state.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/, '').split('=');
  return [key, value.join('=') || 'true'];
}));
const env = Object.fromEntries((await readFile(resolve(process.cwd(), args.env || '.env'), 'utf8'))
  .split(/\r?\n/)
  .map((line) => {
    const index = line.indexOf('=');
    return index > 0 ? [line.slice(0, index), line.slice(index + 1).trim()] : [];
  })
  .filter(([key]) => key));
const URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SECRET = env.SUPABASE_SECRET_KEY;
if (!URL || !KEY || !SECRET) throw new Error('SUPABASE 환경변수가 필요하다.');
if (args['allow-prod'] !== 'true') throw new Error('--allow-prod 가 필요하다.');

const admin = createClient(URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
const screenClient = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const voter = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const timeline = [];
const checks = [];
const tag = `scenario-${Date.now()}`;
let sessionChannel;
let resultChannel;
let qid = null;
let question = null;
let screenResults = null;
let received = 0;
let rejected = 0;

const record = (step, detail = {}) => timeline.push({ at: new Date().toISOString(), step, qid, shown: visibleResults(question, screenResults)?.question_id ?? null, total: visibleResults(question, screenResults)?.total ?? null, ...detail });
const assert = (name, condition, detail = {}) => {
  checks.push({ name, pass: Boolean(condition), ...detail });
  if (!condition) throw new Error(`${name}: ${JSON.stringify(detail)}`);
};
const act = (action, questionId) => applySessionAction(admin, action, questionId);
const results = async (id) => (await admin.rpc('get_results', { q_id: id })).data;
const count = async (id) => (await admin.from('votes').select('*', { count: 'exact', head: true }).eq('question_id', id)).count;
const vote = (questionId, optionId, voterKey, textValue = null) => voter.from('votes').insert({ question_id: questionId, option_id: optionId, text_value: textValue, voter_key: voterKey });

async function switchScreen(nextQid) {
  qid = nextQid;
  question = null;
  screenResults = null;
  record('screen:clear');
  if (resultChannel) await screenClient.removeChannel(resultChannel);
  if (!qid) return;
  resultChannel = screenClient.channel(`results:${qid}`, { config: { private: false } })
    .on('broadcast', { event: 'results' }, ({ payload }) => {
      received += 1;
      if (!acceptsBroadcast(qid, payload)) {
        rejected += 1;
        record('broadcast:rejected');
        return;
      }
      screenResults = payload.results;
      record('broadcast:accepted');
    });
  await new Promise((resolve) => resultChannel.subscribe((status) => status === 'SUBSCRIBED' && resolve()));
  const [questionResponse, resultsResponse] = await Promise.all([
    screenClient.from('questions').select('id, order_no, type, title, options ( id, order_no, label )').eq('id', qid).maybeSingle(),
    screenClient.rpc('get_results', { q_id: qid }),
  ]);
  if (qid === nextQid) {
    question = questionResponse.data;
    screenResults = resultsResponse.data;
    record('screen:fetch');
  }
}

async function startScreen() {
  sessionChannel = screenClient.channel('session')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, ({ new: next }) => {
      // Screen.jsx 의 effect 의존성은 qid 하나다. 투표 열기·결과 공개에는 채널을 갈지 않는다.
      if (next.active_question_id !== qid) switchScreen(next.active_question_id);
    });
  await new Promise((resolve) => sessionChannel.subscribe((status) => status === 'SUBSCRIBED' && resolve()));
  const { data } = await screenClient.from('sessions').select('*').eq('id', SESSION_ID).single();
  await switchScreen(data.active_question_id);
}

async function cleanup() {
  await resetVotes(admin, 'all');
  if (resultChannel) await screenClient.removeChannel(resultChannel);
  if (sessionChannel) await screenClient.removeChannel(sessionChannel);
  await screenClient.removeAllChannels();
  await voter.removeAllChannels();
  screenClient.realtime.disconnect();
  voter.realtime.disconnect();
  const { data: restored } = await admin.from('sessions').select('status, voting_open, results_visible').eq('id', SESSION_ID).single();
  const { count: remaining } = await admin.from('votes').select('*', { count: 'exact', head: true });
  return { restored, remaining };
}

let cleanupResult;
try {
  const { data: questions, error } = await admin.from('questions').select('id, order_no, type, title').order('order_no');
  if (error) throw error;
  const choice = questions.filter((item) => item.type === 'choice');
  const text = questions.find((item) => item.type === 'text');
  if (choice.length < 2 || !text) throw new Error('객관식 2개와 주관식 1개가 필요하다.');
  const [Q1, Q2] = choice;
  const Q3 = text;
  const options = Object.fromEntries(await Promise.all([Q1, Q2].map(async (item) => [item.id, (await admin.from('options').select('id').eq('question_id', item.id).order('order_no')).data])));

  await resetVotes(admin, 'all');
  await startScreen();
  const standby = (await admin.from('sessions').select('*').eq('id', SESSION_ID).single()).data;
  // standby 는 active_question_id 를 지우지 않아도 된다. ScreenView 가 standby 분기로 QR만 렌더해
  // 이전 집계를 숨기므로, 화면 계약은 status 값으로 판정한다.
  assert('1 standby QR, no bars', standby.status === 'standby' && !standby.results_visible, { standby: standby.status, resultsVisible: standby.results_visible });
  record('1 standby');

  await act('set_question', Q1.id); await sleep(700);
  const q1Session = (await admin.from('sessions').select('*').eq('id', SESSION_ID).single()).data;
  assert('2 Q1 consumers and hidden choices', qid === Q1.id && q1Session.voting_open === false && q1Session.results_visible === false && visibleResults(question, screenResults)?.total === 0, { qid, session: q1Session });
  record('2 set Q1');

  await act('open_voting');
  for (let index = 0; index < 15; index += 1) {
    const response = await vote(Q1.id, options[Q1.id][index % options[Q1.id].length].id, `${tag}-q1-${index}`);
    assert(`3 Q1 vote ${index + 1}`, !response.error, { code: response.error?.code });
  }
  await act('show_results'); await sleep(900);
  const q1Db = await count(Q1.id);
  assert('4 show_results flush equals DB', screenResults?.total === q1Db && q1Db === 15, { screen: screenResults?.total, db: q1Db });
  record('4 show Q1');

  await act('close_voting');
  const closed = await vote(Q1.id, options[Q1.id][0].id, `${tag}-closed`);
  assert('5 closed vote is 42501', closed.error?.code === '42501', { code: closed.error?.code });
  assert('5 final Q1 retained', screenResults?.total === 15, { total: screenResults?.total });
  record('5 close Q1');

  await act('set_question', Q2.id); await sleep(900);
  assert('6 Q2 clears Q1 bars immediately', qid === Q2.id && visibleResults(question, screenResults)?.question_id === Q2.id && screenResults?.total === 0, { qid, shown: screenResults?.question_id, total: screenResults?.total });
  await act('open_voting');
  for (let index = 0; index < 4; index += 1) await vote(Q2.id, options[Q2.id][index % options[Q2.id].length].id, `${tag}-q2-${index}`);
  await act('show_results'); await sleep(800);
  assert('6 Q2 results only', screenResults?.question_id === Q2.id && screenResults?.total === 4, { results: screenResults });
  record('6 Q2');

  await act('set_question', Q3.id); await sleep(700); await act('open_voting');
  for (const [index, word] of ['미래', '연결', '미래', '참여', '미래'].entries()) {
    const response = await vote(Q3.id, null, `${tag}-q3-${index}`, word);
    assert(`7 Q3 text vote ${index + 1}`, !response.error, { code: response.error?.code });
  }
  await act('show_results'); await sleep(900);
  assert('7 text frequency and sort', screenResults?.type === 'text' && screenResults?.total === 5 && screenResults?.items?.[0]?.word === '미래' && screenResults?.items?.[0]?.count === 3, { results: screenResults });
  record('7 Q3');

  const reset = await resetVotes(admin, 'question', Q3.id); await sleep(700);
  assert('8 reset Q3 preserves Q1 Q2', reset.status === 200 && (await count(Q3.id)) === 0 && (await count(Q1.id)) === 15 && (await count(Q2.id)) === 4, { reset: reset.status });
  const ordered = questions.slice().sort((a, b) => a.order_no - b.order_no);
  assert('9 last next is disabled/no-op', ordered.at(-1).id === Q3.id && !ordered[ordered.findIndex((item) => item.id === Q3.id) + 1], { last: ordered.at(-1).id });
  await act('standby'); await sleep(400);
  const ended = (await admin.from('sessions').select('*').eq('id', SESSION_ID).single()).data;
  assert('10 standby termination state', ended.status === 'standby' && !ended.voting_open && !ended.results_visible, { ended });
  record('10 standby');

  // 장애 보정: socket 끊긴 사이의 표는 RPC fetch로 복구하고, 늦은 Q2 payload는 Q3에서 거부한다.
  await act('set_question', Q1.id); await act('open_voting'); await sleep(500);
  screenClient.realtime.disconnect();
  await vote(Q1.id, options[Q1.id][0].id, `${tag}-reconnect`);
  screenClient.realtime.connect(); await sleep(900);
  screenResults = await results(Q1.id); record('edge reconnect fetch');
  assert('edge reconnect fetch restores count', screenResults?.total === 16, { total: screenResults?.total });
  await act('set_question', Q2.id); await sleep(600);
  // 강제 단절 중 놓친 session 이벤트도 질문 전환 시의 fetch 경로로 보정한다.
  if (qid !== Q2.id) await switchScreen(Q2.id);
  const late = { results: await results(Q1.id) };
  if (!acceptsBroadcast(qid, late)) rejected += 1;
  assert('edge late broadcast rejected', rejected > 0 && visibleResults(question, screenResults)?.question_id === Q2.id, { rejected, shown: screenResults?.question_id });
} catch (error) {
  checks.push({ name: 'scenario execution', pass: false, error: error.message });
} finally {
  cleanupResult = await cleanup();
}

const report = {
  timestamp: new Date().toISOString(),
  maxConcurrentConnections: 3,
  passed: checks.filter((item) => item.pass).length,
  total: checks.length,
  timeline,
  checks,
  cleanup: cleanupResult,
};
await mkdir(join(HERE, 'reports'), { recursive: true });
await writeFile(join(HERE, 'reports', 'scenario-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ passed: `${report.passed}/${report.total}`, maxConcurrentConnections: report.maxConcurrentConnections, cleanup: cleanupResult }, null, 2));
if (report.passed !== report.total || cleanupResult.remaining !== 0 || cleanupResult.restored?.status !== 'standby' || cleanupResult.restored?.voting_open || cleanupResult.restored?.results_visible) process.exit(1);
