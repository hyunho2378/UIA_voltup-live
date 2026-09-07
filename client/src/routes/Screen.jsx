import { useEffect, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import GlassRoot from '../components/glass/GlassRoot.jsx';
import Glass from '../components/glass/Glass.jsx';
import Ko from '../components/glass/Ko.jsx';
import { layout, motion } from '../tokens.js';
import { useSession } from '../lib/session-context.jsx';
import { acceptsBroadcast, visibleResults } from '../lib/screen-state.js';
import {
  isSupabaseConfigured,
  fetchQuestion,
  fetchResults,
  fetchLiveCount,
  subscribeResults,
} from '../lib/supabase.js';

const ALPHA = 'ABCDEFGH';

export function useQrSize() {
  const [size, setSize] = useState(320);
  useEffect(() => {
    const calc = () =>
      setSize(Math.round(Math.min(window.innerWidth, window.innerHeight) * layout.qrRatio));
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);
  return size;
}

// QR 은 오브젝트라 가운데 배치가 예외로 허용된다. 안내 문구와 주소 텍스트는 두지 않는다.
// 화면 앞의 사람에게 필요한 건 찍을 대상 하나뿐이다.
function QrPlate({ url, size }) {
  return (
    <div className="enter flex flex-1 items-center justify-center">
      {/* 스캔 가독성이 재질보다 우선이라 QR 플레이트는 글래스에 올리지 않는다. */}
      <div className="plate-in rounded-lg bg-white p-2xl">
        <span className="qr-in block">
          <QRCodeCanvas value={url} size={size} level="M" includeMargin={false} />
        </span>
      </div>
    </div>
  );
}

/** 표시 전용. Supabase 도 세션도 모른다. */
export function ScreenView({
  question,
  results,
  liveCount = 0,
  standby = false,
  resultsVisible = true,
  voteUrl = '',
  qrSize = 320,
}) {
  // 집계는 반드시 지금 띄운 질문의 것이어야 한다. 다른 질문 집계면 없는 것으로 친다.
  // 질문 전환 순간 이전 질문의 막대가 남는 걸 여기서 최종적으로 막는다.
  const matched = visibleResults(question, results);
  const items = matched?.items ?? [];
  const totalVotes = items.reduce((sum, it) => sum + (it.count ?? 0), 0);
  const top = Math.max(0, ...items.map((it) => it.count ?? 0));
  const isText = matched?.type === 'text';

  return (
    <GlassRoot background="/images/bg/ambient-screen.webp" className="flex items-stretch justify-center p-4xl">
      <Glass variant="screen" radius="screen" className="flex w-full max-w-screen flex-col p-4xl">
        {standby ? (
          <QrPlate key="standby" url={voteUrl} size={qrSize} />
        ) : (
          <div key={`live-${question?.id ?? ''}`} className="enter flex flex-1 flex-col">
            <div className="flex items-start justify-between gap-2xl">
              <h1 className="balance text-screenQuestion text-ink">
                <Ko>{question?.title ?? ''}</Ko>
              </h1>
              <span className="live-dot mt-md h-md w-md shrink-0 rounded-full bg-green" aria-label="실시간" />
            </div>

            {resultsVisible && items.length > 0 ? (
              <>
                <div className="flex flex-1 flex-col justify-center" style={{ marginTop: layout.screenChartTop }}>
                  {/* 단일 grid. 행마다 독립 grid 를 쓰면 라벨 열 폭이 제각각이라 막대 시작점이 어긋난다.
                      행 래퍼는 display:contents 라 셀들이 부모 grid 에 직접 들어간다. */}
                  <div
                    className="grid flex-1"
                    style={{
                      gridTemplateColumns: layout.chartCols,
                      // column-gap 을 쓰면 행 hairline 이 열 사이에서 끊긴다. 간격은 셀 왼쪽 padding 으로 준다.
                      columnGap: 0,
                      gridAutoRows: '1fr',
                      minHeight: `calc(${layout.chartRowMin} * ${items.length})`,
                      maxHeight: `calc(${layout.chartRowMax} * ${items.length})`,
                    }}
                  >
                    {items.map((it, i) => {
                      const count = it.count ?? 0;
                      const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
                      const lead = count === top && top > 0;
                      const line = i ? 'border-t border-rowLine' : '';
                      return (
                        <div key={it.option_id ?? it.word} className="contents">
                          <div className={`${line} flex items-center`}>
                            <span className="text-screenKey text-ink tabular">{isText ? '' : ALPHA[i]}</span>
                          </div>
                          <div className={`${line} flex items-center`} style={{ paddingLeft: layout.chartGap }}>
                            <p className="text-screenLabel text-ink">
                              <Ko>{it.label ?? it.word}</Ko>
                            </p>
                          </div>
                          <div className={`${line} flex items-center`} style={{ paddingLeft: layout.chartGap }}>
                            <div
                              className="w-full overflow-hidden rounded-bar bg-barTrack"
                              style={{ height: layout.screenBarHeight }}
                            >
                              <div
                                className={`bar-fill h-full rounded-bar ${lead ? 'bg-blue bar-lead' : 'bg-inkSoft'}`}
                                style={{
                                  '--bar': totalVotes ? count / totalVotes : 0,
                                  '--bar-delay': `calc(${i} * ${motion.stagger})`,
                                }}
                              />
                            </div>
                          </div>
                          <div className={`${line} flex items-center`} style={{ paddingLeft: layout.chartGap }}>
                            <p
                              className="flex items-baseline text-screenPct text-ink tabular"
                              style={{ gap: layout.chartValueGap }}
                            >
                              {pct}%
                              <span className="text-screenVotes text-ink tabular">{count}표</span>
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <p className="mt-xl text-screenMeta text-ink tabular">{liveCount}명 참여</p>
              </>
            ) : null}
          </div>
        )}
      </Glass>
    </GlassRoot>
  );
}

export default function Screen() {
  const { session } = useSession();
  const [question, setQuestion] = useState(null);
  const [results, setResults] = useState(null);
  const [liveCount, setLiveCount] = useState(0);
  const qrSize = useQrSize();

  const qid = session?.active_question_id;

  useEffect(() => {
    if (!isSupabaseConfigured || !qid) return undefined;
    // 먼저 비운다. fetch 가 async 라 비우지 않으면 새 값이 올 때까지 이전 질문 막대가 남는다.
    setQuestion(null);
    setResults(null);
    setLiveCount(0);

    // 이전 질문의 fetch 가 뒤늦게 도착해 새 질문 위에 덮어쓰는 걸 막는다.
    let alive = true;
    fetchQuestion(qid).then((v) => alive && setQuestion(v));
    fetchResults(qid).then((v) => alive && setResults(v));
    fetchLiveCount(qid).then((v) => alive && setLiveCount(v));

    // broadcast 는 유실될 수 있다. 구독 payload 로 갱신하되 진입과 재연결 시 위에서 보정한다.
    // 채널 정리가 늦어 이전 results:{oldQid} 가 도착할 수 있어 question_id 로 거른다.
    const off = subscribeResults(qid, (p) => {
      if (!acceptsBroadcast(qid, p)) return;
      setResults(p.results);
      if (typeof p.live_count === 'number') setLiveCount(p.live_count);
    });
    return () => {
      alive = false;
      off();
    };
  }, [qid]);

  return (
    <ScreenView
      question={question}
      results={results}
      liveCount={liveCount}
      standby={session?.status === 'standby'}
      resultsVisible={Boolean(session?.results_visible)}
      voteUrl={import.meta.env.VITE_VOTE_SHORT_URL || `${window.location.origin}/vote`}
      qrSize={qrSize}
    />
  );
}
