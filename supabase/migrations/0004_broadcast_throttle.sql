-- voltup-live · 0004 broadcast 쓰로틀
-- 투표 1건마다 전체 집계를 쏘던 것을 질문당 250ms 로 병합한다.
-- 비파괴: CREATE OR REPLACE 와 IF NOT EXISTS 만. 재실행 안전.

-- 질문별 마지막 broadcast 시각 기록용 경량 테이블(집계 아님, 타임스탬프만)
create table if not exists public.results_pulse (
  question_id uuid primary key references public.questions(id) on delete cascade,
  last_sent   timestamptz not null default 'epoch'
);
alter table public.results_pulse enable row level security; -- 정책 없음: 클라이언트 접근 0, 트리거(SECURITY DEFINER)만 사용

-- 트리거 함수 교체: 마지막 broadcast 후 250ms 미만이면 이번 INSERT 는 쏘지 않는다.
-- 마지막 투표는 반드시 반영돼야 하므로, 스킵된 변경은 지연 발사가 아니라 "다음 투표가 곧 온다" 전제.
-- 투표가 멈춘 뒤 마지막 1건이 250ms 안에 들어와 스킵될 위험 → 마감(close_voting) 시 어드민 경로가 강제 1회 재발사.
create or replace function public.broadcast_vote_results()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ok boolean;
  payload jsonb;
begin
  insert into public.results_pulse(question_id, last_sent)
  values (new.question_id, now())
  on conflict (question_id) do update set last_sent = now()
  where public.results_pulse.last_sent < now() - interval '250 milliseconds'
  returning true into ok;

  if ok is null then
    return new; -- 250ms 이내 → 병합(스킵)
  end if;

  payload := jsonb_build_object('results', public.get_results(new.question_id),
                                'live_count', public.get_live_count(new.question_id));
  perform realtime.send(payload, 'results', 'results:' || new.question_id::text, false);
  return new;
end $$;

-- 명시적 재발사 RPC(마감 시 어드민이 호출해 최종 집계를 확정 전송)
create or replace function public.flush_results(q_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.results_pulse set last_sent = now() where question_id = q_id;
  perform realtime.send(
    jsonb_build_object('results', public.get_results(q_id), 'live_count', public.get_live_count(q_id), 'final', true),
    'results', 'results:' || q_id::text, false);
end $$;
grant execute on function public.flush_results(uuid) to service_role;
