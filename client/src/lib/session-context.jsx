import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase, fetchSession, subscribeSession } from './supabase.js';

// sessions 구독을 앱 전체에서 하나만 연다. 라우트마다 채널을 열면
// 무료 티어 동시 연결과 초당 채널 조인을 그만큼 더 쓴다.
const Ctx = createContext({ session: null, conn: 'connected', offline: false, setSession: () => {} });

const OFFLINE_AFTER_MS = 8000;
const LINK_POLL_MS = 2000;

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [channelStatus, setChannelStatus] = useState(isSupabaseConfigured ? 'reconnecting' : 'connected');
  const [linkUp, setLinkUp] = useState(true);
  const [offline, setOffline] = useState(false);
  const timer = useRef(null);
  const joins = useRef(0);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    fetchSession().then(setSession).catch(() => {});
    // 재연결 보정. 소켓이 끊긴 동안 일어난 sessions 변경은 채널을 다시 조인해도 재전송되지 않는다.
    // 보정이 없으면 잠깐 끊겼던 폰이 마감된 질문을 계속 열어둔 채로 남는다(재현: 차단 20초 후에도 수렴 0).
    // 두 번째 이후 SUBSCRIBED(=재조인)일 때만 현재 상태를 다시 읽는다. 최초 진입은 위 fetchSession 이 담당한다.
    return subscribeSession(setSession, (status) => {
      setChannelStatus(status);
      if (status !== 'connected') return;
      joins.current += 1;
      if (joins.current > 1) fetchSession().then(setSession).catch(() => {});
    });
  }, []);

  // 채널 subscribe 콜백만으로는 소켓이 끊긴 걸 못 잡는다(끊겨도 콜백이 안 온다).
  // 소켓 상태와 navigator.onLine 을 같이 본다.
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    const tick = () => setLinkUp(navigator.onLine && supabase.realtime.isConnected());
    tick();
    const iv = setInterval(tick, LINK_POLL_MS);
    window.addEventListener('online', tick);
    window.addEventListener('offline', tick);
    return () => {
      clearInterval(iv);
      window.removeEventListener('online', tick);
      window.removeEventListener('offline', tick);
    };
  }, []);

  const conn = !linkUp ? 'disconnected' : channelStatus;

  // connected 가 아닌 상태가 8초 이어지면 오프라인으로 본다. 복구되면 바로 되돌린다.
  useEffect(() => {
    clearTimeout(timer.current);
    if (conn === 'connected') {
      setOffline(false);
      return undefined;
    }
    timer.current = setTimeout(() => setOffline(true), OFFLINE_AFTER_MS);
    return () => clearTimeout(timer.current);
  }, [conn]);

  return <Ctx.Provider value={{ session, conn, offline, setSession }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
