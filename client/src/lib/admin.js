// 어드민 전용 서버 경로. sessions 쓰기는 RLS 로 막혀 있어 이 경로가 유일하다.
// 인증은 httpOnly 쿠키. 브라우저 저장소는 쓰지 않는다.

export const adminLogin = (passcode) =>
  fetch('/api/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode }),
    credentials: 'include',
  }).then((r) => r.ok);

export const adminCheck = () => fetch('/api/admin-session', { credentials: 'include' }).then((r) => r.ok);

export const adminLogout = () => fetch('/api/admin-session', { method: 'DELETE', credentials: 'include' });

export const control = (action, questionId) =>
  fetch('/api/session-control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, questionId }),
    credentials: 'include',
  }).then(async (r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });
