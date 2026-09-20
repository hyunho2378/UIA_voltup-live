// 시뮬레이션 전용 하네스 서버. 앱 코드가 아니다.
// vercel dev 로그인 없이 "행사 당일 경로"를 그대로 재현하려고 만든다.
//   /api/*  → client/api/*.js 실제 serverless 핸들러를 그대로 실행 (인증·세션 제어 동일 코드)
//   나머지  → vite preview(프로덕션 빌드) 로 프록시
// 프로덕션 번들이므로 DevControlPanel 도 /preview 도 없다. 어드민은 실제 패스코드로 들어간다.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const PORT = Number(process.env.SIM_PORT || 5199);
const UPSTREAM = process.env.SIM_UPSTREAM || 'http://127.0.0.1:4173';

const envText = await readFile(resolve(process.cwd(), '.env'), 'utf8');
for (const line of envText.split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i <= 0 || line.trim().startsWith('#')) continue;
  process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

const handlers = new Map();
async function loadHandler(name) {
  if (!handlers.has(name)) {
    const mod = await import(new URL(`../api/${name}.js`, import.meta.url).href);
    handlers.set(name, mod.default);
  }
  return handlers.get(name);
}

// Vercel 이 주는 res 편의 메서드만 얹는다. 핸들러 코드는 손대지 않는다.
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

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

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
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: String(error?.message || error) }));
    }
  }

  // 정적 자산 + SPA fallback 은 vite preview 가 책임진다.
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

server.listen(PORT, '127.0.0.1', () => console.log(`sim-server ${PORT} → ${UPSTREAM}`));
