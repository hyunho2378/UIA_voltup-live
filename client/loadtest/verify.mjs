// 실시간 정합성 자동 검증 하네스.
// 어드민 액션과 청중 투표를 스크립트로 구동하고, /screen 이 실제로 쓰는 판단 함수
// (src/lib/screen-state.js)에 수신 payload 를 그대로 태워 정합성을 assert 한다.
//
//   node loadtest/verify.mjs --url=<test> --key=<publishable> --secret=<secret>
//   node loadtest/verify.mjs --env=.env.test
//
// 반드시 테스트 전용 Supabase 프로젝트로 돌린다. client/.env 의 URL 과 같으면 거부한다(--allow-prod 로만 통과).

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applySessionAction, resetVotes, SESSION_ID } from '../api/_lib/session-actions.js';
import { acceptsBroadcast, visibleResults } from '../src/lib/screen-state.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=') || 'true'];
  }),
);

const readEnv = async (path) => {
  const out = {};
  try {
    for (const line of (await readFile(path, 'utf8')).split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
  } catch {}
  return out;
};

const fileEnv = args.env ? await readEnv(resolve(process.cwd(), args.env)) : {};
const URL = args.url || fileEnv.VITE_SUPABASE_URL || fileEnv.SUPABASE_URL;
const KEY = args.key || fileEnv.VITE_SUPABASE_PUBLISHABLE_KEY;
const SECRET = args.secret || fileEnv.SUPABASE_SECRET_KEY;

if (!URL || !KEY || !SECRET) {
  console.error('필수: --url --key --secret (또는 --env=<파일>). 테스트 전용 프로젝트여야 한다.');
  process.exit(2);
}
const prod = await readEnv(join(HERE, '..', '.env'));
if (prod.VITE_SUPABASE_URL && prod.VITE_SUPABASE_URL === URL && args['allow-prod'] !== 'true') {
  console.error('거부: client/.env 와 같은 프로젝트다. 테스트 전용 프로젝트를 쓰거나 --allow-prod 를 붙여라.');
  process.exit(2);
}

// ── 액터 ────────────────────────────────────────────────────────────────
const clients = [];
const mkClient = () => {
  const c = createClient(URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  clients.push(c);
  return c;
};
const admin = createClient(URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
clients.push(admin);

const act = (action, questionId) => applySessionAction(admin, action, questionId);

/** /screen 액터. Screen.jsx 의 진입/전환/구독 경로를 같은 순서로 재현하고 매 변화를 타임라인에 남긴다. */
class ScreenActor {
  constructor(name = 'screen') {
    this.name = name;
    this.c = mkClient();
    this.timeline = [];
    this.qid = null;
    this.question = null;
    this.results = null;
    this.resultsChannel = null;
    this.rejected = 0;
    this.received = 0;
  }

  mark(tag) {
    const shown = visibleResults(this.question, this.results);
    this.timeline.push({
      t: Date.now(),
      tag,
      activeQid: this.qid,
      shownQid: shown?.question_id ?? null,
      total: shown?.total ?? null,
      stale: Boolean(shown && shown.question_id !== this.qid),
    });
  }

  async start() {
    const ch = this.c
      .channel('session')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, (p) => this.onSession(p.new));
    await new Promise((res) => ch.subscribe((s) => s === 'SUBSCRIBED' && res()));
    this.sessionChannel = ch;
    const { data } = await this.c.from('sessions').select('*').limit(1).maybeSingle();
    await this.onSession(data);
  }

  async onSession(s) {
    this.session = s;
    if (s?.active_question_id !== this.qid) await this.switchTo(s?.active_question_id ?? null);
    else this.mark('session');
  }

  // Screen.jsx 의 useEffect([qid]) 와 같은 순서: 먼저 비우고, 구독을 갈고, 그 다음 보정 fetch.
  async switchTo(qid) {
    this.qid = qid;
    this.question = null;
    this.results = null;
    this.mark('switch:cleared');
    if (this.resultsChannel) {
      await this.c.removeChannel(this.resultsChannel);
      this.resultsChannel = null;
    }
    if (!qid) return;
    this.resultsChannel = this.c
      .channel('results:' + qid, { config: { private: false } })
      .on('broadcast', { event: 'results' }, ({ payload }) => this.onBroadcast(payload));
    await new Promise((res) => this.resultsChannel.subscribe((s) => s === 'SUBSCRIBED' && res()));
    const [q, r] = await Promise.all([
      this.c.from('questions').select('id, order_no, type, title, options ( id, order_no, label )').eq('id', qid).maybeSingle(),
      this.c.rpc('get_results', { q_id: qid }),
    ]);
    if (this.qid !== qid) return; // 그 사이 또 바뀌었으면 버린다
    this.question = q.data;
    this.results = r.data;
    this.mark('switch:fetched');
  }

  /** 앱과 같은 가드를 태운다. 하네스가 따로 판단하지 않는다. */
  onBroadcast(payload) {
    this.received++;
    if (!acceptsBroadcast(this.qid, payload)) {
      this.rejected++;
      this.mark('broadcast:rejected');
      return;
    }
    this.results = payload.results;
    this.mark('broadcast:accepted');
  }

  async reconnect() {
    this.c.realtime.disconnect();
    this.mark('disconnected');
    await sleep(1200);
    this.c.realtime.connect();
    await sleep(1200);
    // Screen.jsx 의 재진입 보정 경로: 구독만으로 상태를 만들지 않고 RPC 로 다시 맞춘다.
    const { data } = await this.c.rpc('get_results', { q_id: this.qid });
    this.results = data;
    this.mark('reconnected:refetched');
  }

  get staleFrames() {
    return this.timeline.filter((f) => f.stale);
  }
}

const TAG = 'verify-' + Date.now();
const voteAs = (c, questionId, optionId, key) =>
  c.from('votes').insert({ question_id: questionId, option_id: optionId, voter_key: key });

// ── 케이스 ──────────────────────────────────────────────────────────────
const results = [];
let Q1, Q2, O1, O2;

async function setup() {
  const { data: qs, error } = await admin.from('questions').select('id, order_no, type').eq('type', 'choice').order('order_no');
  if (error) throw error;
  if (!qs || qs.length < 2) throw new Error('객관식 질문이 2개 이상 필요하다. seed.sql 을 먼저 적용해라.');
  [Q1, Q2] = qs;
  O1 = (await admin.from('options').select('id').eq('question_id', Q1.id).order('order_no')).data;
  O2 = (await admin.from('options').select('id').eq('question_id', Q2.id).order('order_no')).data;
}

async function clean() {
  await admin.from('votes').delete().not('id', 'is', null);
  await admin.from('sessions').update({ status: 'standby', voting_open: false, results_visible: false }).eq('id', SESSION_ID);
}

async function run(name, fn) {
  await clean();
  const detail = {};
  let pass = false;
  let err = null;
  try {
    pass = (await fn(detail)) !== false;
  } catch (e) {
    err = e.message;
  }
  results.push({ name, pass: pass && !err, error: err, ...detail });
  console.log(`${pass && !err ? 'PASS' : 'FAIL'}  ${name}${err ? '  ' + err : ''}`);
  console.log('      ' + JSON.stringify(detail));
}

// 1. 전환 정합성
await setup();
await run('1 전환 정합성: Q2 활성 이후 Q1 집계가 그려진 프레임 0', async (d) => {
  const screen = new ScreenActor();
  await act('set_question', Q1.id);
  await act('open_voting');
  await screen.start();
  const voters = [mkClient(), mkClient(), mkClient()];
  const errs = [];
  for (let i = 0; i < 3; i++) {
    const { error } = await voteAs(voters[i], Q1.id, O1[i % O1.length].id, `${TAG}-a${i}`);
    if (error) errs.push(error.code);
  }
  d.투표오류 = errs;
  d.DB행 = (await admin.from('votes').select('id').eq('question_id', Q1.id)).data.length;
  // 3표가 250ms 병합 창에 몰려도 결과 공개 시점엔 정확해야 한다(show_results 가 flush 한다).
  await act('show_results');
  await sleep(1500);
  d.q1총계 = screen.timeline.at(-1)?.total;
  await act('set_question', Q2.id);
  await sleep(2500);
  d.프레임수 = screen.timeline.length;
  d.stale프레임 = screen.staleFrames.length;
  d.타임라인 = screen.timeline.map((f) => `${f.tag}:${f.shownQid ? f.shownQid.slice(-1) : '-'}/${f.activeQid?.slice(-1) ?? '-'}`);
  return d.DB행 === 3 && d.q1총계 === 3 && d.stale프레임 === 0;
});

// 2. 늦은 broadcast (question_id 가드)
await run('2 늦은 broadcast: Q1 payload 를 Q2 상태에서 거부', async (d) => {
  const screen = new ScreenActor();
  await act('set_question', Q1.id);
  await act('open_voting');
  await screen.start();
  const v = mkClient();
  await voteAs(v, Q1.id, O1[0].id, `${TAG}-b0`);
  await sleep(800);
  const q1Payload = { results: await (await admin.rpc('get_results', { q_id: Q1.id })).data, live_count: 1 };
  await act('set_question', Q2.id);
  await sleep(1200);
  const before = { ...screen.timeline.at(-1) };
  // 채널 정리 타이밍에 의존하지 않도록 지연 payload 를 직접 주입한다.
  screen.onBroadcast(q1Payload);
  d.거부수 = screen.rejected;
  d.주입후shownQid = screen.timeline.at(-1).shownQid;
  d.stale프레임 = screen.staleFrames.length;
  return screen.rejected === 1 && d.stale프레임 === 0 && before.activeQid === Q2.id;
});

// 3. 초기화
await run('3 초기화: 질문 단위 / 전체', async (d) => {
  const screen = new ScreenActor();
  await act('set_question', Q1.id);
  await act('open_voting');
  await screen.start();
  const v = [mkClient(), mkClient()];
  await voteAs(v[0], Q1.id, O1[0].id, `${TAG}-c0`);
  await act('set_question', Q2.id);
  await act('open_voting');
  await voteAs(v[1], Q2.id, O2[0].id, `${TAG}-c1`);
  await act('set_question', Q1.id);
  await sleep(1200);

  let final = null;
  const probe = mkClient();
  const ch = probe.channel('results:' + Q1.id, { config: { private: false } })
    .on('broadcast', { event: 'results' }, ({ payload }) => payload?.final && (final = payload));
  await new Promise((res) => ch.subscribe((s) => s === 'SUBSCRIBED' && res()));

  const r1 = await resetVotes(admin, 'question', Q1.id);
  await sleep(1500);
  d.질문초기화status = r1.status;
  d.final수신 = Boolean(final);
  d.final총계 = final?.results?.total ?? null;
  d.Q1행 = (await admin.from('votes').select('id').eq('question_id', Q1.id)).data.length;
  d.Q2행보존 = (await admin.from('votes').select('id').eq('question_id', Q2.id)).data.length;

  const r2 = await resetVotes(admin, 'all');
  await sleep(500);
  const s = (await admin.from('sessions').select('*').single()).data;
  d.전체초기화status = r2.status;
  d.전체행 = (await admin.from('votes').select('id')).data.length;
  d.세션 = s.status;
  await probe.removeChannel(ch);
  return d.질문초기화status === 200 && d.final수신 && d.final총계 === 0 && d.Q1행 === 0 && d.Q2행보존 === 1
    && d.전체초기화status === 200 && d.전체행 === 0 && d.세션 === 'standby';
});

// 4. 중복
await run('4 중복: 같은 질문 재투표 23505, 다른 질문은 허용', async (d) => {
  const v = mkClient();
  const key = `${TAG}-d0`;
  await act('set_question', Q1.id);
  await act('open_voting');
  d.첫투표 = (await voteAs(v, Q1.id, O1[0].id, key)).error?.code ?? 'ok';
  d.재투표 = (await voteAs(v, Q1.id, O1[1].id, key)).error?.code ?? 'ok';
  await act('set_question', Q2.id);
  await act('open_voting');
  d.다른질문 = (await voteAs(v, Q2.id, O2[0].id, key)).error?.code ?? 'ok';
  return d.첫투표 === 'ok' && d.재투표 === '23505' && d.다른질문 === 'ok';
});

// 5. 마감
await run('5 마감: close_voting 후 42501, final 1회 발사', async (d) => {
  let finals = 0;
  const probe = mkClient();
  await act('set_question', Q1.id);
  await act('open_voting');
  const ch = probe.channel('results:' + Q1.id, { config: { private: false } })
    .on('broadcast', { event: 'results' }, ({ payload }) => payload?.final && finals++);
  await new Promise((res) => ch.subscribe((s) => s === 'SUBSCRIBED' && res()));
  const v = mkClient();
  d.열림투표 = (await voteAs(v, Q1.id, O1[0].id, `${TAG}-e0`)).error?.code ?? 'ok';
  await sleep(400);
  await act('close_voting');
  await sleep(1500);
  d.마감후투표 = (await voteAs(mkClient(), Q1.id, O1[0].id, `${TAG}-e1`)).error?.code ?? 'ok';
  d.final발사 = finals;
  await probe.removeChannel(ch);
  return d.열림투표 === 'ok' && d.마감후투표 === '42501' && finals === 1;
});

// 6. 재연결 보정
await run('6 재연결: 끊긴 사이 들어온 표가 재진입 fetch 로 반영', async (d) => {
  const screen = new ScreenActor();
  await act('set_question', Q1.id);
  await act('open_voting');
  await screen.start();
  await voteAs(mkClient(), Q1.id, O1[0].id, `${TAG}-f0`);
  await sleep(1000);
  d.끊기전 = screen.timeline.at(-1).total;
  screen.c.realtime.disconnect();
  for (let i = 1; i <= 3; i++) await voteAs(mkClient(), Q1.id, O1[i % O1.length].id, `${TAG}-f${i}`);
  await sleep(600);
  await screen.reconnect();
  d.재연결후 = screen.timeline.at(-1).total;
  d.stale프레임 = screen.staleFrames.length;
  return d.끊기전 === 1 && d.재연결후 === 4 && d.stale프레임 === 0;
});

// 7. 유실 관측
await run('7 유실 관측: 단건 투표 20회 broadcast 수신률', async (d) => {
  const screen = new ScreenActor();
  await act('set_question', Q1.id);
  await act('open_voting');
  await screen.start();
  const N = 20;
  const miss = [];
  for (let i = 0; i < N; i++) {
    const before = screen.received;
    await voteAs(mkClient(), Q1.id, O1[i % O1.length].id, `${TAG}-g${i}-${randomUUID()}`);
    await sleep(600); // 250ms 병합 창을 넘겨 매 표가 개별 발사되게 한다
    if (screen.received === before) miss.push(i);
  }
  d.시도 = N;
  d.수신 = screen.received;
  d.유실회차 = miss;
  d.수신률 = `${Math.round((screen.received / N) * 100)}%`;
  d.최종총계 = screen.timeline.at(-1).total;
  d.stale프레임 = screen.staleFrames.length;
  return miss.length === 0 && d.최종총계 === N;
});

// ── 정리 + 리포트 ───────────────────────────────────────────────────────
await clean();
let open = 0;
for (const c of clients) {
  open += c.getChannels().length;
  await c.removeAllChannels();
  c.realtime.disconnect();
}
const passed = results.filter((r) => r.pass).length;
const report = {
  ts: new Date().toISOString(),
  url: URL.replace(/https:\/\/([^.]{4}).*/, 'https://$1***'),
  통과: `${passed}/${results.length}`,
  클라이언트수: clients.length,
  정리전열린채널: open,
  cases: results,
};
await mkdir(join(HERE, 'reports'), { recursive: true });
await writeFile(join(HERE, 'reports', 'verify-report.json'), JSON.stringify(report, null, 2));
console.log(`\n${passed}/${results.length} 통과 · 클라이언트 ${clients.length}개 정리 · 리포트 loadtest/reports/verify-report.json`);
process.exit(passed === results.length ? 0 : 1);
