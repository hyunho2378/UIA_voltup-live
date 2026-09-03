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
    case 'backup':       return { status: 'backup',  voting_open: false, results_visible: false };
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
