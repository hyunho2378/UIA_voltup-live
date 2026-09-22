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
      // 8번(0.92^8=0.51배)까지만 줄였더니 브라우저 창이 좋고 낮은 해상도(보통 브라우저 크롬·북마크바가
      // 세로 공간을 많이 먹는 경우)에서 6개 카드의 마지막 하나가 잘렸다. 14번(0.92^14=0.32배)까지 늘린다.
      for (let i = 0; i < 14 && el.scrollHeight > el.clientHeight + 1; i += 1) {
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

// 경주포럼 홍보 화면(예전 'closing'). 2026 세계경주포럼 로고 + 참가등록 QR.
// 로고와 QR 은 둘 다 오브젝트라 가운데 배치를 허용한다(DESIGN 정렬 예외, QR 플레이트와 같은 근거).
// QR 은 스캔 가독성이 재질보다 우선이라 대기 화면과 동일하게 흰 플레이트 위에 올린다.
function WgjPlate({ url, size }) {
  return (
    <div className="plate-in flex flex-1 flex-col items-center justify-center gap-4xl">
      {/* min-h-0 이 없으면 flex 아이템이 줄지 않아 세로가 짧은 화면에서 패널을 넘는다. */}
      <img
        // 원본(wgj-2026.png)은 글자가 순백이라 밝은 ambient 배경 위에서 안 보였다(사용자 피드백).
        // 알파는 그대로 두고 RGB 만 ink 로 바꾼 산출물을 쓴다. 원본은 보관용으로 남겨 둔다.
        src="/images/wgj-2026-ink.png"
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

// 클로징(사진 촬영용). 청중이 이 화면을 배경으로 사진을 찍는다.
// 이 앱에서 유일하게 ambient 색면·글래스를 쓰지 않는 화면이다. 사진에 담길 배경이라
// 그라데이션이 있으면 인물과 섞이고 인쇄·재촬영 때도 지저분해진다. paper 단색으로 깔고,
// 브랜드 자산도 brandRamp 재도색본이 아니라 행사 원본 유채색을 그대로 쓴다(사용자 요청).
//
// 배치는 커버(CoverPlate)와 같은 뼈대다. 크기 토큰도 커버 것을 그대로 쓴다(사용자 요청:
// "표지랑 똑같은 위치에"). 커버와 달라지는 건 세 가지뿐이다.
//   1. 커버의 UIA 로고 자리에 행사명(제3회 대한민국 사회적 가치 페스타)이 들어간다.
//   2. MODULE 05 / 인터렉티브 세션 두 줄이 빠지고, 그 자리 아래에 세션 타이틀이 온다.
//      포럼 타이틀과 붙어 보이지 않게 간격을 5xl(64px)로 크게 벌린다.
//   3. UIA 로고는 위가 아니라 하단으로 내려가 한양대 로고와 나란히 선다.
function ClosingPlate() {
  return (
    <div className="flex min-h-dvh flex-col bg-paper p-lg lg:p-4xl">
      {/* 커버는 GlassRoot(p-4xl) + Glass 패널(p-4xl) 두 겹이라 내용이 96px 에서 시작한다.
          클로징은 패널이 없어 한 겹뿐이었다. 가로만 한 겹 더 줘서 시작 x 를 커버와 맞춘다.
          세로까지 겹쳐 주면 하단 로고 줄까지 더해져 화면을 넘긴다(실측 66px 초과). */}
      <div className="plate-in flex flex-1 flex-col lg:px-4xl">
        <div className="flex min-h-0 flex-1 flex-col items-center gap-2xl overflow-y-auto lg:flex-row lg:items-center lg:gap-4xl lg:overflow-visible">
          <div className="flex w-full min-w-0 flex-col justify-center lg:flex-1">
            {/* 커버에서 UIA 로고가 있던 자리. */}
            <p className="text-closingEyebrow text-ink">제3회 대한민국 사회적 가치 페스타</p>
            <img
              src="/images/brand/title.svg"
              alt="2026 UIA x 한양대학교 NEXT IMPACT FORUM"
              className="mt-4xl w-full object-contain object-left"
              style={{ maxWidth: layout.coverTitleMax }}
            />
            <h1 className="balance text-closingTitle text-ink" style={{ marginTop: layout.closingTitleGap }}>
              <Ko>대학의 미래, 미래의 대학</Ko>
            </h1>
          </div>
          {/* 커버와 같은 크기 토큰을 쓴다. 따로 작게 두었더니 화면에서 너무 작았다(사용자 피드백). */}
          <img
            src="/images/brand/graphic-color.webp"
            alt=""
            aria-hidden="true"
            className="min-h-0 max-w-coverGraphicSm max-h-coverGraphicSm shrink-0 self-center object-contain lg:max-w-coverGraphic lg:max-h-coverGraphic"
          />
        </div>
        {/* 하단 로고 2개. 주최·주관 표기라 한 줄에 나란히 둔다. */}
        <div className="mt-2xl flex shrink-0 items-center gap-4xl">
          <img
            src="/images/brand/logo-color.svg"
            alt="UIA"
            className="object-contain"
            style={{ maxWidth: layout.closingUiaLogoMax, width: '100%' }}
          />
          <img
            src="/images/brand/hyu-logotype.svg"
            alt="한양대학교"
            className="object-contain"
            style={{ maxWidth: layout.closingHyuLogoMax, width: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}

// 같은 집계를 다르게 배치하는 뷰일 뿐이다. 배경도 보더도 없다. 글래스 위에 텍스트만 얹는다.
// 위계는 크기로만 만든다. 색은 ink 단색이고 최다 단어만 blue 다.
// FLIP(First-Last-Invert-Play). 단어 크기(font-size)와 위치(flex-wrap 재배치)는 둘 다 레이아웃 속성이라
// 직접 애니메이션하면 AGENTS 1절(layout/paint 유발 속성 애니메이션 금지)에 걸린다. BarChart 가
// 막대 성장을 transform: scaleX 로 대체하는 것과 같은 근거다. 변화 직전 위치·크기를 재고(First),
// DOM 이 이미 새 위치·크기로 바뀌 다음(Last) 그 차이를 transform 으로 역산(Invert)해 순간 이동이
// 없었던 것처럼 보이게 한 다음, 다음 프레임에 transition 을 걸고 identity 로 되돌려(Play) 부드럽게 이어붙인다.
// 새로 등장하는 단어는 대상이 아니다. React 가 이미 새 DOM 노드를 만들므로 CSS 마운트 애니메이션
// (`cloud-in`)이 그대로 맞는다. 둘이 겹치지 않게 FLIP 대상은 이미 있던 단어만으로 거른다.
function WordCloud({ items, highlight }) {
  const boxRef = useRef(null);
  const prevRectsRef = useRef(new Map());
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

  // 이 훈은 레이아웃이 확정된 다음(위 useFitScale 과 같은 커밋 이후) 돑아야 하므로 useFitScale 보다
  // 뒤에 둔다. React 는 동일 컴포넌트 안의 useLayoutEffect 를 선언 순서대로(아래에서 위로) 실행하므로,
  // 이 훈이 useFitScale 보다 나중에 실행되게 둘 둘 다 문서 순서대로 놓었다(위에서 useFitScale 먼저 호출함).
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const prev = prevRectsRef.current;
    const next = new Map();
    el.querySelectorAll('.cloud-word').forEach((node) => {
      const word = node.dataset.word;
      const rect = node.getBoundingClientRect();
      next.set(word, rect);
      const before = prev.get(word);
      if (!before || !rect.width || !before.width) return; // 새 단어는 cloud-in 이 담당한다.
      const dx = before.left + before.width / 2 - (rect.left + rect.width / 2);
      const dy = before.top + before.height / 2 - (rect.top + rect.height / 2);
      const scale = before.width / rect.width;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(scale - 1) < 0.01) return; // 안 바뀌었으면 건드리지 않는다.
      node.style.transition = 'none';
      node.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
      node.getBoundingClientRect(); // 강제 리플로우. 여기서 끝나면 위 transform 이 적용된 채로 프레임이 확정된다.
      requestAnimationFrame(() => {
        node.style.transition = `transform ${motion.durBase} ${motion.easeOut}`;
        node.style.transform = '';
      });
    });
    prevRectsRef.current = next;
  });

  return (
    <div
      ref={boxRef}
      // min-h-0 과 overflow-hidden 이 없으면 넘친 만큼 패널이 늘어나 화면이 스크롤된다.
      // 넘침을 컨테이너 안에 가둬야 위 useLayoutEffect 의 높이 측정이 성립한다.
      className="mx-auto flex min-h-0 flex-1 flex-wrap content-center items-center justify-center overflow-hidden"
      // 이유는 OptionList 와 같다. gap·marginTop 이 --fit 을 안 받으면 고정 여백이 마지막까지 남아 잘릴 수 있다.
      style={{
        gap: `calc(${layout.cloudGap} * var(--fit, 1))`,
        marginTop: `calc(${layout.screenChartTop} * var(--fit, 1))`,
        maxWidth: layout.cloudWidth,
      }}
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
            data-word={w.word}
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
      // gap과 marginTop 이 --fit 을 안 받으면 폰트를 아무리 줄여도 고정 여백만으로 넘치는 경우가 생긴다
      // (실측: 브라우저 창이 좋고 낮은 해상도에서 6개 중 마지막 카드가 잘렸다). 둘 다 --fit 에 걸어야 한다.
      style={{
        marginTop: `calc(${layout.screenChartTop} * var(--fit, 1))`,
        gap: `calc(${layout.optionCardGap} * var(--fit, 1))`,
      }}
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

// 주관식(Q4) 응답이 아직 없을 때. 빈칸 문장을 화면 한가운데에 크게 띄운다.
// 질문 옆 작은 보조 문구로 두었을 때는 20m 거리에서 읽히지 않았다(사용자 피드백).
// 단어가 하나라도 들어오면 이 자리를 워드클라우드가 대신한다.
function TextPrompt() {
  return (
    <div className="flex flex-1 items-center justify-center" style={{ marginTop: layout.screenChartTop }}>
      <p className="balance text-center text-screenPrompt text-ink">
        <Ko>{`“${TEXT_CAPTION}”`}</Ko>
      </p>
    </div>
  );
}

// 척도 질문(Q1) 결과 공개 전. 선택지가 아니라 서잌 끝의 설명 2개뿐이라 안 채운 트랙만 보여준다.
function ScaleHint({ options }) {
  const minLabel = options[0]?.label ?? '';
  const maxLabel = options[options.length - 1]?.label ?? '';
  // 0.5 단위 9개 멈춰 숫자. /vote 와 같은 이유로 바 위에 따로 둔다(바 자체에 새기지 않는다).
  const ticks = Array.from({ length: 9 }, (_, i) => 1 + (i / 8) * 4);
  return (
    <div className="flex flex-1 flex-col justify-center" style={{ marginTop: layout.screenChartTop }}>
      <div className="relative" style={{ height: typography.screenVotes.size }}>
        {ticks.map((v) => (
          <span
            key={v}
            className="absolute text-screenVotes text-ink tabular"
            style={{ left: `${((v - 1) / 4) * 100}%`, transform: 'translateX(-50%)' }}
          >
            {v}
          </span>
        ))}
      </div>
      <div
        className="mt-sm w-full overflow-hidden rounded-bar bg-barTrack"
        style={{ height: layout.screenBarHeight }}
      />
      <div className="mt-xl flex items-center justify-between gap-2xl">
        <p className="text-screenLabel text-ink">
          <Ko>{minLabel}</Ko>
        </p>
        <p className="text-screenLabel text-ink">
          <Ko>{maxLabel}</Ko>
        </p>
      </div>
    </div>
  );
}

// 척도 결과는 따로 만들지 않는다. 사용자 피드백: "다 또같은 막대바에 .5도 보이게해야지".
// 아래 BarChart 를 그대로 쓴다(다른 컴포넌트를 따로 만들지 않음). 혹시 나중에 0.5 단위를 다시 없애고
// 1~5 5개로만 돌아가도 같은 컴포넌트에 항목만 줄면 렜다(사용자 메모: "혹시나 나중에 .5 다시 없애을수도").
function scaleToBarItems(items) {
  return items.map((it) => ({ option_id: String(it.value), label: String(it.value), count: it.count ?? 0 }));
}

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
                <p className="flex items-baseline text-screenPct text-ink tabular" style={{ gap: layout.chartValueGap }}>
                  {/* 고정 폭(3.4ch = "100%" 기준) + 우측 정렬. 원래는 값이 자유 폭이라 0%와 100%의 자릿수가
                      달라 바로 뒤에 붙는 "표"의 시작 위치가 행마다 미미하게 달라졌다(사용자 피드백: "1.5나
                      이런 거 다들 위치가 달라"). 고정 폭을 주면 내용이 바뀌어도 "표" 위치가 행간에 항상 일치한다. */}
                  <span className="inline-block text-right" style={{ minWidth: '3.4ch' }}>
                    {pct}%
                  </span>
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
  wgj = false,
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
  // 1위는 공동이어도 전부 blue 로 강조한다(사용자 요청). 예전에는 "단독 1등"일 때만 칠했는데,
  // 공동 1위가 나오면 아무것도 강조되지 않아 화면에서 1위를 읽을 수 없었다.
  // 0표(전부 0)일 때만 강조가 없다. 이때는 1위라는 개념 자체가 없다.
  const top = Math.max(0, ...items.map((it) => it.count ?? 0));
  const highlight = top > 0 ? top : null;
  const isText = question?.type === 'text';
  const isScale = question?.type === 'scale';
  // 결과 공개 전에 보여줄 선택지. 집계가 아니라 질문 자체의 선택지라 question 에서 가져온다.
  const choiceOptions =
    question?.type === 'choice'
      ? [...(question.options ?? [])].sort((a, b) => a.order_no - b.order_no)
      : [];
  // 객관식은 언제나 막대, 주관식은 언제나 워드클라우드다.
  // 주관식을 막대로 보는 경우가 없어 뷰 전환 자체를 없앴다(results_view 는 스키마에 남아 있다).
  const scaleOptions = isScale ? [...(question.options ?? [])].sort((a, b) => a.order_no - b.order_no) : [];
  const cloud = isText;

  // 클로징만 GlassRoot 밖에서 그린다. ambient 색면·글래스를 쓰지 않는 유일한 화면이라
  // 같은 래퍼 안에 두면 뒤에 배경 이미지가 깔린다.
  if (closing) return <ClosingPlate key="closing" />;

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
        ) : wgj ? (
          <WgjPlate key="wgj" url={closingUrl} size={Math.round(qrSize * layout.closingQrRatio)} />
        ) : (
          // min-h-0 이 없으면 flex 아이템이 내용 아래로 줄지 못해 패널이 화면 밖으로 자란다.
          // 선택지 카드가 스스로 줄어들려면 이 줄이 먼저 뚫려 있어야 한다(실측 22px 초과).
          <div key={`live-${question?.id ?? ''}`} className="enter flex min-h-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-2xl">
              <div className="min-w-0">
                {/* 결과가 뜨 다음에는 질문을 줄인다. 청중은 이미 읽고 답했으니 차트가 주인공이다(사용자 피드백:
                    "결과일 때는 질문을 줄이면 되쟐아"). 특히 척도 9행 막대처럼 행이 많을 때 세로 공간이 보태된다. */}
                <h1
                  className={`balance text-ink ${
                    resultsVisible && items.length > 0 ? 'text-screenQuestionResult' : 'text-screenQuestion'
                  }`}
                >
                  <Ko>{question?.title ?? ''}</Ko>
                </h1>
                {/* 빈칸 문장은 질문 옆 작은 글씨가 아니라 화면 한가운데에 크게 띄운다(아래 TextPrompt).
                    여기 두었을 때는 20m 거리에서 읽히지 않았다(사용자 피드백). */}
              </div>
              <span className="live-dot mt-md h-md w-md shrink-0 rounded-full bg-green" aria-label="실시간" />
            </div>

            {resultsVisible && items.length > 0 ? (
              <>
                {cloud ? (
                  <WordCloud items={items} highlight={highlight} />
                ) : (
                  <BarChart
                    items={isScale ? scaleToBarItems(items) : items}
                    totalVotes={totalVotes}
                    highlight={highlight}
                    isText={isText || isScale}
                  />
                )}
                <p className="mt-xl text-screenMeta text-ink tabular">
                  {liveCount}명 참여{isScale ? `, 평균 ${matched?.average ?? 0}점` : ''}
                </p>
              </>
            ) : isText ? (
              <TextPrompt />
            ) : isScale ? (
              <ScaleHint options={scaleOptions} />
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
      wgj={session?.status === 'wgj'}
      resultsVisible={Boolean(session?.results_visible)}
      voteUrl={import.meta.env.VITE_VOTE_SHORT_URL || `${window.location.origin}/vote`}
      qrSize={qrSize}
    />
  );
}
