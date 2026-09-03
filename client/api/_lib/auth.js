import crypto from 'node:crypto';

const COOKIE = 'admin';
const MAX_AGE = 60 * 60 * 12; // 12h

export function sign(exp, secret) {
  return crypto.createHmac('sha256', secret).update(String(exp)).digest('base64url');
}

export function makeCookie(secret, isProd) {
  const exp = Date.now() + MAX_AGE * 1000;
  const value = `${exp}.${sign(exp, secret)}`;
  const parts = [`${COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${MAX_AGE}`];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

export function clearCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function verifyCookie(cookieHeader, secret) {
  if (!cookieHeader) return false;
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [expStr, sig] = m[1].split('.');
  const exp = Number(expStr);
  if (!exp || Date.now() > exp) return false;
  const expected = sign(exp, secret);
  const a = Buffer.from(sig || '', 'utf8'), b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a), 'utf8'), y = Buffer.from(String(b), 'utf8');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function readJson(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); } });
  });
}
