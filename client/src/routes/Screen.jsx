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

// 오프닝(커버). 결과 패널과 같은 배경·Glass·좌측 정렬을 그대로 쓴다. 모듈 시작을 알리는 용도라
// 부제·버튼·QR·초록 점 전부 없다. 등장은 QR 플레이트와 같은 rise-in(.plate-in, 320ms)을 재사용한다.
// 사회자 페이스에 맞춰 어드민이 수동으로 다음 상태로 넘긴다(자동 타이머 없음).
function CoverPlate() {
  return (
    <div className="plate-in flex flex-1 flex-col justify-center">
      <p className="text-screenEyebrow text-ink">코리아 넥스트 임팩트 포럼</p>
      <p className="text-screenEyebrowWide text-ink">INTERACTIVE SESSION</p>
      <h1 className="balance mt-sub text-screenQuestion text-ink">
        <Ko>청중과 함께 그려보는 / 미래의 대학</Ko>
      </h1>
    </div>
  );
}

// 같은 집계를 다르게 배치하는 뷰일 뿐이다. 배경도 보더도 없다. 글래스 위에 텍스트만 얹는다.
// 위계는 크기로만 만든다. 색은 ink 단색이고 최다 단어만 blue 다.
function WordCloud({ items, highlight }) {
  const top = Math.max(1, ...items.map((it) => it.count ?? 0));
  const words = items.slice(0, layout.cloudWords);

  // 큰 단어가 가운데로 오게 지그재그로 넣는다. 나선이나 물리엔진 배치는 겹침과 성능 때문에 쓰지 않는다.
  const arranged = [];
  words.forEach((w, i) => (i % 2 ? arranged.push(w) : arranged.unshift(w)));

  const counts = words.map((w) => w.count ?? 0).sort((a, b) => a - b);
  const median = counts[Math.floor(counts.length / 2)] ?? 0;

  // 단어가 많을수록 전체를 줄인다. 이게 없으면 30단어에서 패널을 넘어 화면이 스크롤된다.
  const fit = Math.min(1, Math.sqrt(layout.cloudFitWords / words.length)).toFixed(4);
  const min = `calc(${layout.cloudMin} * ${fit})`;
  const max = `calc(${layout.cloudMax} * ${fit})`;

  return (
    <div
      className="mx-auto flex flex-1 flex-wrap content-center items-center justify-center"
      style={{ gap: layout.cloudGap, marginTop: layout.screenChartTop, maxWidth: layout.cloudWidth }}
    >
      {arranged.map((w) => {
        const count = w.count ?? 0;
        // sqrt 매핑. 1등이 표 수에 비례해 과하게 커지지 않는다.
        const r = Math.sqrt(count / top).toFixed(4);
        return (
          <span
            key={w.word}
            className={`cloud-word ${highlight !== null && count === highlight ? 'text-blue' : 'text-ink'}`}
            style={{
              // clamp(최소, 최대 * sqrt(비율), 최대). 꼬리 단어는 최소값에 붙고 1등만 최대값에 닿는다.
              fontSize: `clamp(${min}, calc(${layout.cloudMax} * ${fit} * ${r}), ${max})`,
              fontWeight: count >= median ? 700 : 600,
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
            }}
          >
            <Ko>{w.word}</Ko>
          </span>
        );
      })}
    </div>
  );
}

// highlight: 강조할 표 수. 단독 1등일 때만 숫자가 오고 동점·0표면 null 이라 blue 가 하나도 없다.
function BarChart({ items, totalVotes, highlight, isText }) {
  return (
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
          const lead = highlight !== null && count === highlight;
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
  );
}

/** 표시 전용. Supabase 도 세션도 모른다. */
export function ScreenView({
  question,
  results,
  liveCount = 0,
  standby = false,
  cover = false,
  resultsVisible = true,
  resultsView = 'bars',
  voteUrl = '',
  qrSize = 320,
}) {
  // 집계는 반드시 지금 띄운 질문의 것이어야 한다. 다른 질문 집계면 없는 것으로 친다.
  // 질문 전환 순간 이전 질문의 막대가 남는 걸 여기서 최종적으로 막는다.
  const matched = visibleResults(question, results);
  const items = matched?.items ?? [];
  const totalVotes = items.reduce((sum, it) => sum + (it.count ?? 0), 0);
  // 강조는 "단독 1등"일 때만 한다. 동점이면 전부 비1등 색으로 두어 1등이 없다는 사실을 색으로 드러낸다.
  // 0표(전부 0)도 같은 취급이라 blue 는 0개다.
  const top = Math.max(0, ...items.map((it) => it.count ?? 0));
  const leaders = items.filter((it) => (it.count ?? 0) === top).length;
  const highlight = top > 0 && leaders === 1 ? top : null;
  const isText = matched?.type === 'text';
  // 객관식은 뷰 설정과 무관하게 언제나 막대다. 워드클라우드는 주관식에만 의미가 있다.
  const cloud = isText && resultsView === 'cloud';

  return (
    <GlassRoot background="/images/bg/ambient-screen.webp" className="flex items-stretch justify-center p-4xl">
      <Glass variant="screen" radius="screen" className="flex w-full max-w-screen flex-col p-4xl">
        {standby ? (
          <QrPlate key="standby" url={voteUrl} size={qrSize} />
        ) : cover ? (
          <CoverPlate key="cover" />
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
                {cloud ? (
                  <WordCloud items={items} highlight={highlight} />
                ) : (
                  <BarChart items={items} totalVotes={totalVotes} highlight={highlight} isText={isText} />
                )}
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

    // 초기 진입과 재연결 보정이 같은 함수를 쓴다. 따로 두면 한쪽만 고쳐진다.
    // catch 가 없으면 조회가 한 번 실패했을 때 복구 계기가 없다. 특히 0표 질문은 broadcast 가
    // 아예 발생하지 않아 화면이 빈 채로 남는다. 1회 재시도까지 여기서 책임진다.
    const sync = (retry = 1) => {
      Promise.all([fetchQuestion(qid), fetchResults(qid), fetchLiveCount(qid)])
        .then(([q, r, c]) => {
          if (!alive) return;
          setQuestion(q);
          setResults(r);
          setLiveCount(c);
        })
        .catch(() => {
          if (alive && retry > 0) setTimeout(() => sync(retry - 1), 1000);
        });
    };
    sync();

    // broadcast 는 유실될 수 있다. 구독 payload 로 갱신하되 진입과 재연결 시 RPC 로 보정한다.
    // 채널 정리가 늦어 이전 results:{oldQid} 가 도착할 수 있어 question_id 로 거른다.
    // 재연결 보정이 없으면 끊긴 동안 들어온 표가 영영 화면에 안 올라온다(재현: DB 4표 / 화면 1표 고정).
    let joins = 0;
    const off = subscribeResults(
      qid,
      (p) => {
        if (!acceptsBroadcast(qid, p)) return;
        setResults(p.results);
        if (typeof p.live_count === 'number') setLiveCount(p.live_count);
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
  }, [qid]);

  return (
    <ScreenView
      question={question}
      results={results}
      liveCount={liveCount}
      standby={session?.status === 'standby'}
      cover={session?.status === 'cover'}
      resultsVisible={Boolean(session?.results_visible)}
      resultsView={session?.results_view ?? 'bars'}
      voteUrl={import.meta.env.VITE_VOTE_SHORT_URL || `${window.location.origin}/vote`}
      qrSize={qrSize}
    />
  );
}
