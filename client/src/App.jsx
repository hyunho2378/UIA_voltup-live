import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { adminCheck } from './lib/admin.js';
import { SessionProvider } from './lib/session-context.jsx';
import Landing from './routes/Landing.jsx';
import Vote from './routes/Vote.jsx';
import Screen from './routes/Screen.jsx';
import AdminLogin from './routes/AdminLogin.jsx';
import Admin from './routes/Admin.jsx';
import Offline from './routes/Offline.jsx';
import NotFound from './routes/NotFound.jsx';
import DevControlPanel from './components/dev/DevControlPanel.jsx';
import Preview from './routes/Preview.jsx';

// 쿠키는 httpOnly 라 JS 로 못 읽는다. 서버에 한 번 물어본다.
function RequireAdmin({ children }) {
  const [ok, setOk] = useState(null);

  useEffect(() => {
    let alive = true;
    adminCheck()
      .then((r) => alive && setOk(r))
      .catch(() => alive && setOk(false));
    return () => {
      alive = false;
    };
  }, []);

  if (ok === null) return null; // 확인 전에는 아무것도 그리지 않는다(깜빡임 금지)
  return ok ? children : <Navigate to="/admin/login" replace />;
}

export default function App() {
  const { pathname } = useLocation();

  // /preview 는 SessionProvider 와 DevControlPanel 밖에서 그린다.
  // 둘 다 마운트되면 갤러리를 여는 것만으로 realtime 소켓과 questions/sessions 조회가 나간다.
  // 갤러리는 목업만 그려야 하므로 Supabase 를 아예 건드리지 않게 분리한다.
  if (import.meta.env.DEV && pathname === '/preview') return <Preview />;

  return (
    <SessionProvider>
      {import.meta.env.DEV && <DevControlPanel />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/vote" element={<Vote />} />
        <Route path="/screen" element={<Screen />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <Admin />
            </RequireAdmin>
          }
        />
        <Route path="/offline" element={<Offline />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </SessionProvider>
  );
}
