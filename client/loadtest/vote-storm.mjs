// 가상 청중 N명을 띄워 동시 투표 부하를 재현하고 무료 티어 한도에 어디서 걸리는지 숫자로 뽑는다.
// 반드시 테스트용 Supabase 프로젝트나 리허설 시간대에만 돌린다. 실제 연결과 메시지를 소모한다.
//
// 예: node loadtest/vote-storm.mjs --n=100 --qid=<uuid> --optionIds=a,b,c

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=')];
  }),
);

// .env 폴백
let env = {};
try {
  for (const line of (await readFile(join(HERE, '..', '.env'), 'utf8')).split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
} catch {}

const URL = args.url || env.VITE_SUPABASE_URL;
const KEY = args.key || env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SECRET = args.secret || env.SUPABASE_SECRET_KEY;
const QID = args.qid;
const OPTIONS = (args.optionIds || '').split(',').filter(Boolean);
const N = Number(args.n || 100);
const RAMP = Number(args.rampMs || 3000);
const VOTERS_WATCH_RESULTS = args.subscribeResults !== 'false';
const CLEANUP = args.cleanup !== 'false';
const TAG = `loadtest-${Date.now()}`;

if (!URL || !KEY || !QID) {
  console.error('필수 인자 없음: --url --key --qid (url/key 는 client/.env 에서 자동으로 읽는다)');
  process.exit(1);
}

const errors = new Map();
const noteError = (s) => {
  if (!s) return;
  const key = String(s).slice(0, 120);
  errors.set(key, (errors.get(key) || 0) + 1);
};

// ── 관측자 1명: 서버가 실제로 쏘는 broadcast 비율을 잰다(투표자 수와 무관).
const observer = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const bcTimes = [];
let firstBroadcastAt = null;
let finalSeen = false;
const obsChannel = observer
  .channel(`results:${QID}`, { config: { private: false } })
  .on('broadcast', { event: 'results' }, ({ payload }) => {
    bcTimes.push(Date.now());
    if (firstBroadcastAt === null) firstBroadcastAt = Date.now();
    if (payload?.final) finalSeen = true;
  });
let observerStatus = 'TIMEOUT';
await new Promise((res) => {
  const t = setTimeout(res, 8000);
  obsChannel.subscribe((s, err) => {
    observerStatus = s;
    if (err) noteError(`observer: ${err.message}`);
    if (s === 'SUBSCRIBED') { clearTimeout(t); res(); }
  });
});
console.log('observer:', observerStatus);

// ── 가상 청중 N명
console.log(`clients=${N} ramp=${RAMP}ms voters watch results=${VOTERS_WATCH_RESULTS}`);
const clients = [];

// 중간에 죽으면 N개 소켓이 서버 타임아웃(수십 초)까지 연결 슬롯을 붙잡는다.
// 무료 티어 200 연결에서 이건 다음 실행까지 번진다. 어떤 경로로 끝나든 반드시 닫는다.
let closed = false;
async function closeAll() {
  if (closed) return;
  closed = true;
  for (const c of [...clients, observer]) {
    try { await c.removeAllChannels(); c.realtime.disconnect(); } catch {}
  }
}
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => { console.log(`\n${sig} 수신. 연결 정리 후 종료한다.`); await closeAll(); process.exit(130); });
}
process.on('uncaughtException', async (e) => { console.error(e); await closeAll(); process.exit(1); });
let subscribed = 0;
const joinStart = Date.now();

await Promise.all(
  Array.from({ length: N }, async (_, i) => {
    const c = createClient(URL, KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 10 } },
    });
    clients.push(c);
    const chans = [c.channel(`session-${i}`, { config: { private: false } })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => {})];
    if (VOTERS_WATCH_RESULTS) {
      chans.push(c.channel(`results:${QID}`, { config: { private: false } }).on('broadcast', { event: 'results' }, () => {}));
    }
    await Promise.all(
      chans.map(
        (ch) =>
          new Promise((res) => {
            let done = false;
            ch.subscribe((status, err) => {
              if (err) noteError(err.message);
              if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') noteError(`status:${status}`);
              if (!done && status === 'SUBSCRIBED') { done = true; subscribed++; res(); }
            });
            setTimeout(() => { if (!done) { done = true; res(); } }, 15000);
          }),
      ),
    );
  }),
);
const joinMs = Date.now() - joinStart;
console.log(`SUBSCRIBED ${subscribed} / ${VOTERS_WATCH_RESULTS ? N * 2 : N} 채널  (${joinMs}ms)`);

// ── 투표 폭풍
const lat = [];
const insert = { ok: 0, duplicate: 0, closed: 0, other: 0 };
const voteStart = Date.now();

await Promise.all(
  clients.map(async (c, i) => {
    await sleep(Math.random() * RAMP);
    const t0 = Date.now();
    const { error } = await c.from('votes').insert({
      question_id: QID,
      option_id: OPTIONS.length ? OPTIONS[i % OPTIONS.length] : null,
      text_value: OPTIONS.length ? null : `w${i % 20}`,
      voter_key: `${TAG}-${randomUUID()}`,
    });
    lat.push(Date.now() - t0);
    if (!error) insert.ok++;
    else if (error.code === '23505') insert.duplicate++;
    else if (error.code === '42501') insert.closed++;
    else { insert.other++; noteError(`${error.code} ${error.message}`); }
  }),
);
const voteMs = Date.now() - voteStart;

// broadcast 가 늦게 오는 것까지 받는다
await sleep(4000);

const sorted = [...lat].sort((a, b) => a - b);
const p = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
const perSecond = {};
for (const t of bcTimes) {
  const s = Math.floor((t - voteStart) / 1000);
  perSecond[s] = (perSecond[s] || 0) + 1;
}
const maxPerSecond = Math.max(0, ...Object.values(perSecond));

const report = {
  ts: new Date().toISOString(),
  n: N,
  rampMs: RAMP,
  votersWatchResults: VOTERS_WATCH_RESULTS,
  channels: { target: VOTERS_WATCH_RESULTS ? N * 2 : N, subscribed, joinMs },
  insert: { ...insert,총: N, 평균ms: Math.round(lat.reduce((a, b) => a + b, 0) / (lat.length || 1)), p95ms: p(0.95), 전체소요ms: voteMs },
  broadcast: {
    수신: bcTimes.length,
    첫수신지연ms: firstBroadcastAt ? firstBroadcastAt - voteStart : null,
    초당최대: maxPerSecond,
    초별: perSecond,
    final수신: finalSeen,
    observer구독: observerStatus,
  },
  errors: Object.fromEntries(errors),
};

console.log(JSON.stringify(report, null, 1));
await mkdir(join(HERE, 'reports'), { recursive: true });
const out = join(HERE, 'reports', `report-${N}-${Date.now()}.json`);
await writeFile(out, JSON.stringify(report, null, 2));
console.log('리포트:', out);

// ── 정리
await closeAll();

if (CLEANUP && SECRET) {
  const admin = createClient(URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.from('votes').delete().like('voter_key', `${TAG}-%`);
  console.log(error ? `투표 정리 실패: ${error.message}` : `투표 정리 완료(${TAG})`);
  admin.realtime.disconnect();
} else if (CLEANUP) {
  console.log(`정리 건너뜀(SUPABASE_SECRET_KEY 없음). voter_key LIKE '${TAG}-%' 를 직접 지워라.`);
}

process.exit(0);
