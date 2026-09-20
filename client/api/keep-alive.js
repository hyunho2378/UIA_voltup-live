// Supabase 무료 티어 무활동 자동 정지 방지용. Vercel Cron이 매일 호출한다. read only.
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await admin.from('sessions').select('id').limit(1);
  if (error) {
    console.error('[keep-alive] failed:', error.message);
    return res.status(500).json({ ok: false, error: error.message });
  }
  return res.status(200).json({ ok: true, ts: Date.now() });
}
