import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassRoot from '../components/glass/GlassRoot.jsx';
import Glass from '../components/glass/Glass.jsx';
import GlassButton from '../components/glass/GlassButton.jsx';
import { adminLogout, control, resetVotes } from '../lib/admin.js';
import { useSession } from '../lib/session-context.jsx';
import { acceptsBroadcast } from '../lib/screen-state.js';
import { isSupabaseConfigured, fetchQuestions, fetchLiveCount, subscribeResults } from '../lib/supabase.js';

const CONN = {
  connected: { dot: 'bg-green', text: '연결됨' },
  reconnecting: { dot: 'bg-blue', text: '다시 연결 중' },
  disconnected: { dot: 'bg-ink2', text: '끊김' },
};

// standby 는 "대형화면에 QR 이 떠 있는 상태"다. 진행자가 보는 말로 적는다.
const STATUS = { cover: '표지', standby: 'QR 공개', live: '진행 중', closing: '클로징', ended: '종료' };

/** 표시 전용. Supabase 도 /api 도 모른다. */
export function AdminView({
  session,
  conn = 'connected',
  questions = [],
  count = 0,
  busy = false,
  failed = false,
  note = '',
  resetArmed = false,
  endArmed = false,
  onAction = () => {},
  onReset = () => {},
  onEnd = () => {},
  onLogout = () => {},
}) {
  const open = Boolean(session?.voting_open);
  const shown = Boolean(session?.results_visible);
  const activeId = session?.active_question_id ?? null;

  const ordered = [...questions].sort((a, b) => a.order_no - b.order_no);
  const idx = ordered.findIndex((q) => q.id === activeId);
  const next = idx >= 0 ? ordered[idx + 1] : ordered[0];

  // 워드클라우드는 주관식 결과에만 의미가 있다. 객관식이거나 결과가 안 떠 있으면 토글을 감춘다.
  const cloudable = ordered[idx]?.type === 'text' && shown;
  const view = session?.results_view ?? 'bars';

  return (
    <GlassRoot background="/images/bg/ambient-admin.webp" className="admin-grid p-2xl" panelKey="admin">
      <Glass variant="regular" radius="xl" className="p-panel md:row-span-7">
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
                    on
                      ? 'border-blue bg-blue text-white'
                      : 'border-optionBorder bg-optionFill text-ink disabled:border-line disabled:bg-line'
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

      <div className="grid gap-md">
        <GlassButton prominent={shown} disabled={busy} onClick={() => onAction(shown ? 'hide_results' : 'show_results')}>
          {shown ? '결과 숨기기' : '결과 공개'}
        </GlassButton>

        {/* 같은 집계를 어떻게 배치할지만 고른다. 투표와 집계 상태는 건드리지 않는다. */}
        {cloudable ? (
          <div className="grid grid-cols-2 gap-md">
            <GlassButton prominent={view === 'bars'} disabled={busy} onClick={() => onAction('view_bars')}>
              막대
            </GlassButton>
            <GlassButton prominent={view === 'cloud'} disabled={busy} onClick={() => onAction('view_cloud')}>
              워드클라우드
            </GlassButton>
          </div>
        ) : null}
      </div>

      <GlassButton disabled={busy || !next} onClick={() => next && onAction('set_question', next.id)}>
        다음 질문
      </GlassButton>

      {/* 진행 순서 그대로 둔다. 표지로 시작해서 QR 을 여는 게 행사 당일 순서다.
          둘 다 어느 상태에서든 누를 수 있다. 리허설 중 표지로 되돌아가는 일이 있기 때문이다. */}
      <div className="grid grid-cols-2 gap-md">
        <GlassButton prominent={session?.status === 'cover'} disabled={busy} onClick={() => onAction('cover')}>
          표지 화면
        </GlassButton>
        <GlassButton prominent={session?.status === 'standby'} disabled={busy} onClick={() => onAction('standby')}>
          QR 열기
        </GlassButton>
      </div>

      {/* 마지막 순서. 교수님 마무리 뒤에 누른다. 질문과 무관하게 언제든 전환할 수 있다. */}
      <GlassButton prominent={session?.status === 'closing'} disabled={busy} onClick={() => onAction('closing')}>
        클로징 화면
      </GlassButton>

      <Glass variant="regular" radius="xl" className="p-panel">
        <p className="flex items-center gap-sm text-body text-ink">
          <span className={`h-sm w-sm rounded-full ${CONN[conn].dot}`} aria-hidden="true" />
          {CONN[conn].text}
        </p>
        <p className="mt-md text-title text-ink tabular">{count}</p>
        <p className="text-caption text-ink">응답</p>
        <p className="mt-md text-caption text-ink">{STATUS[session?.status ?? 'cover']}</p>
        {failed ? <p className="mt-md text-caption text-ink">제어에 실패했어요. 다시 눌러 주세요</p> : null}
        {note ? <p className="mt-md text-caption text-ink">{note}</p> : null}
        <button
          type="button"
          onClick={onLogout}
          className="press mt-md flex min-h-touch items-center text-caption text-ink underline"
        >
          나가기
        </button>
      </Glass>

      {/* 초기화. 리허설에서 반복해 눌러야 하므로 이 질문은 확인 없이 즉시 실행한다.
          전체는 무대 사고가 되므로 한 번 더 누르는 것만 요구한다(3초 뒤 저절로 풀린다). */}
      <div className="grid grid-cols-2 gap-md">
        <GlassButton disabled={busy || !activeId} onClick={() => onReset('question')}>
          이 질문 초기화
        </GlassButton>
        <GlassButton prominent={resetArmed} disabled={busy} onClick={() => onReset('all')}>
          {resetArmed ? '한 번 더 누르면 전체 삭제' : '전체 초기화'}
        </GlassButton>
      </div>

      {/* 세션 종료. 되돌릴 수 없으므로 한 번 더 누르게 하고, 위험을 색이 아니라 여백으로 표시한다.
          같은 크기·같은 톤을 유지한다. 종료 뒤 '대기 화면'을 누르면 standby 로 돌아간다. */}
      <GlassButton prominent={endArmed} disabled={busy} onClick={onEnd} className="mt-md">
        {endArmed ? '한 번 더 누르면 세션 종료' : '세션 종료'}
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
  const [note, setNote] = useState('');
  const [resetArmed, setResetArmed] = useState(false);
  const [endArmed, setEndArmed] = useState(false);
  const failTimer = useRef(null);
  const noteTimer = useRef(null);
  const armTimer = useRef(null);
  const endTimer = useRef(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    fetchQuestions().then(setQuestions);
  }, []);

  // 응답 수는 진행자가 "지금 닫아도 되나"를 판단하는 유일한 지표다. 질문 전환 시 1회 조회만 하면
  // 투표가 들어오는 동안 0 에서 움직이지 않는다. /screen 과 같은 results:{qid} broadcast 를 써 갱신한다.
  // 어드민은 1명이라 채널 1개가 늘고(같은 소켓 위 다중화) 청중 연결 수에는 영향이 없다.
  useEffect(() => {
    const qid = session?.active_question_id;
    if (!isSupabaseConfigured || !qid) {
      setCount(0);
      return undefined;
    }
    let alive = true;
    setCount(0);
    // Screen 과 같은 규칙: 초기 조회와 재연결 보정이 한 함수를 쓰고, 실패하면 1회 재시도한다.
    const sync = (retry = 1) => {
      fetchLiveCount(qid)
        .then((v) => alive && setCount(v))
        .catch(() => {
          if (alive && retry > 0) setTimeout(() => sync(retry - 1), 1000);
        });
    };
    sync();

    // 재연결 보정. 끊긴 동안의 broadcast 는 재조인해도 다시 오지 않는다(Screen 과 같은 규칙).
    let joins = 0;
    const off = subscribeResults(
      qid,
      (p) => {
        if (!acceptsBroadcast(qid, p)) return;
        if (typeof p.live_count === 'number') setCount(p.live_count);
      },
      (status) => {
        if (status !== 'connected') return;
        joins += 1;
        if (joins === 1) return; // 최초 조인은 위 sync 가 이미 보정했다
        sync();
      },
    );
    return () => {
      alive = false;
      off();
    };
  }, [session?.active_question_id]);

  useEffect(
    () => () => {
      clearTimeout(failTimer.current);
      clearTimeout(noteTimer.current);
      clearTimeout(armTimer.current);
      clearTimeout(endTimer.current);
    },
    [],
  );

  function showNote(text) {
    setNote(text);
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(''), 2000);
  }

  function fail() {
    setFailed(true);
    clearTimeout(failTimer.current);
    failTimer.current = setTimeout(() => setFailed(false), 3000);
  }

  // 낙관적 갱신 금지. 서버 응답과 Realtime 구독이 상태를 바꾼다.
  async function onAction(action, questionId) {
    setBusy(true);
    try {
      const next = await control(action, questionId);
      setSession(next);
      setFailed(false);
    } catch {
      fail();
    } finally {
      setBusy(false);
    }
  }

  async function onReset(scope) {
    // 전체는 두 번 눌러야 실행된다. 첫 번째 누름은 무장만 하고 3초 뒤 저절로 풀린다.
    if (scope === 'all' && !resetArmed) {
      setResetArmed(true);
      clearTimeout(armTimer.current);
      armTimer.current = setTimeout(() => setResetArmed(false), 3000);
      return;
    }
    clearTimeout(armTimer.current);
    setResetArmed(false);

    setBusy(true);
    try {
      const body = await resetVotes(scope, session?.active_question_id);
      if (body?.session) setSession(body.session);
      if (scope === 'question') setCount(0);
      setFailed(false);
      showNote('초기화했어요');
    } catch {
      fail();
    } finally {
      setBusy(false);
    }
  }

  // 세션 종료도 전체 초기화와 같은 2단 확인이다. 무대에서 손이 미끄러져 행사가 끝나버리면 되돌릴 수 없다.
  async function onEnd() {
    if (!endArmed) {
      setEndArmed(true);
      clearTimeout(endTimer.current);
      endTimer.current = setTimeout(() => setEndArmed(false), 3000);
      return;
    }
    clearTimeout(endTimer.current);
    setEndArmed(false);
    setBusy(true);
    try {
      setSession(await control('end'));
      setFailed(false);
      showNote('세션을 종료했어요');
    } catch {
      fail();
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
      note={note}
      resetArmed={resetArmed}
      endArmed={endArmed}
      onAction={onAction}
      onReset={onReset}
      onEnd={onEnd}
      onLogout={onLogout}
    />
  );
}
