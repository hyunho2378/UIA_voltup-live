import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import GlassRoot from '../components/glass/GlassRoot.jsx';
import Glass from '../components/glass/Glass.jsx';
import Ko from '../components/glass/Ko.jsx';
import { layout, motion, typography } from '../tokens.js';
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

// Q4 전용 보조 캡션. Vote.jsx 의 TEXT_CAPTION 과 같은 문구다(SOURCE.md). 화면이 단일 번들이라
// 중복 정의를 감수하고 있다. 질문이 늘어나면 이 값도 스키마 컬럼으로 올려야 한다.
const TEXT_CAPTION = '내가 생각하는 미래의 대학은 ______이다.';

// 넣은 것이 패널을 넘치면 줄여서 맞춤다. 계산식으로는 맞출 수 없다. 단어 수·글자 수·줄바꿈
// 위치·선택지 개수가 매번 달라져서, 그려 놓고 실측해 줄이는 것만이 모든 경우를 덮는다.
// --fit 는 이 요소 안 글자 크기에 곱해진다. 8번까지만 줄인다(0.92^8 = 0.51배).
// 그 아래로 내려가면 20m 에서 읽을 수 없어 줄이나 마나다.
function useFitScale(ref, signature) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => {
      let s = 1;
      el.style.setProperty('--fit', '1');
      for (let i = 0; i < 8 && el.scrollHeight > el.clientHeight + 1; i += 1) {
        s *= 0.92;
        el.style.setProperty('--fit', String(s));
      }
    };
    fit();
    // 창 크기가 바뀌면 줄 수와 행 높이가 달라진다. 프로젝터 연결·전체화면 진입이 여기에 해당한다.
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, signature]);
}

// 클로징 QR 이 가리키는 곳. 청중 투표 URL(VITE_VOTE_SHORT_URL)과 무관한 별도 주소다.
const CLOSING_URL = 'https://wgjforum.kr/kor/sub03/registration.html';

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

// 오프닝(커버). 결과 패널과 같은 배경·Glass 를 그대로 쓰고 내용만 다르다.
// 브랜드 자산 3개를 올린다. lg(1024) 이상은 로고·타이틀이 왼쪽, 그래픽이 오른쪽이고,
// 미만은 세로로 쌓은다. /screen 은 1920 기준 설계지만 운영자가 폰으로 미리보거나 관객이
// 직접 링크를 열었을 때 좌우 2단이 맞붙아 깨지는 것을 막는다.
// 세 자산 모두 글래스 패널 "안"에 둔다. 뒤에 두면 굴절·blur 를 타서 뚜렷해지고,
// 라이브러리가 root 직계 자식만 배경으로 잡는 구조라 중간 래퍼도 못 둔다.
// 등장은 QR 플레이트와 같은 rise-in(.plate-in, 320ms)을 재사용한다.
function CoverPlate() {
  return (
    <div className="plate-in flex flex-1 flex-col items-center gap-2xl overflow-y-auto lg:flex-row lg:items-center lg:gap-4xl lg:overflow-visible">
      <div className="flex w-full min-w-0 flex-col justify-center lg:flex-1">
        {/* 로고·타이틀은 오브젝트라 이미지로 둔다. 원본 색을 그대로 쓰지 않고
            brandRamp 로 다시 칠한 산출물이다(scripts/brand-assets.mjs). 이 세션은 포럼 전체가 아니라
            5모듈 하나라 로고·타이틀을 작게 쓰고 아래 모듈 태그로 위계를 보완한다. */}
        <img
          src="/images/brand/logo.svg"
          alt="UIA"
          className="w-full object-contain object-left"
          style={{ maxWidth: layout.coverLogoMax }}
        />
        <img
          src="/images/brand/title.svg"
          alt="2026 UIA x 한양대학교 NEXT IMPACT FORUM"
          className="mt-4xl w-full object-contain object-left"
          style={{ maxWidth: layout.coverTitleMax }}
        />
        {/* 모듈 태그 2행. 영어(작고 넓은 트래킹)은 태그, 한글(굵고 강조)은 실제 세션명이다.
            둘 사이 간격을 명시적으로 둔다(mt-md). 기본 행간만으로는 둘이 붙어 보였다. */}
        <p className="mt-4xl text-screenModuleEn text-ink">MODULE 05</p>
        {/* 큐시트 대본 표기 그대로("인터렉티브"). 사회자 오프닝 대사와 글자를 맞춘다. */}
        <p className="mt-md text-screenModuleKr text-ink">인터렉티브 세션</p>
        <h1 className="balance mt-xl text-screenQuestion text-ink">
          <Ko>청중과 함께 그려보는 미래의 대학</Ko>
        </h1>
      </div>
      {/* 세로로 긴 그림이라 패널 높이를 기준으로 잡는다. 문자열이 아니라 장식이므로 alt 는 비운다.
          lg 미만(세로 스택)에서는 행 폭 기준 30% 규칙이 의미가 없어 별도 토큰(coverGraphicSm)을 쓴다. */}
      <img
        src="/images/brand/graphic.webp"
        alt=""
        aria-hidden="true"
        className="min-h-0 max-w-coverGraphicSm max-h-coverGraphicSm shrink-0 self-center object-contain lg:max-w-coverGraphic lg:max-h-coverGraphic"
      />
    </div>
  );
}

// 클로징(홍보). 교수님 마무리 뒤에 띄우는 마지막 화면이다.
// 로고와 QR 은 둘 다 오브젝트라 가운데 배치를 허용한다(DESIGN 정렬 예외, QR 플레이트와 같은 근거).
// QR 은 스캔 가독성이 재질보다 우선이라 대기 화면과 동일하게 흰 플레이트 위에 올린다.
function ClosingPlate({ url, size }) {
  return (
    <div className="plate-in flex flex-1 flex-col items-center justify-center gap-4xl">
      {/* min-h-0 이 없으면 flex 아이템이 줄지 않아 세로가 짧은 화면에서 패널을 넘는다. */}
      <img
        src="/images/wgj-2026.png"
        alt="2026 세계경주포럼"
        className="min-h-0 w-full object-contain"
        style={{ maxWidth: layout.closingLogoMax, maxHeight: layout.closingLogoMaxH }}
      />
      <div className="rounded-lg bg-white p-2xl">
        <QRCodeCanvas value={url} size={size} level="M" includeMargin={false} />
      </div>
    </div>
  );
}

// 같은 집계를 다르게 배치하는 뷰일 뿐이다. 배경도 보더도 없다. 글래스 위에 텍스트만 얹는다.
// 위계는 크기로만 만든다. 색은 ink 단색이고 최다 단어만 blue 다.
function WordCloud({ items, highlight }) {
  const boxRef = useRef(null);
  const top = Math.max(1, ...items.map((it) => it.count ?? 0));
  const words = items.slice(0, layout.cloudWords);
  useFitScale(boxRef, words.map((w) => `${w.word}:${w.count ?? 0}`).join('|'));

  // 큰 단어가 가운데로 오게 지그재그로 넣는다. 나선이나 물리엔진 배치는 겹침과 성능 때문에 쓰지 않는다.
  const arranged = [];
  words.forEach((w, i) => (i % 2 ? arranged.push(w) : arranged.unshift(w)));

  const counts = words.map((w) => w.count ?? 0).sort((a, b) => a - b);
  const median = counts[Math.floor(counts.length / 2)] ?? 0;

  // 긴 단어는 줄이지 않으면 칩 하나가 화면 폭을 다 잡아먹는다(실측: 12자 단어가 칩 안에서
  // 두 줄로 갈라졌다). 기준 길이보다 길면 길이에 반비례해 줄인다.
  const LEN_REF = layout.cloudLengthRef;
  const lenFit = (word) => Math.min(1, LEN_REF / Math.max(1, [...String(word ?? '')].length));

  // 단어가 많을수록 전체를 줄인다. 이게 없으면 30단어에서 패널을 넘어 화면이 스크롤된다.
  // 보정은 최댓값에만 건다. 하한까지 같이 줄이면 꼬리 단어가 20m 에서 안 보이는 크기까지 내려간다
  // (실측: 19단어일 때 꼬리가 21px). 줄이는 건 제일 큰 단어만으로 충분하다.
  const fit = Math.min(1, Math.sqrt(layout.cloudFitWords / words.length)).toFixed(4);
  const min = layout.cloudMin;
  const max = `calc(${layout.cloudMax} * ${fit})`;

  return (
    <div
      ref={boxRef}
      // min-h-0 과 overflow-hidden 이 없으면 넘친 만큼 패널이 늘어나 화면이 스크롤된다.
      // 넘침을 컨테이너 안에 가둬야 위 useLayoutEffect 의 높이 측정이 성립한다.
      className="mx-auto flex min-h-0 flex-1 flex-wrap content-center items-center justify-center overflow-hidden"
      style={{ gap: layout.cloudGap, marginTop: layout.screenChartTop, maxWidth: layout.cloudWidth }}
    >
      {arranged.map((w) => {
        const count = w.count ?? 0;
        // sqrt 매핑. 1등이 표 수에 비례해 과하게 커지지 않는다.
        const r = (Math.sqrt(count / top) * lenFit(w.word)).toFixed(4);
        // clamp 의 하한이 상한보다 커지면 하한이 이긴다. 긴 단어가 하한 때문에 다시 커지는 걸 막는다.
        const cap = `calc(${layout.cloudMax} * ${fit} * ${r})`;
        return (
          <span
            key={w.word}
            className={`cloud-word cloud-chip ${
              highlight !== null && count === highlight ? 'cloud-chip-lead text-white' : 'text-ink'
            }`}
            style={{
              // clamp(최소, 최대 * sqrt(비율), 최대). 꼬리 단어는 최소값에 붙고 1등만 최대값에 닿는다.
              // 하한은 길이 보정을 받지 않는다. 받게 했더니 긴 단어가 18px 까지 내려가 안 보였다.
              fontSize: `calc(min(${max}, max(${min}, ${cap})) * var(--fit, 1))`,
              fontWeight: count >= median ? typography.cloudLead.weight : typography.cloudWord.weight,
              letterSpacing: typography.cloudWord.tracking,
              lineHeight: typography.cloudWord.leading,
            }}
          >
            <Ko>{w.word}</Ko>
          </span>
        );
      })}
    </div>
  );
}

// 투표는 열렸고 결과는 아직 공개 전일 때 띄운다. 청중은 20m 밖이라 폰을 보기 전에 무엇을 고르는지
// 대형화면에서 먼저 읽는다. 집계는 보여주지 않는다. 막대와 같은 타이포·행 구분선을 쓴다.
function OptionList({ options }) {
  const boxRef = useRef(null);
  // 선택지가 5개면 1440x900 에서 22px 넘쳐다. 카드는 글자보다 작아질 수 없으니
  // 워드클라우드와 같은 방식으로 글자를 줄인다. 선택지가 몇 개가 되든 넘치지 않는다.
  useFitScale(boxRef, options.map((o) => o.label).join('|'));
  return (
    <div
      ref={boxRef}
      className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden"
      style={{ marginTop: layout.screenChartTop, gap: layout.optionCardGap }}
    >
      {options.map((o, i) => (
        <div
          key={o.id}
          className="option-card flex shrink-0 items-center"
          style={{
            padding: `calc(${layout.optionCardY} * var(--fit, 1)) ${layout.optionCardX}`,
            gap: layout.chartGap,
          }}
        >
          <span
            className="text-screenOptionKey text-ink tabular"
            style={{ fontSize: `calc(${typography.screenOptionKey.size} * var(--fit, 1))` }}
          >
            {ALPHA[i]}
          </span>
          <p
            className="text-screenOption text-ink"
            style={{ fontSize: `calc(${typography.screenOption.size} * var(--fit, 1))` }}
          >
            <Ko>{o.label}</Ko>
          </p>
        </div>
      ))}
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
          // 선택지가 6개가 되면 행 최소높이 합이 패널을 넘어 세로로 잘렸다(1440x900 기준 77px 초과).
          // min(…, 100%) 로 상한을 두어 공간이 모자라면 행이 줄어들게 한다.
          // 여유가 있을 때의 행 높이는 그대로다.
          minHeight: `min(calc(${layout.chartRowMin} * ${items.length}), 100%)`,
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
  closing = false,
  resultsVisible = true,
  voteUrl = '',
  closingUrl = CLOSING_URL,
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
  const isText = question?.type === 'text';
  // 결과 공개 전에 보여줄 선택지. 집계가 아니라 질문 자체의 선택지라 question 에서 가져온다.
  const choiceOptions =
    question?.type === 'choice'
      ? [...(question.options ?? [])].sort((a, b) => a.order_no - b.order_no)
      : [];
  // 객관식은 언제나 막대, 주관식은 언제나 워드클라우드다.
  // 주관식을 막대로 보는 경우가 없어 뷰 전환 자체를 없앴다(results_view 는 스키마에 남아 있다).
  const cloud = isText;

  return (
    <GlassRoot
      background="/images/bg/ambient-screen.webp"
      // lg(1024) 미만은 여백을 줄인다. p-4xl(48px)을 양쪽에 그대로 두면 320px 폭에서
      // 내용 폭이 128px밖에 안 남아 한글이 5~7자마다 줄바뀜되고 그래픽이 스크롤 밖으로 밀렸다.
      className="glass-root-fixed flex items-stretch justify-center p-lg lg:p-4xl"
    >
      <Glass
        variant="screen"
        radius="screen"
        className="flex min-h-0 w-full max-w-screen flex-col p-lg lg:p-4xl"
      >
        {standby ? (
          <QrPlate key="standby" url={voteUrl} size={qrSize} />
        ) : cover ? (
          <CoverPlate key="cover" />
        ) : closing ? (
          <ClosingPlate key="closing" url={closingUrl} size={Math.round(qrSize * layout.closingQrRatio)} />
        ) : (
          // min-h-0 이 없으면 flex 아이템이 내용 아래로 줄지 못해 패널이 화면 밖으로 자란다.
          // 선택지 카드가 스스로 줄어들려면 이 줄이 먼저 뚫려 있어야 한다(실측 22px 초과).
          <div key={`live-${question?.id ?? ''}`} className="enter flex min-h-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-2xl">
              <div className="min-w-0">
                <h1 className="balance text-screenQuestion text-ink">
                  <Ko>{question?.title ?? ''}</Ko>
                </h1>
                {isText ? (
                  <p className="balance mt-sm text-screenMeta text-ink">
                    {/* Ko 의 children 을 문자열+표현식+문자열로 나누면 배열로 들어가 String(array) 가
                        쉼표로 이어붙인다(실측: “,내가...,” 으로 깨졌다). 하나의 문자열로 합쳐서 넘겨야 한다. */}
                    <Ko>{`“${TEXT_CAPTION}”`}</Ko>
                  </p>
                ) : null}
              </div>
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
            ) : choiceOptions.length > 0 ? (
              <OptionList options={choiceOptions} />
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
      closing={session?.status === 'closing'}
      resultsVisible={Boolean(session?.results_visible)}
      voteUrl={import.meta.env.VITE_VOTE_SHORT_URL || `${window.location.origin}/vote`}
      qrSize={qrSize}
    />
  );
}
