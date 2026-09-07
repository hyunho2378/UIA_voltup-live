// 세션 제어 로직의 단일 출처. 프로덕션 serverless(api/session-control.js)와
// 로컬 dev 미들웨어(vite.config.js)가 같은 함수를 쓴다. switch 를 두 벌 두지 않는다.

export const SESSION_ID = '00000000-0000-0000-0000-000000000001';

export function patchFor(action, questionId) {
  switch (action) {
    case 'set_question': return { active_question_id: questionId, voting_open: false, results_visible: false, status: 'live', results_view: 'bars' };
    case 'open_voting':  return { voting_open: true };
    case 'close_voting': return { voting_open: false };
    case 'show_results': return { results_visible: true };
    case 'hide_results': return { results_visible: false };
    // 결과 뷰 전환. 같은 집계를 다르게 배치할 뿐이라 집계·투표 상태는 건드리지 않는다.
    case 'view_bars':    return { results_view: 'bars' };
    case 'view_cloud':   return { results_view: 'cloud' };
    case 'standby':      return { status: 'standby', voting_open: false, results_visible: false };
    case 'end':          return { status: 'ended', voting_open: false };
    default: return null;
  }
}

// admin 은 secret 키로 만든 supabase 클라이언트. RLS 를 우회하는 유일한 경로다.
export async function applySessionAction(admin, action, questionId) {
  const patch = patchFor(action, questionId);
  if (!patch) return { status: 400, body: { error: 'unknown_action' } };

  let { data, error } = await admin.from('sessions').update(patch).eq('id', SESSION_ID).select().single();

  // 0007(results_view) 미적용 DB 배포 가드. 코드가 마이그레이션보다 먼저 올라가도
  // 질문 전환 같은 기본 제어가 죽지 않게 한다. 뷰 전환만 안 되고 나머지는 그대로 동작한다.
  // 0007 이 모든 환경에 적용되면 이 블록은 지워도 된다.
  if (error && 'results_view' in patch && /results_view/.test(error.message)) {
    const { results_view, ...rest } = patch;
    if (Object.keys(rest).length === 0) return { status: 501, body: { error: 'results_view_not_migrated' } };
    console.warn('sessions.results_view 없음. 0007 미적용 상태로 동작한다.');
    ({ data, error } = await admin.from('sessions').update(rest).eq('id', SESSION_ID).select().single());
  }
  if (error) return { status: 500, body: { error: error.message } };

  // 집계가 사람 눈앞에 확정되는 두 순간에 최종 집계를 다시 쏜다.
  // 250ms 병합 때문에 마지막 투표들은 broadcast 되지 않은 채 남아 있을 수 있다.
  // close_voting: 마감. show_results: 결과 공개(투표를 안 닫고 공개하는 진행이 실제로 있다).
  if ((action === 'close_voting' || action === 'show_results') && data.active_question_id) {
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
