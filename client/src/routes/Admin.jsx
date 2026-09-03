import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassRoot from '../components/glass/GlassRoot.jsx';
import Glass from '../components/glass/Glass.jsx';
import GlassButton from '../components/glass/GlassButton.jsx';
import { adminLogout, control } from '../lib/admin.js';
import { useSession } from '../lib/session-context.jsx';
import { isSupabaseConfigured, fetchQuestions, fetchLiveCount } from '../lib/supabase.js';

const CONN = {
  connected: { dot: 'bg-green', text: '연결됨' },
  reconnecting: { dot: 'bg-blue', text: '다시 연결 중' },
  disconnected: { dot: 'bg-ink2', text: '끊김' },
};

const STATUS = { standby: '대기', live: '진행 중', ended: '종료', backup: '백업' };

/** 표시 전용. Supabase 도 /api 도 모른다. */
export function AdminView({
  session,
  conn = 'connected',
  questions = [],
  count = 0,
  busy = false,
  failed = false,
  onAction = () => {},
  onLogout = () => {},
}) {
  const open = Boolean(session?.voting_open);
  const shown = Boolean(session?.results_visible);
  const onBackup = session?.status === 'backup';
  const activeId = session?.active_question_id ?? null;

  const ordered = [...questions].sort((a, b) => a.order_no - b.order_no);
  const idx = ordered.findIndex((q) => q.id === activeId);
  const next = idx >= 0 ? ordered[idx + 1] : ordered[0];

  return (
    <GlassRoot background="/images/bg/ambient-admin.webp" className="admin-grid p-2xl" panelKey="admin">
      <Glass variant="regular" radius="xl" className="p-panel md:row-span-6">
        <ul className="flex flex-col gap-sm">
          {ordered.map((q) => {
            const on = q.id === activeId;
            return (
              <li key={q.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAction('set_question', q.id)}
                  aria-current={on}
                  className={`press flex min-h-touch w-full items-center gap-radio rounded-md border px-optionX py-base text-left text-body ${
                    on ? 'border-ink bg-ink text-white' : 'border-optionBorder bg-optionFill text-ink'
                  }`}
                >
                  <span className={`text-caption tabular ${on ? 'text-white' : 'text-ink'}`}>{q.order_no}</span>
                  {q.title}
                </button>
              </li>
            );
          })}
        </ul>
      </Glass>

      <GlassButton prominent={open} disabled={busy} onClick={() => onAction(open ? 'close_voting' : 'open_voting')}>
        {open ? '투표 닫기' : '투표 열기'}
      </GlassButton>

      <GlassButton prominent={shown} disabled={busy} onClick={() => onAction(shown ? 'hide_results' : 'show_results')}>
        {shown ? '결과 숨기기' : '결과 공개'}
      </GlassButton>

      <GlassButton disabled={busy || !next} onClick={() => next && onAction('set_question', next.id)}>
        다음 질문
      </GlassButton>

      <GlassButton disabled={busy} onClick={() => onAction('standby')}>
        대기 화면
      </GlassButton>

      <Glass variant="regular" radius="xl" className="p-panel">
        <p className="flex items-center gap-sm text-body text-ink">
          <span className={`h-sm w-sm rounded-full ${CONN[conn].dot}`} aria-hidden="true" />
          {CONN[conn].text}
        </p>
        <p className="mt-md text-title text-ink tabular">{count}</p>
        <p className="text-caption text-ink">응답</p>
        <p className="mt-md text-caption text-ink">{STATUS[session?.status ?? 'standby']}</p>
        {failed ? <p className="mt-md text-caption text-ink">제어에 실패했어요. 다시 눌러 주세요</p> : null}
        <button
          type="button"
          onClick={onLogout}
          className="press mt-md flex min-h-touch items-center text-caption text-ink underline"
        >
          나가기
        </button>
      </Glass>

      {/* 무대에서 빠르게 눌러야 해서 확인 다이얼로그를 두지 않는다. */}
      <GlassButton prominent={onBackup} disabled={busy} onClick={() => onAction(onBackup ? 'standby' : 'backup')}>
        {onBackup ? '라이브로 복귀' : '백업으로 전환'}
      </GlassButton>
    </GlassRoot>
  );
}

export default function Admin() {
  const navigate = useNavigate();
  const { session, conn, setSession } = useSession();
  const [questions, setQuestions] = useState([]);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const failTimer = useRef(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    fetchQuestions().then(setQuestions);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !session?.active_question_id) return;
    fetchLiveCount(session.active_question_id).then(setCount);
  }, [session?.active_question_id]);

  useEffect(() => () => clearTimeout(failTimer.current), []);

  // 낙관적 갱신 금지. 서버 응답과 Realtime 구독이 상태를 바꾼다.
  async function onAction(action, questionId) {
    setBusy(true);
    try {
      const next = await control(action, questionId);
      setSession(next);
      setFailed(false);
    } catch {
      setFailed(true);
      clearTimeout(failTimer.current);
      failTimer.current = setTimeout(() => setFailed(false), 3000);
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    await adminLogout();
    navigate('/admin/login', { replace: true });
  }

  return (
    <AdminView
      session={session}
      conn={conn}
      questions={questions}
      count={count}
      busy={busy}
      failed={failed}
      onAction={onAction}
      onLogout={onLogout}
    />
  );
}
