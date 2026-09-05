// 개발 전용 갤러리. Supabase, 세션, 어드민을 전혀 호출하지 않는다.
// 모든 화면 상태를 목업 데이터로 한 페이지에 실물 렌더해 디자인을 반복해서 보기 위한 도구다.
// import.meta.env.DEV 게이트 안에서만 라우팅되고 프로덕션 번들에는 남지 않는다.
import { GlassModeProvider } from '../components/glass/GlassRoot.jsx';
import { VoteView } from './Vote.jsx';
import { ScreenView } from './Screen.jsx';
import { AdminView } from './Admin.jsx';
import { LandingView } from './Landing.jsx';
import AdminLogin from './AdminLogin.jsx';
import { sampleQuestions, buildMocks } from '../mock/sample-questions.js';
import { colors, spacing, radius, typography } from '../tokens.js';

const S = {
  page: {
    background: colors.ink,
    minHeight: '100dvh',
    padding: spacing.xl,
    color: colors.white,
    fontSize: typography.caption.size,
    lineHeight: typography.caption.leading,
  },
  h1: { margin: 0, fontSize: typography.title.size, fontWeight: 600, color: colors.white },
  note: { margin: `${spacing.xs} 0 ${spacing['2xl']}`, color: colors.ink2 },
  h2: {
    margin: `${spacing['2xl']} 0 ${spacing.base}`,
    fontSize: typography.body.size,
    fontWeight: 600,
    color: colors.white,
  },
  row: { display: 'flex', flexWrap: 'wrap', gap: spacing.lg, alignItems: 'flex-start' },
  cap: { margin: `0 0 ${spacing.sm}`, color: colors.ink2 },
  clip: { overflow: 'hidden', borderRadius: radius.sm, background: colors.white },
};

function Frame({ label, w, h, scale = 1, children }) {
  return (
    <figure style={{ margin: 0 }}>
      <figcaption style={S.cap}>{label}</figcaption>
      <div style={{ ...S.clip, width: Math.round(w * scale), height: Math.round(h * scale) }}>
        <div
          className="preview-stage"
          style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          {children}
        </div>
      </div>
    </figure>
  );
}

const Vote = (props) => (
  <Frame w={390} h={760} {...props.frame}>
    <VoteView total={props.total} {...props.view} />
  </Frame>
);

export default function Preview() {
  // 모듈 최상단에 두면 rollup 이 순수하다고 판정하지 못해 프로덕션 번들에 문자열이 남는다.
  // 전부 컴포넌트 안으로 넣어야 DEV 게이트에서 통째로 사라진다.
  const [q1, q2, , , q5] = sampleQuestions;
  const TOTAL = sampleQuestions.length;
  const { results: mockResults, counts: mockCounts } = buildMocks();
  const VOTE_URL = 'https://voltup.live/vote';
  const SCREEN_QR = Math.round(1080 * 0.38);
  const MOCK_SESSION = {
    active_question_id: 's2',
    voting_open: true,
    results_visible: false,
    status: 'live',
  };

  return (
    <GlassModeProvider value="css">
      {/* Preview 전용 스타일. 프로덕션 CSS 를 늘리지 않으려고 여기 인라인으로 둔다. */}
      <style>{`.preview-stage .glass-root{min-height:100%;height:100%}`}</style>

      <div style={S.page}>
        <h1 style={S.h1}>화면 상태 갤러리</h1>
        <p style={S.note}>
          개발 전용. 목업 데이터로만 그린다. 재질은 CSS 글래스로 고정(실제 WebGL 재질은 /vote /screen /admin 에서 확인).
        </p>

        <h2 style={S.h2}>청중 / /vote / 390</h2>
        <div style={S.row}>
          <Vote total={TOTAL} frame={{ label: '대기' }} view={{ question: q1, state: 'waiting' }} />
          <Vote total={TOTAL} frame={{ label: '투표 / 미선택' }} view={{ question: q1, state: 'voting' }} />
          <Vote total={TOTAL} frame={{ label: '투표 / 선택됨' }} view={{ question: q1, state: 'voting', choice: 's1a' }} />
          <Vote total={TOTAL} frame={{ label: '완료' }} view={{ question: q1, state: 'done' }} />
          <Vote total={TOTAL} frame={{ label: '이미 투표함' }} view={{ question: q1, state: 'done', notice: '이미 투표했어요' }} />
          <Vote total={TOTAL} frame={{ label: '주관식 입력' }} view={{ question: q5, state: 'voting', text: '연결' }} />
          <Vote total={TOTAL} frame={{ label: '주관식 제출완료' }} view={{ question: q5, state: 'done' }} />
        </div>

        <h2 style={S.h2}>대형화면 / /screen / 1920 x 1080 (0.42배)</h2>
        <div style={S.row}>
          <Frame label="대기 / QR" w={1920} h={1080} scale={0.42}>
            <ScreenView standby voteUrl={VOTE_URL} qrSize={SCREEN_QR} />
          </Frame>
          <Frame label="결과 / 객관식 박빙" w={1920} h={1080} scale={0.42}>
            <ScreenView question={q1} results={mockResults.close} liveCount={mockCounts.close} resultsVisible />
          </Frame>
          <Frame label="결과 / 객관식 압도적 1등" w={1920} h={1080} scale={0.42}>
            <ScreenView question={q2} results={mockResults.landslide} liveCount={mockCounts.landslide} resultsVisible />
          </Frame>
          <Frame label="결과 / 주관식 빈도" w={1920} h={1080} scale={0.42}>
            <ScreenView question={q5} results={mockResults.text} liveCount={mockCounts.text} resultsVisible />
          </Frame>
          <Frame label="결과 미공개 / 질문만" w={1920} h={1080} scale={0.42}>
            <ScreenView question={q2} results={mockResults.landslide} resultsVisible={false} />
          </Frame>
        </div>

        <h2 style={S.h2}>어드민 / 1280 x 800 (0.55배)</h2>
        <div style={S.row}>
          <Frame label="로그인" w={1280} h={800} scale={0.55}>
            <AdminLogin />
          </Frame>
          <Frame label="제어 / 연결됨" w={1280} h={800} scale={0.55}>
            <AdminView session={MOCK_SESSION} conn="connected" questions={sampleQuestions} count={128} />
          </Frame>
          <Frame label="제어 / 다시 연결 중" w={1280} h={800} scale={0.55}>
            <AdminView session={MOCK_SESSION} conn="reconnecting" questions={sampleQuestions} count={128} />
          </Frame>
          <Frame label="제어 / 끊김" w={1280} h={800} scale={0.55}>
            <AdminView
              session={{ ...MOCK_SESSION, results_visible: true }}
              conn="disconnected"
              questions={sampleQuestions}
              count={128}
              failed
            />
          </Frame>
        </div>

        <h2 style={S.h2}>랜딩 / 390</h2>
        <div style={S.row}>
          <Frame label="진행 중" w={390} h={760}>
            <LandingView />
          </Frame>
          <Frame label="종료" w={390} h={760}>
            <LandingView ended />
          </Frame>
        </div>
      </div>
    </GlassModeProvider>
  );
}
