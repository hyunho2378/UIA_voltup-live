import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// 운영자 전용 이동 도구. 청중 화면에는 뜨지 않는다.
// 표지를 띄운 채 관리자로 넘어가거나, 관리자에서 대형화면으로 돌아올 때 쓴다.
// DESIGN.md 265행이 아이콘을 전면 금지하므로(lucide 포함) 라벨은 전부 텍스트다.
const NAV_PATHS = ['/', '/screen', '/admin', '/admin/login'];

// "/" 와 "/screen" 은 같은 화면이다(SCREEN_AS_ROOT). 현재 위치 표시를 하나로 묶는다.
const isScreenPath = (p) => p === '/' || p === '/screen';
const isAdminPath = (p) => p === '/admin' || p === '/admin/login';

const ITEMS = [
  { label: '대형화면', to: '/', match: isScreenPath },
  { label: '관리자', to: '/admin', match: isAdminPath },
  { label: '투표 화면', to: '/vote', match: (p) => p === '/vote' },
];

// 입력 중에는 단축키를 먹지 않는다. 어드민 패스코드 입력과 주관식 입력이 F 를 못 치면 안 된다.
function isTyping() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export default function NavFab() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);

  const allowed = NAV_PATHS.includes(pathname);

  // 전체화면 상태는 브라우저가 소유한다(ESC 로도 풀린다). 이벤트로 따라간다.
  useEffect(() => {
    const sync = () => setFull(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
      return;
    }
    // 사용자 제스처(키 입력) 안에서 부르는 것이라 권한 요구를 만족한다.
    document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  // F 키. 리스너는 허용 경로에서만 등록한다. /vote 는 애초에 등록되지 않는다.
  useEffect(() => {
    if (!allowed) return undefined;
    const onKey = (e) => {
      if (e.key !== 'f' && e.key !== 'F' && e.code !== 'KeyF') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return; // Cmd+F(찾기) 등을 가로채지 않는다
      if (isTyping()) return;
      e.preventDefault();
      toggleFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [allowed, toggleFullscreen]);

  // 경로가 바뀌면 메뉴는 닫는다.
  useEffect(() => setOpen(false), [pathname]);

  // 전체화면일 때는 숨긴다. 프로젝터에 띄운 뒤 화면을 가리지 않게 하는 것이 이 기능의 목적이다.
  if (!allowed || full) return null;

  return (
    <div className="nav-fab">
      {open ? (
        <div className="nav-fab-menu" role="menu">
          {ITEMS.map((it) => {
            const here = it.match(pathname);
            return (
              <button
                key={it.to}
                type="button"
                role="menuitem"
                aria-current={here}
                className={`press nav-fab-item ${here ? 'nav-fab-item-here' : ''}`}
                onClick={() => {
                  setOpen(false);
                  if (!here) navigate(it.to);
                }}
              >
                {it.label}
              </button>
            );
          })}
          <p className="nav-fab-hint">F 키로 전체화면</p>
        </div>
      ) : null}

      <button
        type="button"
        aria-expanded={open}
        aria-label="이동 메뉴"
        className="press nav-fab-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '닫기' : '메뉴'}
      </button>
    </div>
  );
}
