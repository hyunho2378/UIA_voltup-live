import { verifyCookie, clearCookie } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method === 'DELETE') { res.setHeader('Set-Cookie', clearCookie()); return res.status(204).end(); }
  if (req.method !== 'GET') return res.status(405).end();
  return verifyCookie(req.headers.cookie, process.env.ADMIN_COOKIE_SECRET) ? res.status(204).end() : res.status(401).end();
}
