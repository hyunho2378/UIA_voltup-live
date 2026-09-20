// 행사 전체 흐름 시뮬레이션. 관리자 1 + 대형화면 1 + 청중 4 를 실제 브라우저로 동시에 띄운다.
// 앱 코드가 아니라 검증 하네스다. 실행 경로는 프로덕션 빌드(vite preview) + 실제 /api 핸들러(sim-server.mjs).
//   node scripts/sim-server.mjs  와  vite preview --port 4173  이 먼저 떠 있어야 한다.
// 사용: node scripts/full-simulation.mjs [--section=1,2,3]

import { chromium, devices } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5199';
const ART = resolve(process.cwd(), 'test-artifacts/simulation');
const SESSION_ID = '00000000-0000-0000-0000-000000000001';
const sections = (process.argv.find((a) => a.startsWith('--section=')) || '--section=1,2,3')
  .split('=')[1]
  .split(',');

const env = Object.fromEntries(
  (await readFile('.env', 'utf8'))
    .split(/\r?\n/)
    .map((line) => {
      const i = line.indexOf('=');
      return i > 0 && !line.trim().startsWith('#') ? [line.slice(0, i).trim(), line.slice(i + 1).trim()] : [];
    })
    .filter(([k]) => k),
);
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const REST = { url: env.VITE_SUPABASE_URL, key: env.VITE_SUPABASE_PUBLISHABLE_KEY };

await mkdir(ART, { recursive: true });

const report = {
  startedAt: new Date().toISOString(),
  baseURL: BASE,
  mode: 'prod-build + real /api handlers (vercel dev 대체 하네스)',
  steps: [],
  latency: {},
  consoleErrors: [],
  pageErrors: [],
  defects: [],
  notes: [],
  maxConcurrentContexts: 0,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s ?? '').replace(/[\s\u200b\u2060\ufeff\u00a0]/g, '');

let openContexts = 0;
const trackOpen = (n = 1) => {
  openContexts += n;
  report.maxConcurrentContexts = Math.max(report.maxConcurrentContexts, openContexts);
};

// 예상된 실패(중복 409, 마감 401/403, 인증 401)는 따로 표시한다. 그 외 콘솔 에러는 전부 결함 후보다.
const EXPECTED = /status of (401|403|409)\b/;
function listen(page, name) {
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    report.consoleErrors.push({ page: name, text, expected: EXPECTED.test(text) });
  });
  page.on('pageerror', (e) => report.pageErrors.push({ page: name, text: String(e?.message || e) }));
}

let current = null;
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  current.checks.push(msg);
}
async function step(id, title, fn) {
  current = { id, title, status: 'PASS', checks: [], notes: [], ms: 0 };
  const t0 = Date.now();
  try {
    await fn();
  } catch (error) {
    current.status = 'FAIL';
    current.error = String(error?.message || error);
  }
  current.ms = Date.now() - t0;
  report.steps.push(current);
  console.log(`${current.status === 'PASS' ? 'PASS' : 'FAIL'} ${id} ${title}${current.error ? ' :: ' + current.error : ''}`);
  return current;
}
const note = (t) => current.notes.push(t);

async function until(fn, { timeout = 12000, interval = 60, label = '' } = {}) {
  const t0 = Date.now();
  for (;;) {
    let v;
    try {
      v = await fn();
    } catch {
      v = false;
    }
    if (v) return Date.now() - t0;
    if (Date.now() - t0 > timeout) throw new Error(`대기 초과(${timeout}ms): ${label}`);
    await sleep(interval);
  }
}

// ── DB 원장 ──
const countAll = async () => (await db.from('votes').select('*', { count: 'exact', head: true })).count;
const countQ = async (qid) =>
  (await db.from('votes').select('*', { count: 'exact', head: true }).eq('question_id', qid)).count;
const rowsQ = async (qid) => (await db.from('votes').select('option_id, text_value, voter_key').eq('question_id', qid)).data ?? [];
const sessionRow = async () => (await db.from('sessions').select('*').eq('id', SESSION_ID).maybeSingle()).data;

// ── 화면 판독 ──
const readScreen = (p) =>
  p.evaluate(() => {
    const text = document.body.innerText;
    const votes = [...text.matchAll(/(\d+)표/g)].map((m) => Number(m[1]));
    const live = text.match(/(\d+)명 참여/);
    return {
      h1: document.querySelector('h1')?.innerText ?? '',
      bars: document.querySelectorAll('.bar-fill').length,
      cloud: [...document.querySelectorAll('.cloud-word')].map((e) => e.textContent.trim()),
      votes,
      sum: votes.reduce((a, b) => a + b, 0),
      live: live ? Number(live[1]) : null,
      qr: document.querySelectorAll('canvas').length,
      rootChildren: document.getElementById('root')?.childElementCount ?? 0,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      text,
    };
  });

const readVote = (p) =>
  p.evaluate(() => {
    const submit = [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === '투표하기');
    const style = submit ? getComputedStyle(submit) : null;
    return {
      h1: document.querySelector('h1')?.innerText ?? '',
      options: [...document.querySelectorAll('ul button')].map((b) => b.innerText.trim()),
      hasInput: Boolean(document.querySelector('input[placeholder="한 단어로"]')),
      inputLen: document.querySelector('input[placeholder="한 단어로"]')?.value.length ?? null,
      submitVisible: Boolean(submit && style.visibility !== 'hidden' && style.pointerEvents !== 'none'),
      rootChildren: document.getElementById('root')?.childElementCount ?? 0,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      text: document.body.innerText,
    };
  });

const shot = async (name, pages) => {
  await sleep(450); // enter/bar 애니메이션이 끝난 상태를 남긴다
  await Promise.all(
    Object.entries(pages).map(([role, p]) => p.screenshot({ path: `${ART}/${name}-${role}.png`, fullPage: true })),
  );
};

// 브라우저 안에서 앱과 동일한 REST 경로로 투표를 쏜다(submitVote 와 같은 요청).
const rawVote = (page, payloads) =>
  page.evaluate(
    async ({ url, key, list }) => {
      const post = (row) =>
        fetch(`${url}/rest/v1/votes`, {
          method: 'POST',
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify(row),
        }).then(async (r) => ({ status: r.status, body: (await r.text()).slice(0, 200) }));
      return Promise.all(list.map(post));
    },
    { url: REST.url, key: REST.key, list: payloads },
  );

const apiControl = (page, payload) =>
  page.evaluate(async (body) => {
    const t0 = performance.now();
    const r = await fetch('/api/session-control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    let json = null;
    try {
      json = await r.json();
    } catch {
      json = null;
    }
    return { status: r.status, json, ms: Math.round(performance.now() - t0) };
  }, payload);

// ── 브라우저 기동 ──
const browser = await chromium.launch({ headless: true });
const contexts = [];
async function newContext(options) {
  const ctx = await browser.newContext(options);
  contexts.push(ctx);
  trackOpen(1);
  return ctx;
}

const { data: questions } = await db
  .from('questions')
  .select('id, order_no, type, title, options(id, order_no, label)')
  .order('order_no');
const Q = questions.map((q) => ({ ...q, options: [...(q.options ?? [])].sort((a, b) => a.order_no - b.order_no) }));
const Q1 = Q.find((q) => q.order_no === 1);
const Q2 = Q.find((q) => q.order_no === 2);
const Q3 = Q.find((q) => q.type === 'text');

const adminCtx = await newContext({ viewport: { width: 1280, height: 800 } });
const screenCtx = await newContext({ viewport: { width: 1920, height: 1080 } });
const voterCtxs = [];
for (let i = 0; i < 4; i++) voterCtxs.push(await newContext({ ...devices['iPhone 13'] }));

const admin = await adminCtx.newPage();
const screen = await screenCtx.newPage();
const voters = [];
for (const c of voterCtxs) voters.push(await c.newPage());

listen(admin, 'admin');
listen(screen, 'screen');
voters.forEach((p, i) => listen(p, `voter${i + 1}`));

const adminBtn = (name, exact = true) => admin.getByRole('button', { name, exact });
const clickAdmin = async (name, exact = true) => {
  await adminBtn(name, exact).click();
};
const voteOptions = (p) => p.locator('ul button');
const submitBtn = (p) => p.getByRole('button', { name: '투표하기' });

const openVoteAll = () => Promise.all(voters.map((p) => p.goto(`${BASE}/vote`)));

try {
  // ── 준비: 어드민 실제 로그인 ──
  await step('P1', '어드민 실제 패스코드 로그인(/admin/login → /admin)', async () => {
    await admin.goto(`${BASE}/admin/login`);
    await admin.locator('input[type="password"]').waitFor({ state: 'visible', timeout: 10000 });
    await shot('P1-admin-login', { admin });
    await admin.locator('input[type="password"]').fill(env.ADMIN_PASSCODE);
    await clickAdmin('들어가기');
    await admin.getByRole('button', { name: '대기 화면' }).waitFor({ state: 'visible', timeout: 10000 });
    assert(admin.url().endsWith('/admin'), '/admin 진입');
    const list = await admin.locator('button[aria-current]').count();
    assert(list === Q.length, `질문 리스트 ${Q.length}개 렌더`);
  });

  await step('P2', '대형화면·청중 4명 접속', async () => {
    await Promise.all([screen.goto(`${BASE}/screen`), openVoteAll()]);
    const s = await readScreen(screen);
    assert(s.rootChildren > 0, '대형화면 렌더(흰 화면 아님)');
    for (let i = 0; i < 4; i++) {
      const v = await readVote(voters[i]);
      assert(v.rootChildren > 0, `voter${i + 1} 렌더`);
    }
  });

  // ══════════════ 섹션 1 ══════════════
  if (sections.includes('1')) {
    await step('S1', 'standby: 대형화면 QR, 청중 대기', async () => {
      const r = await apiControl(admin, { action: 'reset', scope: 'all' });
      assert(r.status === 200, `전체 초기화 200 (실제 ${r.status})`);
      await until(async () => (await readScreen(screen)).qr > 0, { label: 'QR 표시' });
      const s = await readScreen(screen);
      assert(s.bars === 0 && s.cloud.length === 0, '대기 화면에 결과 없음');
      for (let i = 0; i < 4; i++) {
        const v = await readVote(voters[i]);
        assert(v.options.length === 0 && !v.submitVisible, `voter${i + 1} 대기(선택지·버튼 없음)`);
      }
      assert((await countAll()) === 0, 'votes 0행');
      await shot('S1-standby', { admin, screen, voter1: voters[0] });
    });

    await step('S2', 'set_question(Q1): 질문만, 막대 없음', async () => {
      await clickAdmin(Q1.title, false);
      await until(async () => norm((await readScreen(screen)).h1) === norm(Q1.title), { label: '대형화면 Q1' });
      const s = await readScreen(screen);
      assert(s.bars === 0, '대형화면 막대 없음');
      assert(s.qr === 0, 'standby QR 해제');
      for (let i = 0; i < 4; i++) {
        const v = await readVote(voters[i]);
        assert(norm(v.h1) === norm(Q1.title), `voter${i + 1} Q1 표시`);
        assert(v.options.length === 0, `voter${i + 1} 선택지 없음`);
      }
      await shot('S2-question', { admin, screen, voter1: voters[0] });
    });

    await step('S3', 'open_voting: 청중 4명 새로고침 없이 선택지 등장', async () => {
      const t0 = Date.now();
      await clickAdmin('투표 열기');
      const ms = await Promise.all(
        voters.map((p) =>
          until(async () => (await voteOptions(p).count()) === Q1.options.length, { label: '선택지 등장' }).then(
            () => Date.now() - t0,
          ),
        ),
      );
      report.latency.openVotingToVoters = { perVoter: ms, max: Math.max(...ms), min: Math.min(...ms) };
      note(`open_voting → 선택지 표시 지연 ${ms.join('/')}ms`);
      for (let i = 0; i < 4; i++) {
        const v = await readVote(voters[i]);
        assert(v.options.length === Q1.options.length, `voter${i + 1} 선택지 ${Q1.options.length}개`);
      }
      await shot('S3-open', { admin, screen, voter1: voters[0], voter4: voters[3] });
    });

    await step('S4', 'voter1 A / voter2 B 투표 후 voter1 재투표 차단', async () => {
      await voteOptions(voters[0]).nth(0).click();
      await submitBtn(voters[0]).click();
      await until(async () => (await readVote(voters[0])).text.includes('투표했어요'), { label: 'voter1 완료' });
      await voteOptions(voters[1]).nth(1).click();
      await submitBtn(voters[1]).click();
      await until(async () => (await readVote(voters[1])).text.includes('투표했어요'), { label: 'voter2 완료' });
      assert((await countQ(Q1.id)) === 2, 'DB 2행');

      await voters[0].reload();
      await until(async () => (await voteOptions(voters[0]).count()) > 0, { label: 'voter1 새로고침 복원' });
      await voteOptions(voters[0]).nth(0).click();
      await submitBtn(voters[0]).click();
      await until(async () => (await readVote(voters[0])).text.includes('이미 투표했어요'), { label: '중복 문구' });
      assert((await countQ(Q1.id)) === 2, '중복 차단 후에도 DB 2행');
      await shot('S4-duplicate', { admin, screen, voter1: voters[0], voter2: voters[1] });
    });

    await step('S5', 'show_results(마감 전 공개): 새로고침 없이 막대, 표시 = DB', async () => {
      const t0 = Date.now();
      await clickAdmin('결과 공개');
      const ms = await until(async () => (await readScreen(screen)).bars > 0, { label: '막대 등장' });
      report.latency.showResultsToBars = Date.now() - t0;
      const s = await readScreen(screen);
      const dbCount = await countQ(Q1.id);
      assert(s.sum === dbCount, `표시 합계 ${s.sum} = DB ${dbCount}`);
      assert(s.live === dbCount, `참여 수 ${s.live} = DB ${dbCount}`);
      note(`막대 등장 ${ms}ms, 250ms 병합 꼬리까지 반영`);
      await shot('S5-results', { admin, screen, voter1: voters[0] });
    });

    await step('S6', 'voter3 투표 → 대형화면 실시간 3표', async () => {
      await voteOptions(voters[2]).nth(2).click();
      const t0 = Date.now();
      await submitBtn(voters[2]).click();
      await until(async () => (await readScreen(screen)).sum === 3, { label: '화면 3표' });
      report.latency.voteToScreen = Date.now() - t0;
      const s = await readScreen(screen);
      assert(s.sum === 3 && s.live === 3, `화면 3표/3명 (실제 ${s.sum}/${s.live})`);
      assert((await countQ(Q1.id)) === 3, 'DB 3행');
      note(`투표 → 대형화면 반영 ${report.latency.voteToScreen}ms`);
      await shot('S6-live-increase', { admin, screen, voter3: voters[2] });
    });

    await step('S7', 'close_voting: voter4 투표 차단, 집계 불변', async () => {
      await clickAdmin('투표 닫기');
      await until(async () => (await voteOptions(voters[3]).count()) === 0, { label: 'voter4 대기 복귀' });
      const v = await readVote(voters[3]);
      assert(!v.submitVisible, 'voter4 투표 버튼 비활성(1차 차단)');
      const [res] = await rawVote(voters[3], [
        { question_id: Q1.id, option_id: Q1.options[0].id, text_value: null, voter_key: 'sim-closed-' + Date.now() },
      ]);
      assert([401, 403].includes(res.status), `서버 거부 401/403 (실제 ${res.status})`);
      assert(/42501/.test(res.body), `42501 코드 확인 (${res.body.slice(0, 80)})`);
      assert((await countQ(Q1.id)) === 3, '최종 집계 3 불변');
      const s = await readScreen(screen);
      assert(s.sum === 3, '대형화면 3표 유지');
      await shot('S7-closed', { admin, screen, voter4: voters[3] });
    });

    await step('S8', 'set_question(Q2): Q1 막대 즉시 소멸, stale 0', async () => {
      const frames = [];
      let stop = false;
      const watcher = (async () => {
        while (!stop) {
          const s = await readScreen(screen).catch(() => null);
          if (s) frames.push({ h1: norm(s.h1), bars: s.bars, sum: s.sum });
          await sleep(40);
        }
      })();
      await clickAdmin('다음 질문');
      await until(async () => norm((await readScreen(screen)).h1) === norm(Q2.title), { label: '대형화면 Q2' });
      stop = true;
      await watcher;
      const stale = frames.filter((f) => f.h1 === norm(Q2.title) && f.bars > 0);
      assert(stale.length === 0, `Q2 표시 중 이전 막대 프레임 0 (관측 ${frames.length}프레임)`);
      const s = await readScreen(screen);
      assert(s.bars === 0, '대형화면 막대 없음');
      for (let i = 0; i < 4; i++) {
        const v = await readVote(voters[i]);
        assert(!v.text.includes('투표했어요'), `voter${i + 1} 완료 화면 잔존 0`);
        assert(norm(v.h1) === norm(Q2.title), `voter${i + 1} Q2 전환`);
        assert(v.options.length === 0, `voter${i + 1} 미투표 대기 상태`);
      }
      await shot('S8-q2-switch', { admin, screen, voter1: voters[0] });
    });

    await step('S9', 'Q2 열기 → 4명 투표 → 결과 공개 집계 = DB', async () => {
      await clickAdmin('투표 열기');
      await Promise.all(voters.map((p) => until(async () => (await voteOptions(p).count()) > 0, { label: 'Q2 선택지' })));
      const picks = [0, 1, 2, 0];
      for (let i = 0; i < 4; i++) {
        await voteOptions(voters[i]).nth(picks[i] % Q2.options.length).click();
        await submitBtn(voters[i]).click();
        await until(async () => (await readVote(voters[i])).text.includes('투표했어요'), { label: `voter${i + 1} 완료` });
      }
      await clickAdmin('결과 공개');
      await until(async () => (await readScreen(screen)).sum === 4, { label: 'Q2 집계 4' });
      const s = await readScreen(screen);
      const dbCount = await countQ(Q2.id);
      assert(s.sum === dbCount && dbCount === 4, `화면 ${s.sum} = DB ${dbCount} = 4`);
      assert(s.live === 4, '4명 참여');
      await shot('S9-q2-results', { admin, screen, voter1: voters[0] });
    });

    await step('S10', 'Q3 주관식: 같은 단어 합산', async () => {
      await clickAdmin('다음 질문');
      await until(async () => norm((await readScreen(screen)).h1) === norm(Q3.title), { label: '대형화면 Q3' });
      await clickAdmin('투표 열기');
      await Promise.all(
        voters.map((p) => until(async () => (await readVote(p)).hasInput, { label: '주관식 입력칸' })),
      );
      const words = ['미래', '미래', '연결', '성장'];
      for (let i = 0; i < 4; i++) {
        await voters[i].locator('input[placeholder="한 단어로"]').fill(words[i]);
        await submitBtn(voters[i]).click();
        await until(async () => (await readVote(voters[i])).text.includes('투표했어요'), { label: `voter${i + 1} 제출` });
      }
      await clickAdmin('결과 공개');
      await until(async () => (await readScreen(screen)).sum === 4, { label: 'Q3 집계' });
      const s = await readScreen(screen);
      assert(s.bars === 3, `단어 3종 막대 (실제 ${s.bars})`);
      assert(s.votes[0] === 2, `최다 단어 2표 합산 (실제 ${s.votes[0]})`);
      assert(s.text.includes('미래') && s.text.includes('연결') && s.text.includes('성장'), '세 단어 표시');
      assert((await countQ(Q3.id)) === 4, 'DB 4행');
      await shot('S10-text-bars', { admin, screen, voter1: voters[0] });
    });

    await step('S11', '워드클라우드 토글: 막대와 같은 재질·ink/blue 2색', async () => {
      await clickAdmin('워드클라우드');
      await until(async () => (await readScreen(screen)).cloud.length === 3, { label: '클라우드 전환' });
      const audit = await screen.evaluate(() => {
        const words = [...document.querySelectorAll('.cloud-word')];
        const box = words[0]?.closest('div');
        const panel = document.querySelector('.glass-screen');
        const rects = words.map((w) => w.getBoundingClientRect());
        let overlap = 0;
        for (let i = 0; i < rects.length; i++)
          for (let j = i + 1; j < rects.length; j++) {
            const a = rects[i];
            const b = rects[j];
            if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlap++;
          }
        const h1 = document.querySelector('h1');
        return {
          words: words.map((w) => ({
            text: w.textContent.trim(),
            color: getComputedStyle(w).color,
            size: Math.round(parseFloat(getComputedStyle(w).fontSize)),
            weight: getComputedStyle(w).fontWeight,
          })),
          overlap,
          containerBg: box ? getComputedStyle(box).backgroundColor : null,
          canvases: document.querySelectorAll('canvas').length,
          fontMatchesH1: h1 && words[0] ? getComputedStyle(h1).fontFamily === getComputedStyle(words[0]).fontFamily : false,
          panelPad: panel ? getComputedStyle(panel).padding : null,
          overflowY: document.documentElement.scrollHeight - document.documentElement.clientHeight,
          overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      current.audit = audit;
      const colorSet = [...new Set(audit.words.map((w) => w.color))];
      assert(
        colorSet.every((c) => ['rgb(10, 10, 10)', 'rgb(31, 111, 255)'].includes(c)),
        `색 ink/blue 2종만 (실제 ${colorSet.join(', ')})`,
      );
      assert(audit.words.filter((w) => w.color === 'rgb(31, 111, 255)').length === 1, 'blue 는 최다 단어 1개');
      assert(audit.words.find((w) => w.color === 'rgb(31, 111, 255)').text === '미래', '최다 단어가 blue');
      assert(audit.overlap === 0, `단어 겹침 0 (실제 ${audit.overlap})`);
      assert(audit.canvases === 0, '캔버스 0(DOM 텍스트)');
      assert(audit.fontMatchesH1, '질문 h1 과 같은 폰트 스택');
      assert(audit.containerBg === 'rgba(0, 0, 0, 0)', '컨테이너 배경 없음');
      assert(audit.overflowX === 0 && audit.overflowY === 0, '넘침 0');
      await shot('S11-wordcloud', { admin, screen, voter1: voters[0] });

      await clickAdmin('막대');
      await until(async () => (await readScreen(screen)).bars === 3, { label: '막대 복귀' });
      assert((await readScreen(screen)).cloud.length === 0, '막대 복귀 후 클라우드 0');
      await shot('S11b-back-to-bars', { admin, screen });
    });

    await step('S12', '이 질문 초기화(Q3): 즉시 0표, Q1·Q2 보존', async () => {
      await clickAdmin('이 질문 초기화');
      await until(async () => (await readScreen(screen)).bars === 0, { label: 'Q3 막대 소멸' });
      assert((await countQ(Q3.id)) === 0, 'Q3 0행');
      assert((await countQ(Q1.id)) === 3, 'Q1 3행 보존');
      assert((await countQ(Q2.id)) === 4, 'Q2 4행 보존');
      await clickAdmin(Q1.title, false);
      await clickAdmin('결과 공개');
      await until(async () => (await readScreen(screen)).sum === 3, { label: 'Q1 3표 조회' });
      assert((await readScreen(screen)).sum === 3, '다른 질문 조회 시 Q1 3표');
      await shot('S12-reset-question', { admin, screen });
    });

    await step('S13', '전체 초기화(2단 확인): 전 질문 0, standby', async () => {
      await clickAdmin('전체 초기화');
      await adminBtn('한 번 더 누르면 전체 삭제').waitFor({ state: 'visible', timeout: 4000 });
      await clickAdmin('한 번 더 누르면 전체 삭제');
      await until(async () => (await countAll()) === 0, { label: 'votes 0' });
      const s = await sessionRow();
      assert(s.status === 'standby' && !s.voting_open && !s.results_visible, 'standby 복귀');
      await until(async () => (await readScreen(screen)).qr > 0, { label: '대형화면 QR' });
      await shot('S13-reset-all', { admin, screen, voter1: voters[0] });
    });

    await step('S14', '종료(end) 상태 화면', async () => {
      const r = await apiControl(admin, { action: 'end' });
      assert(r.status === 200, `end 200 (실제 ${r.status})`);
      await until(async () => (await readVote(voters[0])).text.includes('종료'), { label: '청중 종료 안내' });
      const v = await readVote(voters[0]);
      assert(v.text.includes('오늘 세션이 종료되었어요'), '청중 종료 문구');
      const landing = await voterCtxs[0].newPage();
      listen(landing, 'landing');
      await landing.goto(`${BASE}/`);
      await until(async () => (await landing.evaluate(() => document.body.innerText)).includes('끝났어요'), {
        label: '랜딩 종료',
      });
      await shot('S14-ended', { admin, screen, voter1: voters[0], landing });
      await landing.close();
      note('어드민 화면에는 end 버튼이 없다. IA 상 종료는 API 경로로만 가능하다.');
      await apiControl(admin, { action: 'standby' });
    });
  }

  // ══════════════ 섹션 2: 동시성 ══════════════
  if (sections.includes('2')) {
    await step('C1', '4명 동시 투표: 유실·중복 0', async () => {
      await apiControl(admin, { action: 'reset', scope: 'all' });
      await apiControl(admin, { action: 'set_question', questionId: Q1.id });
      await Promise.all(voters.map((p) => p.reload()));
      await apiControl(admin, { action: 'open_voting' });
      await Promise.all(
        voters.map((p) => until(async () => (await voteOptions(p).count()) === Q1.options.length, { label: '선택지' })),
      );
      for (let i = 0; i < 4; i++) await voteOptions(voters[i]).nth(i).click();
      const t0 = Date.now();
      await Promise.all(voters.map((p) => submitBtn(p).click()));
      await Promise.all(
        voters.map((p, i) =>
          until(async () => (await readVote(p)).text.includes('투표했어요'), { label: `voter${i + 1} 완료` }),
        ),
      );
      report.latency.concurrent4Submit = Date.now() - t0;
      const rows = await rowsQ(Q1.id);
      assert(rows.length === 4, `DB 4행 (실제 ${rows.length})`);
      const byOption = rows.reduce((acc, r) => ((acc[r.option_id] = (acc[r.option_id] ?? 0) + 1), acc), {});
      assert(Object.keys(byOption).length === 4, '옵션 4종에 1표씩');
      assert(Object.values(byOption).reduce((a, b) => a + b, 0) === 4, '옵션별 합 = 4');
      assert(new Set(rows.map((r) => r.voter_key)).size === 4, 'voter_key 4종(컨텍스트 분리)');
      await apiControl(admin, { action: 'show_results' });
      await until(async () => (await readScreen(screen)).sum === 4, { label: '화면 4표' });
      const s = await readScreen(screen);
      assert(s.sum === 4 && s.live === 4, `화면 ${s.sum}표/${s.live}명`);
      assert(s.votes.filter((v) => v === 1).length === 4, '옵션별 1표씩 표시');
      await shot('C1-concurrent-4', { admin, screen, voter1: voters[0], voter4: voters[3] });
    });

    await step('C2', '같은 voter_key 동시 재투표: 1건만 성공', async () => {
      await apiControl(admin, { action: 'set_question', questionId: Q2.id });
      await apiControl(admin, { action: 'open_voting' });
      const cookies = await voterCtxs[0].cookies();
      const vk = cookies.find((c) => c.name === 'vk')?.value;
      assert(Boolean(vk), 'voter1 쿠키 vk 확인');
      const res = await rawVote(voters[0], [
        { question_id: Q2.id, option_id: Q2.options[0].id, text_value: null, voter_key: vk },
        { question_id: Q2.id, option_id: Q2.options[1].id, text_value: null, voter_key: vk },
      ]);
      current.raw = res;
      const ok = res.filter((r) => r.status === 201 || r.status === 204);
      const dup = res.filter((r) => r.status === 409);
      assert(ok.length === 1, `성공 1건 (실제 ${ok.length}, 상태 ${res.map((r) => r.status).join('/')})`);
      assert(dup.length === 1, '나머지 409');
      assert(dup[0].body.includes('23505'), '23505 코드');
      const rows = (await rowsQ(Q2.id)).filter((r) => r.voter_key === vk);
      assert(rows.length === 1, `votes 테이블에 해당 키 정확히 1행 (실제 ${rows.length})`);
      await shot('C2-race-duplicate', { admin, screen, voter1: voters[0] });
    });

    await step('C3', '동시 접속: 새 컨텍스트 4개 동시 진입', async () => {
      const fresh = [];
      for (let i = 0; i < 4; i++) fresh.push(await newContext({ ...devices['iPhone 13'] }));
      const pages = await Promise.all(fresh.map((c) => c.newPage()));
      pages.forEach((p, i) => listen(p, `fresh${i + 1}`));
      const t0 = Date.now();
      await Promise.all(pages.map((p) => p.goto(`${BASE}/vote`)));
      await Promise.all(
        pages.map((p, i) =>
          until(async () => (await voteOptions(p).count()) === Q2.options.length, { label: `fresh${i + 1} 선택지` }),
        ),
      );
      report.latency.coldJoin4 = Date.now() - t0;
      for (let i = 0; i < 4; i++) {
        const v = await readVote(pages[i]);
        assert(v.rootChildren > 0, `fresh${i + 1} 렌더(흰 화면 0)`);
        assert(norm(v.h1) === norm(Q2.title), `fresh${i + 1} 현재 질문 일치`);
        assert(v.options.length === Q2.options.length, `fresh${i + 1} 열린 상태 반영`);
      }
      await shot('C3-cold-join', { admin, screen, fresh1: pages[0] });
      await Promise.all(fresh.map((c) => c.close()));
      openContexts -= 4;
      note(`동시 진입 4개 렌더 완료까지 ${report.latency.coldJoin4}ms, 최대 동시 컨텍스트 ${report.maxConcurrentContexts}`);
    });

    await step('C4', '관리자 연타(200ms 간격 3연타): 마지막 명령과 일치', async () => {
      const seq = ['open_voting', 'close_voting', 'open_voting'];
      const fired = [];
      for (const action of seq) {
        fired.push(apiControl(admin, { action }));
        await sleep(200);
      }
      const results = await Promise.all(fired);
      current.raw = results.map((r, i) => ({ action: seq[i], status: r.status, voting_open: r.json?.voting_open, ms: r.ms }));
      assert(results.every((r) => r.status === 200), '3건 모두 200');
      await sleep(600);
      const s = await sessionRow();
      assert(s.voting_open === true, `최종 voting_open=true (실제 ${s.voting_open})`);
      await until(async () => (await voteOptions(voters[3]).count()) > 0, { label: '청중 열림 반영' });

      // UI 연타: busy 가드가 요청 중복을 막는지
      const before = await sessionRow();
      await clickAdmin(before.voting_open ? '투표 닫기' : '투표 열기');
      await sleep(120);
      const rapid = await admin.evaluate(async () => {
        const hits = [];
        for (let i = 0; i < 3; i++) {
          const b = [...document.querySelectorAll('button')].find((x) => /투표 (열기|닫기)/.test(x.innerText));
          hits.push({ label: b?.innerText.trim(), disabled: b?.disabled === true || b?.getAttribute('aria-disabled') === 'true' });
          b?.click();
          await new Promise((r) => setTimeout(r, 200));
        }
        return hits;
      });
      current.rapidUi = rapid;
      await sleep(800);
      const after = await sessionRow();
      const screenState = await readVote(voters[3]);
      assert(
        after.voting_open === (screenState.options.length > 0),
        `세션 voting_open=${after.voting_open} 과 청중 화면 일치`,
      );
      note(`UI 연타 시 버튼 상태: ${JSON.stringify(rapid)}`);
      await shot('C4-rapid-admin', { admin, screen, voter4: voters[3] });
    });

    await step('C5', '대형화면 끊김 중 투표 → 재연결 후 값 복원', async () => {
      await apiControl(admin, { action: 'set_question', questionId: Q1.id });
      await apiControl(admin, { action: 'reset', scope: 'question', questionId: Q1.id });
      await apiControl(admin, { action: 'open_voting' });
      await apiControl(admin, { action: 'show_results' });
      await Promise.all(voters.map((p) => p.reload()));
      await Promise.all(voters.map((p) => until(async () => (await voteOptions(p).count()) > 0, { label: '선택지' })));

      await voteOptions(voters[0]).nth(0).click();
      await submitBtn(voters[0]).click();
      await until(async () => (await readScreen(screen)).sum === 1, { label: '화면 1표' });

      await screenCtx.setOffline(true);
      await sleep(1500);
      for (let i = 1; i < 4; i++) {
        await voteOptions(voters[i]).nth(i).click();
        await submitBtn(voters[i]).click();
        await until(async () => (await readVote(voters[i])).text.includes('투표했어요'), { label: `voter${i + 1} 제출` });
      }
      assert((await countQ(Q1.id)) === 4, '끊긴 사이 DB 4행');
      const offlineView = await readScreen(screen);
      current.offlineSum = offlineView.sum;

      const t0 = Date.now();
      await screenCtx.setOffline(false);
      let restored = null;
      try {
        await until(async () => (await readScreen(screen)).sum === 4, { timeout: 20000, label: '재연결 후 4표 복원' });
        restored = Date.now() - t0;
      } catch (error) {
        restored = null;
        current.restoreFailed = true;
      }
      report.latency.screenReconnectRestore = restored;
      const s = await readScreen(screen);
      await shot('C5-reconnect', { admin, screen, voter1: voters[0] });
      assert(s.sum === 4, `재연결 후 화면 ${s.sum}표 = DB 4표`);
      note(`끊긴 동안 화면 ${current.offlineSum}표, 재연결 후 복원 ${restored}ms`);
    });
  }

  // ══════════════ 섹션 3: 오류·엣지 ══════════════
  if (sections.includes('3')) {
    await step('E3', '0표 상태 결과 공개: NaN/Infinity/undefined 0', async () => {
      await apiControl(admin, { action: 'reset', scope: 'all' });
      await apiControl(admin, { action: 'set_question', questionId: Q1.id });
      await apiControl(admin, { action: 'show_results' });
      await until(async () => (await readScreen(screen)).bars === Q1.options.length, { label: '0표 막대' });
      const s = await readScreen(screen);
      assert(!/NaN|Infinity|undefined|null/.test(s.text), '금지 문자열 0');
      assert(s.text.includes('0%') && s.text.includes('0표'), '0% / 0표 표기');
      assert(s.live === 0, '0명 참여');
      const widths = await screen.evaluate(() =>
        [...document.querySelectorAll('.bar-fill')].map((b) => Math.round(b.getBoundingClientRect().width)),
      );
      assert(widths.every((w) => w === 0), `막대 길이 전부 0 (실제 ${widths.join(',')})`);
      await shot('E3-zero-votes', { admin, screen });
    });

    await step('E4', '입력 상한·긴 라벨: 레이아웃 무결', async () => {
      await apiControl(admin, { action: 'set_question', questionId: Q3.id });
      await apiControl(admin, { action: 'open_voting' });
      await until(async () => (await readVote(voters[0])).hasInput, { label: '주관식 입력칸' });
      const long = '지속가능한미래를향한우리의첫번째실천과연대그리고변화의시작점'.slice(0, 80);
      await voters[0].locator('input[placeholder="한 단어로"]').fill(long);
      const v = await readVote(voters[0]);
      current.inputCap = { attempted: long.length, stored: v.inputLen };
      assert(v.inputLen === 12, `입력 상한 12자 (시도 ${long.length}자 → ${v.inputLen}자)`);
      assert(v.overflowX === 0, '청중 화면 가로 스크롤 0');
      await voters[0].locator('input[placeholder="한 단어로"]').fill('');

      // 긴 선택지 라벨: 원본을 기록하고 되돌린다
      const target = Q1.options[0];
      const longLabel = '지역사회와 함께하는 지속가능한 전환 실험 프로그램 운영';
      await db.from('options').update({ label: longLabel }).eq('id', target.id);
      await apiControl(admin, { action: 'set_question', questionId: Q1.id });
      await apiControl(admin, { action: 'open_voting' });
      await apiControl(admin, { action: 'show_results' });
      await until(async () => (await readScreen(screen)).text.includes('지속가능한'), { label: '긴 라벨 반영' });
      await Promise.all(voters.map((p) => p.reload()));
      await until(async () => (await readVote(voters[0])).options.length === Q1.options.length, { label: '청중 재렌더' });
      const sc = await readScreen(screen);
      const vv = await readVote(voters[0]);
      const overflow = await screen.evaluate(() => ({
        x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      }));
      await shot('E4-long-label', { admin, screen, voter1: voters[0] });
      assert(sc.overflowX === 0 && overflow.y === 0, `대형화면 넘침 0 (x ${overflow.x} / y ${overflow.y})`);
      assert(vv.overflowX === 0, '청중 화면 가로 스크롤 0');
      await db.from('options').update({ label: target.label }).eq('id', target.id);
      const restored = (await db.from('options').select('label').eq('id', target.id).single()).data;
      assert(restored.label === target.label, `라벨 원복 확인(${restored.label})`);
    });

    await step('E5', '행 수가 다른 차트의 세로 채움', async () => {
      const measure = () =>
        screen.evaluate(() => {
          const panel = document.querySelector('.glass-screen');
          const chart = document.querySelector('.grid.flex-1');
          if (!panel || !chart) return null;
          const p = panel.getBoundingClientRect();
          const c = chart.getBoundingClientRect();
          return {
            rows: document.querySelectorAll('.bar-fill').length,
            panelH: Math.round(p.height),
            chartH: Math.round(c.height),
            ratio: Number((c.height / p.height).toFixed(3)),
            overflowY: document.documentElement.scrollHeight - document.documentElement.clientHeight,
            bottomGap: Math.round(p.bottom - c.bottom),
          };
        });
      await apiControl(admin, { action: 'set_question', questionId: Q1.id });
      await apiControl(admin, { action: 'show_results' });
      await until(async () => (await readScreen(screen)).bars === 4, { label: '4행 차트' });
      const four = await measure();

      await apiControl(admin, { action: 'set_question', questionId: Q3.id });
      await apiControl(admin, { action: 'open_voting' });
      await Promise.all(voters.map((p) => p.reload()));
      await Promise.all(voters.slice(0, 2).map((p) => until(async () => (await readVote(p)).hasInput, { label: '입력칸' })));
      for (const [i, word] of [['0', '참여'], ['1', '전환']]) {
        const p = voters[Number(i)];
        await p.locator('input[placeholder="한 단어로"]').fill(word);
        await submitBtn(p).click();
        await until(async () => (await readVote(p)).text.includes('투표했어요'), { label: '제출' });
      }
      await apiControl(admin, { action: 'show_results' });
      await until(async () => (await readScreen(screen)).bars === 2, { label: '2행 차트' });
      const two = await measure();
      current.chart = { four, two };
      await shot('E5-chart-fill', { admin, screen });
      assert(four && two, '차트 측정');
      assert(four.overflowY === 0 && two.overflowY === 0, '세로 넘침 0');
      assert(four.ratio > 0.5 && two.ratio > 0.5, `패널 세로 채움 (4행 ${four.ratio} / 2행 ${two.ratio})`);
      assert(four.bottomGap >= 0 && two.bottomGap >= 0, '패널 밖으로 밀림 0');
    });

    await step('E6', '쿠키 없는 세션 제어 호출은 401', async () => {
      const fromVoter = await voters[0].evaluate(async (base) => {
        const r = await fetch(base + '/api/session-control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'standby' }),
        });
        return r.status;
      }, BASE);
      assert(fromVoter === 401, `청중 컨텍스트 401 (실제 ${fromVoter})`);
      const node = await fetch(BASE + '/api/session-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'standby' }),
      });
      assert(node.status === 401, `쿠키 없는 직접 호출 401 (실제 ${node.status})`);
      const forged = await fetch(BASE + '/api/session-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: 'admin=99999999999999.' + 'A'.repeat(43) },
        body: JSON.stringify({ action: 'standby' }),
      });
      assert(forged.status === 401, `위조 쿠키 401 (실제 ${forged.status})`);
      const reset = await fetch(BASE + '/api/session-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', scope: 'all' }),
      });
      assert(reset.status === 401, `초기화도 401 (실제 ${reset.status})`);
      const s = await sessionRow();
      assert(s.active_question_id === Q3.id, '무인증 호출로 상태가 바뀌지 않음');
    });

    await step('E7', '결과 화면 디자인 회귀 0', async () => {
      await apiControl(admin, { action: 'set_question', questionId: Q1.id });
      await apiControl(admin, { action: 'open_voting' });
      await Promise.all(voters.map((p) => p.reload()));
      await Promise.all(voters.map((p) => until(async () => (await voteOptions(p).count()) > 0, { label: '선택지' })));
      for (let i = 0; i < 3; i++) {
        await voteOptions(voters[i]).nth(i % Q1.options.length).click();
        await submitBtn(voters[i]).click();
        await until(async () => (await readVote(voters[i])).text.includes('투표했어요'), { label: '제출' });
      }
      await apiControl(admin, { action: 'show_results' });
      await until(async () => (await readScreen(screen)).sum === 3, { label: '결과 3표' });
      const audit = await screen.evaluate(() => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const colors = {};
        let n;
        while ((n = walker.nextNode())) {
          if (!n.textContent.trim()) continue;
          const c = getComputedStyle(n.parentElement).color;
          colors[c] = (colors[c] ?? 0) + 1;
        }
        const text = document.body.innerText;
        return {
          colors,
          midDot: (text.match(/·/g) ?? []).length,
          backup: /백업|backup|Slido/i.test(text),
          bars: [...document.querySelectorAll('.bar-fill')].map((b) => getComputedStyle(b).backgroundColor),
        };
      });
      current.audit = audit;
      const allowed = ['rgb(10, 10, 10)', 'rgb(31, 111, 255)'];
      const bad = Object.keys(audit.colors).filter((c) => !allowed.includes(c));
      assert(bad.length === 0, `텍스트 색 ink/blue 외 0 (실제 ${bad.join(', ') || '없음'})`);
      assert(audit.midDot === 0, `가운뎃점 0 (실제 ${audit.midDot})`);
      assert(!audit.backup, '백업 관련 문구 0');
      const barColors = [...new Set(audit.bars)];
      assert(
        barColors.every((c) => ['rgb(31, 111, 255)', 'rgb(57, 64, 74)'].includes(c)),
        `막대 색 blue/inkSoft (실제 ${barColors.join(', ')})`,
      );
      await shot('E7-design-audit', { admin, screen });
    });

    await step('E1', '콘솔 에러 전수', async () => {
      const unexpected = report.consoleErrors.filter((e) => !e.expected);
      current.consoleErrorCount = report.consoleErrors.length;
      current.unexpected = unexpected;
      current.pageErrors = report.pageErrors;
      assert(report.pageErrors.length === 0, `페이지 예외 0 (실제 ${report.pageErrors.length})`);
      assert(unexpected.length === 0, `예상 밖 콘솔 에러 0 (실제 ${unexpected.length}: ${unexpected.map((e) => e.text).slice(0, 3).join(' | ')})`);
      note(`예상된 에러(중복 409·마감 403·인증 401) ${report.consoleErrors.length - unexpected.length}건은 설계된 거부 응답이다.`);
    });

    await step('E2', '흰 화면·렌더 실패 0', async () => {
      const pages = [
        ['admin', admin],
        ['screen', screen],
        ...voters.map((p, i) => [`voter${i + 1}`, p]),
      ];
      for (const [name, p] of pages) {
        const r = await p.evaluate(() => ({
          children: document.getElementById('root')?.childElementCount ?? 0,
          textLen: document.body.innerText.trim().length,
          overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }));
        assert(r.children > 0 && r.textLen > 0, `${name} 렌더 정상(자식 ${r.children}, 텍스트 ${r.textLen}자)`);
        assert(r.overflowX === 0, `${name} 가로 스크롤 0`);
      }
    });
  }
} catch (error) {
  report.defects.push({ where: 'runner', text: String(error?.stack || error) });
} finally {
  // 정리: 투표 전부 삭제 + standby 복구
  await db.from('votes').delete().not('id', 'is', null);
  const { data: finalSession } = await db
    .from('sessions')
    .update({ status: 'standby', voting_open: false, results_visible: false, results_view: 'bars' })
    .eq('id', SESSION_ID)
    .select()
    .single();
  const { data: finalOptions } = await db.from('options').select('id, label, question_id, order_no').order('order_no');
  report.cleanup = { votes: await countAll(), session: finalSession, options: finalOptions };
  await Promise.all(contexts.map((c) => c.close().catch(() => {})));
  await browser.close();

  report.finishedAt = new Date().toISOString();
  report.summary = {
    total: report.steps.length,
    pass: report.steps.filter((s) => s.status === 'PASS').length,
    fail: report.steps.filter((s) => s.status === 'FAIL').length,
  };
  await writeFile(`${ART}/simulation-report.json`, JSON.stringify(report, null, 2));
  console.log('\n=== 요약 ===');
  console.log(JSON.stringify({ summary: report.summary, latency: report.latency, cleanup: { votes: report.cleanup.votes, status: report.cleanup.session?.status }, maxContexts: report.maxConcurrentContexts }, null, 2));
  for (const s of report.steps.filter((x) => x.status === 'FAIL')) console.log(`FAIL ${s.id} ${s.title} :: ${s.error}`);
}
