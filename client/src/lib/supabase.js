// client/src/lib/supabase.js
// Supabase 클라이언트 + 실시간 구독 헬퍼. SUPABASE.md 채널 규약 준수.
// localStorage/sessionStorage 금지 → persistSession:false. voter_key 는 쿠키(중복 투표 best-effort 차단).

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && publishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false }, // localStorage 미사용
      // 수신측 방어. 청중은 sessions 변경만 받으면 되고 초당 10 이벤트면 충분하다.
      // 폭주 시 supabase-js 가 클라 측에서 완충해 무료 티어 100 msg/s 를 덜 밀어붙인다.
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;

// voter_key: 쿠키 기반. localStorage/sessionStorage 금지 규율 준수.
const VK_COOKIE = 'vk';
export function getVoterKey() {
  const found = document.cookie.split('; ').find((c) => c.startsWith(VK_COOKIE + '='));
  if (found) return found.slice(VK_COOKIE.length + 1);
  const key =
    (typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID()) ||
    String(Date.now()) + Math.random().toString(16).slice(2);
  document.cookie = `${VK_COOKIE}=${key}; path=/; max-age=86400; samesite=lax`;
  return key;
}

// 연결 상태 매핑: Supabase 채널 status → connected/reconnecting/disconnected
export function mapChannelStatus(status) {
  switch (status) {
    case 'SUBSCRIBED':
      return 'connected';
    case 'CHANNEL_ERROR':
    case 'TIMED_OUT':
      return 'reconnecting';
    case 'CLOSED':
    default:
      return 'disconnected';
  }
}

// 제어 상태(sessions) 구독: Postgres Changes. 초기값은 fetchSession 으로 별도 취득.
export function subscribeSession(onChange, onStatus) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('session')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, (payload) =>
      onChange(payload.new)
    )
    .subscribe((status) => onStatus && onStatus(mapChannelStatus(status)));
  return () => supabase.removeChannel(channel);
}

export async function fetchSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.from('sessions').select('*').limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchQuestions() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('questions')
    .select('id, order_no, type, title')
    .order('order_no');
  if (error) throw error;
  return data ?? [];
}

export async function fetchQuestion(questionId) {
  if (!supabase || !questionId) return null;
  const { data, error } = await supabase
    .from('questions')
    .select('id, order_no, type, title, options ( id, order_no, label )')
    .eq('id', questionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// 결과 집계 구독: Broadcast on results:{qid}. 초기/재연결 시 fetchResults 로 보정.
export function subscribeResults(questionId, onResults, onStatus) {
  if (!supabase || !questionId) return () => {};
  const channel = supabase
    .channel('results:' + questionId, { config: { private: false } })
    .on('broadcast', { event: 'results' }, ({ payload }) => onResults(payload))
    .subscribe((status) => onStatus && onStatus(mapChannelStatus(status)));
  return () => supabase.removeChannel(channel);
}

export async function fetchResults(questionId) {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_results', { q_id: questionId });
  if (error) throw error;
  return data;
}

export async function fetchLiveCount(questionId) {
  if (!supabase) return 0;
  const { data, error } = await supabase.rpc('get_live_count', { q_id: questionId });
  if (error) throw error;
  return data ?? 0;
}

// 투표 제출. 서버 unique(question_id, voter_key) 로 중복 차단. 23505 = 이미 투표함.
export async function submitVote({ questionId, optionId = null, textValue = null }) {
  if (!supabase) return { ok: false, reason: 'not_configured' };
  const voter_key = getVoterKey();
  const { error } = await supabase
    .from('votes')
    .insert({ question_id: questionId, option_id: optionId, text_value: textValue, voter_key });
  if (error) {
    if (error.code === '23505') return { ok: false, reason: 'duplicate' };
    return { ok: false, reason: 'error', error };
  }
  return { ok: true };
}
