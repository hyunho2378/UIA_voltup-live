// 결과 아카이브. 행사가 끝난 뒤 질문별 최종 결과를 한 페이지에서 보고, 화면 그대로 이미지로 내려받는다.
// 세션 상태(cover/live/ended)와 무관하게 DB 집계를 직접 읽는다. 대형화면 운영과 완전히 분리된 화면이라
// 여기서 뭘 눌러도 청중 화면·대형화면에 영향이 없다.
//
// 각 카드는 실제 대형화면(ScreenView)을 1920x1080 그대로 그린 뒤 카드 폭에 맞게 축소해 보여준다.
// 새 레이아웃을 만들지 않는다. 행사장에서 보던 그 화면이 그대로 기록으로 남아야 한다.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { GlassModeProvider } from '../components/glass/GlassRoot.jsx';
import GlassButton from '../components/glass/GlassButton.jsx';
import Glass from '../components/glass/Glass.jsx';
import { ScreenView } from './Screen.jsx';
import {
  isSupabaseConfigured,
  fetchQuestions,
  fetchQuestion,
  fetchResults,
  fetchLiveCount,
} from '../lib/supabase.js';

// 대형화면 기준 해상도. 캡처도 이 크기로 떨어진다.
const SHOT_W = 1920;
const SHOT_H = 1080;

// 카드 한 장. 1920x1080 을 카드 폭에 맞춰 축소해 보여주고, 내려받을 때는 원래 크기로 캡처한다.
function ArchiveCard({ index, question, results, liveCount }) {
  const boxRef = useRef(null);
  const stageRef = useRef(null);
  const [scale, setScale] = useState(0.3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const fit = () => setScale(el.clientWidth / SHOT_W);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onDownload = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      // 화면에서는 축소해 보여주지만 캡처는 원래 1920x1080 으로 한다. transform 을 잠시 끄고 찍는다.
      const dataUrl = await toPng(stageRef.current, {
        width: SHOT_W,
        height: SHOT_H,
        pixelRatio: 2,
        cacheBust: true,
        style: { transform: 'none', transformOrigin: 'top left' },
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `질문${index}-결과.png`;
      a.click();
    } catch (e) {
      setError('이미지를 만들지 못했어요. 다시 시도해 주세요.');
      console.error('아카이브 캡처 실패', e);
    } finally {
      setBusy(false);
    }
  }, [index]);

  return (
    <li>
      <div className="flex items-baseline justify-between gap-md">
        <p className="text-title text-ink">질문 {index}</p>
        <p className="text-body text-ink tabular">{liveCount}명 참여</p>
      </div>
      <p className="mt-sub text-body text-ink">{question?.title ?? ''}</p>

      {/* 축소 표시용 상자. 높이는 비율로 잡아 카드가 흔들리지 않게 한다. */}
      <div
        ref={boxRef}
        className="mt-md w-full overflow-hidden rounded-md bg-white"
        style={{ height: boxRef.current ? boxRef.current.clientWidth / (SHOT_W / SHOT_H) : undefined,
                 aspectRatio: `${SHOT_W} / ${SHOT_H}` }}
      >
        <div
          ref={stageRef}
          className="archive-stage"
          style={{ width: SHOT_W, height: SHOT_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          <ScreenView question={question} results={results} liveCount={liveCount} resultsVisible />
        </div>
      </div>

      <GlassButton prominent disabled={busy} onClick={onDownload} className="mt-md w-full">
        {busy ? '이미지 만드는 중' : '이미지로 저장'}
      </GlassButton>
      {error ? <p className="mt-sm text-caption text-ink">{error}</p> : null}
    </li>
  );
}

export default function Archive() {
  const [rows, setRows] = useState([]);
  const [state, setState] = useState('loading');

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setState('error');
      return undefined;
    }
    let alive = true;
    (async () => {
      try {
        const list = await fetchQuestions();
        const loaded = await Promise.all(
          list.map(async (q) => {
            const [question, results, liveCount] = await Promise.all([
              fetchQuestion(q.id),
              fetchResults(q.id),
              fetchLiveCount(q.id),
            ]);
            return { question, results, liveCount };
          }),
        );
        if (!alive) return;
        setRows(loaded);
        setState('ready');
      } catch (e) {
        console.error('아카이브 조회 실패', e);
        if (alive) setState('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const total = rows.reduce((sum, r) => sum + (r.liveCount ?? 0), 0);

  return (
    // 대형화면이 아니라 운영자가 노트북에서 보는 문서형 화면이다. 글래스 패널 하나에 목록을 담는다.
    // WebGL 은 쓰지 않는다(카드마다 컨텍스트가 생기면 브라우저 한도를 넘긴다). Preview 와 같은 이유.
    <GlassModeProvider value="css">
      <div className="min-h-dvh bg-paper px-lg py-2xl">
        <div className="mx-auto w-full max-w-admin">
          <h1 className="text-title text-ink">결과 아카이브</h1>
          <p className="mt-sub text-body text-ink">
            {state === 'ready' ? `질문 ${rows.length}개, 응답 합계 ${total}건` : ''}
          </p>

          {state === 'loading' ? <p className="mt-panel text-body text-ink">불러오는 중</p> : null}
          {state === 'error' ? <p className="mt-panel text-body text-ink">결과를 불러오지 못했어요</p> : null}

          {state === 'ready' ? (
            <Glass variant="regular" radius="xl" className="mt-panel p-panel">
              <ul className="flex flex-col gap-4xl">
                {rows.map((r, i) => (
                  <ArchiveCard
                    key={r.question?.id ?? i}
                    index={r.question?.order_no ?? i + 1}
                    question={r.question}
                    results={r.results}
                    liveCount={r.liveCount}
                  />
                ))}
              </ul>
            </Glass>
          ) : null}
        </div>
      </div>
    </GlassModeProvider>
  );
}
