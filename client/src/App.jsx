import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { adminCheck } from './lib/admin.js';
import { SessionProvider } from './lib/session-context.jsx';
import Vote from './routes/Vote.jsx';
import Screen from './routes/Screen.jsx';
import Archive from './routes/Archive.jsx';
import AdminLogin from './routes/AdminLogin.jsx';
import Admin from './routes/Admin.jsx';
import Offline from './routes/Offline.jsx';
import NotFound from './routes/NotFound.jsx';
import DevControlPanel from './components/dev/DevControlPanel.jsx';
import NavFab from './components/nav/NavFab.jsx';
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
      {/* Routes 와 형제 레벨. 라우트가 바뀜어도 재마운트되지 않고, 어느 경로에서 띄울지는 NavFab 이 직접 정한다. */}
      <NavFab />
      <Routes>
        {/* "/" 는 투표 화면이다(2026-09-22 변경). 예전에는 대형화면이었는데, 현장에서 청중이 도메인으로
            직접 들어오는 경우가 많아 대형화면을 보게 됐고, 투표하려면 우하단 "메뉴"를 눌러 이동해야 했다.
            기본값을 청중 쪽으로 돌린다. 운영자는 /screen 으로 직접 들어가거나 관리자 메뉴에서 이동한다.
            리다이렉트를 쓰지 않는다. 주소창이 바뀌지 않아야 하고, 재마운트로 realtime 소켓이 다시 붙는 과정을 만들지 않기 위해서다. */}
        <Route path="/" element={<Vote />} />
        <Route path="/vote" element={<Vote />} />
        <Route path="/screen" element={<Screen />} />
        {/* 결과 아카이브. 행사 뒤 질문별 최종 결과를 보고 이미지로 내려받는다. 운영 화면과 분리돼 있어
            여기서 무엇을 눌러도 청중·대형화면에 영향이 없다. */}
        <Route path="/archive" element={<Archive />} />
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
