// 시뮬레이션 전용 하네스 서버. 앱 코드가 아니다.
// vercel dev 로그인 없이 "행사 당일 경로"를 그대로 재현한다.
//   /api/*  → client/api/*.js 실제 serverless 핸들러 실행 (인증·세션 제어 동일 코드)
//   /sim/*  → 검증용 DB 원장 조회(하네스 전용. 앱에는 없는 경로)
//   나머지  → vite preview(프로덕션 빌드) 로 프록시
// 0.0.0.0 로 듣는다. 127.0.0.1~127.0.0.6 을 각각 다른 오리진으로 쓰면 쿠키(voter_key)가 섞이지 않는다.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const PORT = Number(process.env.SIM_PORT || 5199);
const UPSTREAM = process.env.SIM_UPSTREAM || 'http://127.0.0.1:4173';
const SESSION_ID = '00000000-0000-0000-0000-000000000001';

const envText = await readFile(resolve(process.cwd(), '.env'), 'utf8');
for (const line of envText.split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i <= 0 || line.trim().startsWith('#')) continue;
  process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const handlers = new Map();
async function loadHandler(name) {
  if (!handlers.has(name)) {
    const mod = await import(new URL(`../api/${name}.js`, import.meta.url).href);
    handlers.set(name, mod.default);
  }
  return handlers.get(name);
}

function vercelRes(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
    return res;
  };
  return res;
}

const send = (res, code, body) => {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(body));
};

async function simRoute(url, req, res) {
  const path = url.pathname.slice('/sim/'.length);
  const qid = url.searchParams.get('qid');

  if (path === 'votes') {
    const q = db.from('votes').select('question_id, option_id, text_value, voter_key, created_at');
    if (qid) q.eq('question_id', qid);
    const { data, error } = await q;
    if (error) return send(res, 500, { error: error.message });
    return send(res, 200, { count: data.length, rows: data });
  }
  if (path === 'session') {
    const { data, error } = await db.from('sessions').select('*').eq('id', SESSION_ID).maybeSingle();
    if (error) return send(res, 500, { error: error.message });
    return send(res, 200, data);
  }
  if (path === 'questions') {
    const { data, error } = await db
      .from('questions')
      .select('id, order_no, type, title, options(id, order_no, label)')
      .order('order_no');
    if (error) return send(res, 500, { error: error.message });
    return send(res, 200, data);
  }
  if (path === 'cleanup') {
    await db.from('votes').delete().not('id', 'is', null);
    const { data } = await db
      .from('sessions')
      .update({ status: 'standby', voting_open: false, results_visible: false, results_view: 'bars' })
      .eq('id', SESSION_ID)
      .select()
      .single();
    const { data: votes } = await db.from('votes').select('id');
    return send(res, 200, { votes: votes.length, session: data });
  }
  if (path === 'option-label') {
    let raw = '';
    for await (const c of req) raw += c;
    const { id, label } = JSON.parse(raw || '{}');
    const { data, error } = await db.from('options').update({ label }).eq('id', id).select().single();
    if (error) return send(res, 500, { error: error.message });
    return send(res, 200, data);
  }
  return send(res, 404, { error: 'unknown sim route' });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (url.pathname.startsWith('/sim/')) {
    try {
      return await simRoute(url, req, res);
    } catch (error) {
      return send(res, 500, { error: String(error?.message || error) });
    }
  }

  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.slice('/api/'.length).replace(/\/+$/, '');
    if (!/^[a-z-]+$/.test(name)) {
      res.statusCode = 404;
      return res.end();
    }
    try {
      const handler = await loadHandler(name);
      req.query = Object.fromEntries(url.searchParams);
      return await handler(req, vercelRes(res));
    } catch (error) {
      return send(res, 500, { error: String(error?.message || error) });
    }
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;
  delete headers['content-length'];

  try {
    const upstream = await fetch(UPSTREAM + req.url, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
      redirect: 'manual',
    });
    res.statusCode = upstream.status;
    upstream.headers.forEach((value, key) => {
      if (['content-encoding', 'transfer-encoding', 'connection'].includes(key)) return;
      res.setHeader(key, value);
    });
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    res.statusCode = 502;
    res.end(String(error?.message || error));
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`sim-server ${PORT} → ${UPSTREAM} (0.0.0.0)`));
