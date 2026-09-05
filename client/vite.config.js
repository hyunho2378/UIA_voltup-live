import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createClient } from '@supabase/supabase-js';
import { handleControl } from './api/_lib/session-actions.js';

// dev 서버 전용 미들웨어. vercel dev 없이도 세션 상태를 넘길 수 있게 한다.
// apply:'serve' 라 프로덕션 빌드에는 존재하지 않는다. 인증이 없으므로 로컬 밖으로 내보내면 안 된다.
function devSessionControl(env) {
  return {
    name: 'dev-session-control',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev__/session-control', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end();
        }
        if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: 'SUPABASE_URL / SUPABASE_SECRET_KEY 미설정' }));
        }

        let raw = '';
        for await (const chunk of req) raw += chunk;
        let payload = {};
        try {
          payload = JSON.parse(raw || '{}');
        } catch {
          payload = {};
        }

        const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { status, body } = await handleControl(admin, payload);
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(body));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // prefix '' 로 읽어야 VITE_ 없는 서버 전용 값까지 들어온다. 클라 번들에는 노출되지 않는다.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), devSessionControl(env)],
    server: { port: 5173 },
  };
});
