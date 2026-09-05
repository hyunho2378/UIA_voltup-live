// 세션 제어 로직의 단일 출처. 프로덕션 serverless(api/session-control.js)와
// 로컬 dev 미들웨어(vite.config.js)가 같은 함수를 쓴다. switch 를 두 벌 두지 않는다.

export const SESSION_ID = '00000000-0000-0000-0000-000000000001';

export function patchFor(action, questionId) {
  switch (action) {
    case 'set_question': return { active_question_id: questionId, voting_open: false, results_visible: false, status: 'live' };
    case 'open_voting':  return { voting_open: true };
    case 'close_voting': return { voting_open: false };
    case 'show_results': return { results_visible: true };
    case 'hide_results': return { results_visible: false };
    case 'standby':      return { status: 'standby', voting_open: false, results_visible: false };
    case 'end':          return { status: 'ended', voting_open: false };
    default: return null;
  }
}

// admin 은 secret 키로 만든 supabase 클라이언트. RLS 를 우회하는 유일한 경로다.
export async function applySessionAction(admin, action, questionId) {
  const patch = patchFor(action, questionId);
  if (!patch) return { status: 400, body: { error: 'unknown_action' } };

  const { data, error } = await admin.from('sessions').update(patch).eq('id', SESSION_ID).select().single();
  if (error) return { status: 500, body: { error: error.message } };

  // 마감 시 최종 집계 확정. 250ms 병합으로 스킵됐을 수 있는 마지막 투표까지 한 번 더 쏜다.
  if (action === 'close_voting' && data.active_question_id) {
    const { error: flushError } = await admin.rpc('flush_results', { q_id: data.active_question_id });
    if (flushError) console.error('flush_results 실패', flushError.message);
  }

  return { status: 200, body: data };
}

// 투표 초기화. 리허설에서 이전 표가 남아 "투표 안 했는데 결과가 나온다"로 보이는 걸 없앤다.
// votes DELETE 는 RLS 로 막혀 있어 secret 키 경로(admin)에서만 가능하다.
export async function resetVotes(admin, scope, questionId) {
  if (scope === 'question') {
    if (!questionId) return { status: 400, body: { error: 'no_question' } };
    const { error } = await admin.from('votes').delete().eq('question_id', questionId);
    if (error) return { status: 500, body: { error: error.message } };
    // 삭제는 트리거를 타지 않는다(트리거는 INSERT 전용). 화면을 0 으로 만들려면 여기서 직접 쏜다.
    const { error: flushError } = await admin.rpc('flush_results', { q_id: questionId });
    if (flushError) return { status: 500, body: { error: flushError.message } };
    return { status: 200, body: { ok: true, scope: 'question', questionId } };
  }

  if (scope === 'all') {
    // PostgREST 는 필터 없는 DELETE 를 거부한다. id is not null 로 전체를 지정한다.
    const { error } = await admin.from('votes').delete().not('id', 'is', null);
    if (error) return { status: 500, body: { error: error.message } };
    const { data, error: sessionError } = await admin
      .from('sessions')
      .update({ status: 'standby', voting_open: false, results_visible: false })
      .eq('id', SESSION_ID)
      .select()
      .single();
    if (sessionError) return { status: 500, body: { error: sessionError.message } };
    return { status: 200, body: { ok: true, scope: 'all', session: data } };
  }

  return { status: 400, body: { error: 'bad_scope' } };
}

// 두 호출자(serverless / dev 미들웨어)가 공유하는 단일 진입점. 분기를 두 벌 두지 않는다.
export function handleControl(admin, payload) {
  return payload?.action === 'reset'
    ? resetVotes(admin, payload.scope, payload.questionId)
    : applySessionAction(admin, payload?.action, payload?.questionId);
}
