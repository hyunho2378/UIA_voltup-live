import { makeCookie, safeEqual, readJson } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { passcode } = await readJson(req);
  if (!passcode || !safeEqual(passcode, process.env.ADMIN_PASSCODE || '')) return res.status(401).end();
  res.setHeader('Set-Cookie', makeCookie(process.env.ADMIN_COOKIE_SECRET, process.env.VERCEL_ENV === 'production'));
  return res.status(204).end();
}
