// 시뮬레이션 하네스 서버(최종). 앱 코드가 아니다.
//   /api/*   → client/api/*.js 실제 serverless 핸들러 (행사 당일과 같은 인증·제어 경로)
//   /sim/*   → 검증용 DB 원장 조회(하네스 전용)
//   그 외     → dist(프로덕션 빌드) 정적 서빙 + SPA fallback. 매 요청 디스크에서 읽어 재빌드가 즉시 반영된다.
// ?__hook=1 로 들어오면 index.html 에 WebSocket 기록기를 주입한다. 재연결 시나리오에서
// 소켓을 강제로 끊기 위한 장치이고, 쿼리 없이 들어오면 주입하지 않는다(기본 경로는 무가공).

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, normalize } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const PORT = Number(process.env.SIM_PORT || 5300);
const DIST = resolve(process.cwd(), 'dist');
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

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

const HOOK = `<script>
(function(){
  window.__sockets = [];
  var Native = window.WebSocket;
  window.WebSocket = new Proxy(Native, {
    construct: function (target, args) {
      var s = new target(args[0], args[1]);
      window.__sockets.push(s);
      return s;
    },
  });
})();
</script>`;

const handlers = new Map();
async function loadHandler(name) {
  if (!handlers.has(name)) {
    const mod = await import(new URL(`../api/${name}.js`, import.meta.url).href);
    handlers.set(name, mod.default);
  }
  return handlers.get(name);
}
function vercelRes(res) {
  res.status = (code) => ((res.statusCode = code), res);
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

  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  const filePath = resolve(DIST, '.' + rel);
  let body = null;
  let type = MIME[extname(filePath)] || 'application/octet-stream';
  try {
    const s = await stat(filePath);
    if (s.isFile()) body = await readFile(filePath);
  } catch {
    body = null;
  }
  if (!body) {
    body = await readFile(resolve(DIST, 'index.html'));
    type = MIME['.html'];
  }
  if (type.startsWith('text/html')) {
    let html = body.toString('utf8');
    if (url.searchParams.get('__hook') === '1') html = html.replace('</head>', `${HOOK}\n</head>`);
    body = Buffer.from(html, 'utf8');
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
});

server.listen(PORT, '0.0.0.0', () => console.log(`sim-server3 ${PORT} → ${DIST}`));
