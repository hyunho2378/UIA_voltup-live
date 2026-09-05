import { useEffect, useState } from 'react';
import { useSession } from '../../lib/session-context.jsx';
import { isSupabaseConfigured, fetchQuestions } from '../../lib/supabase.js';
import { colors, spacing, radius, typography, zIndex } from '../../tokens.js';

// 개발 전용. vercel dev 없이 세션 상태를 넘기기 위한 도구다.
// 앱 재질(글래스)과 섞이면 안 되므로 일부러 투박한 솔리드 다크로 둔다.
// 스타일을 tailwind 클래스가 아니라 토큰 인라인으로 쓰는 이유: 이 파일 전용 유틸리티가
// 프로덕션 CSS 에 섞여 들어가지 않게 하려고. import.meta.env.DEV 게이트로 JS 는 이미 빠진다.
const S = {
  panel: {
    position: 'fixed',
    bottom: spacing.base,
    right: spacing.base,
    zIndex: zIndex.toast,
    width: '220px',
    background: colors.ink,
    color: colors.white,
    borderRadius: radius.md,
    padding: spacing.base,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.leading,
    fontVariantNumeric: 'tabular-nums',
  },
  muted: { color: colors.ink2, margin: 0 },
  line: { color: colors.white, margin: `${spacing.sm} 0 0` },
  grid: { display: 'grid', gap: spacing.xs, marginTop: spacing.md },
  btn: {
    appearance: 'none',
    font: 'inherit',
    textAlign: 'left',
    color: colors.white,
    background: 'transparent',
    border: `1px solid ${colors.ink2}`,
    borderRadius: radius.sm,
    padding: `${spacing.sm} ${spacing.md}`,
    cursor: 'pointer',
  },
};

export default function DevControlPanel() {
  const { session, setSession } = useSession();
  const [questions, setQuestions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    fetchQuestions().then(setQuestions).catch(() => {});
  }, []);

  async function post(payload) {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/__dev__/session-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error || String(r.status));
      // 세션 제어는 sessions 행을, 초기화는 {ok:true} 를 돌려준다. 행일 때만 반영한다.
      if (body?.id) setSession(body);
      else if (body?.session) setSession(body.session);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const run = (action, questionId) => post({ action, questionId });

  const open = Boolean(session?.voting_open);
  const shown = Boolean(session?.results_visible);
  const ordered = [...questions].sort((a, b) => a.order_no - b.order_no);
  const idx = ordered.findIndex((q) => q.id === session?.active_question_id);
  const next = idx >= 0 ? ordered[idx + 1] : ordered[0];
  const current = idx >= 0 ? ordered[idx] : null;

  const Btn = ({ onClick, disabled, children }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      style={{ ...S.btn, opacity: busy || disabled ? 0.45 : 1 }}
    >
      {children}
    </button>
  );

  return (
    <aside style={S.panel}>
      <p style={S.muted}>이 패널은 개발 전용입니다</p>
      <p style={S.line}>
        {current ? `Q${current.order_no}` : 'Q-'} / {session?.status ?? '-'}
      </p>
      <p style={{ ...S.muted, marginTop: spacing.xs }}>
        voting {String(open)} / results {String(shown)}
      </p>

      <div style={S.grid}>
        <Btn onClick={() => run(open ? 'close_voting' : 'open_voting')}>{open ? '투표 닫기' : '투표 열기'}</Btn>
        <Btn onClick={() => run(shown ? 'hide_results' : 'show_results')}>{shown ? '결과 숨기기' : '결과 공개'}</Btn>
        <Btn disabled={!next} onClick={() => next && run('set_question', next.id)}>다음 질문</Btn>
        <Btn onClick={() => run('standby')}>대기로</Btn>
        <Btn
          disabled={!current}
          onClick={() => post({ action: 'reset', scope: 'question', questionId: session?.active_question_id })}
        >
          이 질문 초기화
        </Btn>
      </div>

      {error ? <p style={S.line}>{error}</p> : null}
    </aside>
  );
}
