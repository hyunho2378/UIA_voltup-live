import { useEffect, useState } from 'react';
import GlassRoot from '../components/glass/GlassRoot.jsx';
import Glass from '../components/glass/Glass.jsx';
import GlassButton from '../components/glass/GlassButton.jsx';
import Ko from '../components/glass/Ko.jsx';
import Offline from './Offline.jsx';
import { useSession } from '../lib/session-context.jsx';
import { isSupabaseConfigured, fetchQuestion, fetchQuestions, submitVote } from '../lib/supabase.js';

export const MAX_TEXT = 12;

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
  notice = '',
  ended = false,
  onChoice = () => {},
  onText = () => {},
  onSubmit = () => {},
}) {
  const isText = question?.type === 'text';
  const ready = isText ? text.trim().length > 0 : Boolean(choice);
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

            {state === 'waiting' ? (
              ended ? <p className="mt-panel text-body text-ink">오늘 세션이 종료되었어요</p> : null
            ) : isText ? (
              <div className="mt-panel">
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
              <ul className="mt-panel flex flex-col gap-md">
                {options.map((o) => {
                  const on = choice === o.id;
                  return (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => onChoice(o.id)}
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
  const ready = isText ? text.trim().length > 0 : Boolean(choice);
  const open = Boolean(session?.voting_open);
  const ended = session?.status === 'ended';
  const state = voted ? 'done' : open && !ended ? 'voting' : 'waiting';

  async function onSubmit() {
    if (!ready) return;
    const res = await submitVote({
      questionId: question.id,
      optionId: isText ? null : choice,
      textValue: isText ? text.trim() : null,
    });
    if (res.ok) {
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
      notice={notice}
      ended={ended}
      onChoice={setChoice}
      onText={setText}
      onSubmit={onSubmit}
    />
  );
}
