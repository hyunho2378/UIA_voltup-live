import { createClient } from '@supabase/supabase-js';
import { verifyCookie, readJson } from './_lib/auth.js';
import { applySessionAction } from './_lib/session-actions.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!verifyCookie(req.headers.cookie, process.env.ADMIN_COOKIE_SECRET)) return res.status(401).end();

  const { action, questionId } = await readJson(req);
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { status, body } = await applySessionAction(admin, action, questionId);
  return res.status(status).json(body);
}
