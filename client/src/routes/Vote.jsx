import { useEffect, useRef, useState } from 'react';
import GlassRoot from '../components/glass/GlassRoot.jsx';
import Glass from '../components/glass/Glass.jsx';
import GlassButton from '../components/glass/GlassButton.jsx';
import Ko from '../components/glass/Ko.jsx';
import Offline from './Offline.jsx';
import { layout } from '../tokens.js';
import { useSession } from '../lib/session-context.jsx';
import { isSupabaseConfigured, fetchQuestion, fetchQuestions, submitVote } from '../lib/supabase.js';

export const MAX_TEXT = 12;

// Q4 전용 보조 캡션. 큐시트에 화면에 띄우는 문구가 질문과 빈칸 문장 둘이라 명시되어 있다(SOURCE.md).
// 이 앱은 주관식 질문이 Q4 하나뿐이라 type 조건분기로 충분하다. 질문마다 다른 캡션이 필요해지면
// 그때 스키마에 컬럼을 추가한다.
export const TEXT_CAPTION = '내가 생각하는 미래의 대학은 ______이다.';

// 진동 피드백. Vibration API 는 안드로이드 Chrome 계열만 지원한다. 아이폰 사파리는 웹 표준
// 자체를 구현하지 않아 이 함수가 조용히 아무것도 안 한다(사용자 확인 후 진행). 함수 자체 미지원
// 브라우저도 있어 존재 체크를 먼저 한다.
function vibrate(ms) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(ms);
  }
}

// 척도 슬라이더(Q1). 1~5 사이를 0.5 단위(9개 눈금)로만 음직인다.
// 드래그 중 위치를 매프레임 바꾸는 건 CSS 애니메이션이 아니라 사용자 제스처에 직접 반응하는
// direct manipulation 이라 AGENTS 1절(layout 유발 애니메이션 금지) 대상이 아니다. 임의 select/range 를 쓰지 않고
// 커스텀으로 만든다(ROUTES 귷칙: 네이티브 컴포넌트 노출 금지).
function Slider({ value, onChange, minLabel, maxLabel }) {
  const trackRef = useRef(null);
  const draggingRef = useRef(false);
  const lastSnapRef = useRef(value);
  const fraction = value === null ? 0.5 : (value - 1) / 4;
  // 0.5 단위 9개 멈춰을 숫자로 보여준다. 바 자체에 새기는 버전은 사용자 피드백으로 버렸다
  // ("저렇게 하라는 게 아니라 바 위에다가 해달라... 바 자체에 하는 건 좀 그렉고"). 대신 바 위체로
  // 별도 줄에 1, 1.5, 2 ... 5 숫자 자체를 줄 세운다.
  const ticks = Array.from({ length: 9 }, (_, i) => 1 + (i / 8) * 4);

  const valueFromClientX = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect();
    const raw = (clientX - rect.left) / rect.width;
    const clamped = Math.min(1, Math.max(0, raw));
    // 1~5 사이 9개 눈금(0.5 단위) 중 가장 가까운 값으로 스냵한다.
    const snapped = Math.round(clamped * 8) / 8;
    return Math.round((1 + snapped * 4) * 10) / 10; // 부동소수점 오차 방지(3.0000004 방지)
  };

  // 눈금이 바뀌는 순간만 짧게 진동해 손끝에 딱딱 끊기는 피드백을 준다. 같은 값을 계속 진동시키면
  // 드래그 중 계속 진동해 불편하다.
  const applyValue = (v) => {
    if (v !== lastSnapRef.current) {
      lastSnapRef.current = v;
      vibrate(10);
    }
    onChange(v);
  };

  const handlePointerDown = (e) => {
    trackRef.current.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    applyValue(valueFromClientX(e.clientX));
  };
  const handlePointerMove = (e) => {
    if (!draggingRef.current) return;
    applyValue(valueFromClientX(e.clientX));
  };
  const handlePointerUp = (e) => {
    draggingRef.current = false;
    trackRef.current.releasePointerCapture(e.pointerId);
  };
  const handleKeyDown = (e) => {
    const base = value ?? 3;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') applyValue(Math.min(5, base + 0.5));
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') applyValue(Math.max(1, base - 0.5));
    else if (e.key === 'Home') applyValue(1);
    else if (e.key === 'End') applyValue(5);
  };

  return (
    <div className="mt-2xl">
      {/* 눈금 숫자 줄. 바 위에 따로 둔다(바 자체에 새기지 않는다). 트랙과 같은 폭에서 같은 비율로 점을 찍어야
          하이라 바와 폭이 동일해야 한다(아래 track 컸테이너와 같은 너비 기준). */}
      <div className="relative h-lg">
        {ticks.map((v) => (
          <span
            key={v}
            className="absolute text-caption text-ink tabular"
            style={{ left: `${((v - 1) / 4) * 100}%`, transform: 'translateX(-50%)' }}
          >
            {v}
          </span>
        ))}
      </div>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={value ?? 3}
        aria-valuetext={`${value ?? 3}점`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        // 시각 트랙은 8px로 얺지만 터치 히트 영역은 touchMin(44px) 그대로 쓴다.
        className="relative mt-sm flex touch-none items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-blue"
        style={{ minHeight: layout.touchMin }}
      >
        <div
          className="relative w-full overflow-hidden rounded-full bg-optionFill"
          style={{ height: layout.sliderTrackHeight }}
        >
          {/* BarChart 의 막대 성장과 같은 패턴: scaleX 만 쓴다(transform, 레이아웃 속성 아님). */}
          <div
            className="h-full w-full rounded-full bg-blue"
            style={{ transform: `scaleX(${fraction})`, transformOrigin: 'left' }}
          />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-full border-2 border-blue bg-white"
          style={{
            width: layout.sliderThumbSize,
            height: layout.sliderThumbSize,
            top: '50%',
            left: `${fraction * 100}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>
      <div className="mt-sm flex items-start justify-between gap-md">
        <p className="text-caption text-ink">
          <Ko>{minLabel}</Ko>
        </p>
        <p className="text-caption text-ink">
          <Ko>{maxLabel}</Ko>
        </p>
      </div>
      <p className="mt-md text-center text-question text-ink tabular">{value ?? 3}</p>
    </div>
  );
}

function Radio({ on }) {
  return (
    <span
      className={`flex h-lg w-lg shrink-0 items-center justify-center rounded-full border ${
        on ? 'border-white' : 'border-ink2'
      }`}
      aria-hidden="true"
    >
      <span
        className={`h-sm w-sm rounded-full bg-white transition-transform duration-fast ease-out ${
          on ? 'scale-100' : 'scale-0'
        }`}
      />
    </span>
  );
}

/**
 * 표시 전용. Supabase 도 세션도 모른다. 실시간 경로(Vote)와 /preview 가 같은 것을 그린다.
 * state: 'waiting' | 'voting' | 'done'
 */
export function VoteView({
  question,
  total = 1,
  state = 'waiting',
  choice = null,
  text = '',
  scale = null,
  notice = '',
  ended = false,
  onChoice = () => {},
  onText = () => {},
  onScale = () => {},
  onSubmit = () => {},
}) {
  const isText = question?.type === 'text';
  const isScale = question?.type === 'scale';
  const ready = isText ? text.trim().length > 0 : isScale ? scale !== null : Boolean(choice);
  const options = [...(question?.options ?? [])].sort((a, b) => a.order_no - b.order_no);

  return (
    <GlassRoot
      background="/images/bg/ambient-vote.webp"
      className="flex flex-col items-center justify-center gap-panel px-lg py-2xl"
    >
      <Glass variant="regular" radius="xl" className="w-full max-w-vote p-panel">
        {state === 'done' ? (
          <div key="done" className="enter">
            <p className="balance text-question text-ink">
              <Ko>{notice || '투표했어요'}</Ko>
            </p>
          </div>
        ) : (
          <div key={`${state}-${question?.id ?? ''}`} className="enter">
            <p className="text-caption text-ink tabular">
              {question?.order_no ?? 1} / {total || 1}
            </p>
            <h1 className="balance mt-md text-question text-ink">
              <Ko>{question?.title ?? ''}</Ko>
            </h1>
            {isText ? (
              <p className="balance mt-sm text-option text-ink">
                {/* Ko 의 children 을 문자열+표현식+문자열로 나누면 배열로 들어가 String(array) 가 쉼표로 이어붙인다.
                    (실측: “,내가...,” 으로 깨졌다). 하나의 문자열로 합쳐서 넘겨야 한다. */}
                <Ko>{`“${TEXT_CAPTION}”`}</Ko>
              </p>
            ) : null}

            {state === 'waiting' ? (
              ended ? <p className="mt-2xl text-body text-ink">오늘 세션이 종료되었어요</p> : null
            ) : isScale ? (
              <Slider
                value={scale}
                onChange={onScale}
                minLabel={options[0]?.label ?? ''}
                maxLabel={options[options.length - 1]?.label ?? ''}
              />
            ) : isText ? (
              <div className="mt-2xl">
                <input
                  value={text}
                  onChange={(e) => onText(e.target.value.slice(0, MAX_TEXT))}
                  maxLength={MAX_TEXT}
                  className="min-h-option w-full appearance-none rounded-md border border-optionBorder bg-optionFill px-optionX text-option text-ink outline-none placeholder:text-ink2"
                  placeholder="한 단어로"
                />
                <p className="mt-sm text-right text-caption text-ink tabular">
                  {text.length} / {MAX_TEXT}
                </p>
              </div>
            ) : (
              <ul className="mt-2xl flex flex-col gap-md">
                {options.map((o) => {
                  const on = choice === o.id;
                  return (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => {
                          vibrate(8);
                          onChoice(o.id);
                        }}
                        aria-pressed={on}
                        className={`press press-option flex min-h-option w-full items-center gap-radio rounded-md border px-optionX text-left text-option ${
                          on ? 'border-ink bg-ink text-white' : 'border-optionBorder bg-optionFill text-ink'
                        }`}
                      >
                        <Radio on={on} />
                        <Ko>{o.label}</Ko>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {notice ? <p className="mt-md text-caption text-ink">{notice}</p> : null}
          </div>
        )}
      </Glass>

      <GlassButton
        prominent
        disabled={!ready}
        onClick={onSubmit}
        className={`w-full max-w-vote ${state === 'voting' ? '' : 'invisible pointer-events-none'}`}
      >
        투표하기
      </GlassButton>
    </GlassRoot>
  );
}

export default function Vote() {
  const { session, offline } = useSession();
  const [question, setQuestion] = useState(null);
  const [total, setTotal] = useState(0);
  const [choice, setChoice] = useState(null);
  const [text, setText] = useState('');
  const [scale, setScale] = useState(3);
  const [voted, setVoted] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    fetchQuestions().then((qs) => setTotal(qs.length));
  }, []);

  const qid = session?.active_question_id;

  useEffect(() => {
    if (!isSupabaseConfigured || !qid) return undefined;
    // 초기화는 fetch 결과를 기다리지 않는다. 기다리면 새 질문 위에 이전 질문의 "투표했어요"가 남는다.
    setQuestion(null);
    setChoice(null);
    setText('');
    setScale(3);
    setVoted(false);
    setNotice('');

    // 이전 질문의 fetch 가 뒤늦게 도착해 덮어쓰는 걸 막는다.
    let alive = true;
    fetchQuestion(qid).then((q) => alive && setQuestion(q));
    return () => {
      alive = false;
    };
  }, [qid]);

  const isText = question?.type === 'text';
  const isScale = question?.type === 'scale';
  const ready = isText ? text.trim().length > 0 : isScale ? scale !== null : Boolean(choice);
  const open = Boolean(session?.voting_open);
  const ended = session?.status === 'ended';
  // 화면 상태 우선순위. ended 를 voted 보다 먼저 본다.
  // 반대로 두면 이미 투표한 사람은 세션이 끝나도 "투표했어요" 화면에 머물고,
  // 새로고침해야만 종료를 알게 된다. 새로고침을 안전장치로 쓰지 않는다.
  // ended → standby/마감 → voted → 투표 순서. 마감(voting_open=false)은 대기와 같은 화면이다.
  const state = ended ? 'waiting' : voted ? 'done' : open ? 'voting' : 'waiting';

  async function onSubmit() {
    if (!ready) return;
    const res = await submitVote({
      questionId: question.id,
      optionId: isText || isScale ? null : choice,
      textValue: isText ? text.trim() : null,
      scaleValue: isScale ? scale : null,
    });
    if (res.ok) {
      vibrate([12, 40, 12]); // 짧게-쉼음-짧게. 슬라이더 조작 중 단일 진동과 구별되는 제출 확정 패턴.
      setVoted(true);
      return;
    }
    if (res.reason === 'duplicate') {
      setVoted(true);
      setNotice('이미 투표했어요');
      return;
    }
    // 42501(마감). 폰에 따로 알리지 않는다. Realtime 이 voting_open=false 를 밀면 대기 화면으로 돌아간다.
    setNotice('');
  }

  // 실시간이 8초 넘게 끊기면 오프라인 안내로 바꾼다. 복구되면 자동으로 돌아온다.
  if (offline) return <Offline />;

  return (
    <VoteView
      question={question}
      total={total}
      state={state}
      choice={choice}
      text={text}
      scale={scale}
      notice={notice}
      ended={ended}
      onChoice={setChoice}
      onText={setText}
      onScale={setScale}
      onSubmit={onSubmit}
    />
  );
}
