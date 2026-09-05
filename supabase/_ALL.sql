-- voltup-live · _ALL.sql
-- 0001 → 0002 → 0003 → 0004 → 0005 → seed → 0006 을 이어붙인 단일 파일.
-- Supabase 대시보드 SQL Editor 에 전체를 붙여넣고 한 번에 Run.
-- 개별 파일을 고치면 이 파일을 다시 만든다(정본은 migrations/ 와 seed.sql).

-- ===== 0001_schema =====
-- voltup-live · 0001 schema
-- 비파괴 원칙: CREATE ... IF NOT EXISTS 만. DROP TABLE / DROP COLUMN / TRUNCATE 없음.
-- 컬럼 추가가 필요하면 반드시 ALTER TABLE ... ADD COLUMN IF NOT EXISTS 로 한다.

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- questions ---------------------------------------------------------------
create table if not exists public.questions (
  id         uuid primary key default gen_random_uuid(),
  order_no   int  not null,
  type       text not null check (type in ('choice','text')),
  title      text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists questions_order_no_key on public.questions(order_no);

-- options -----------------------------------------------------------------
create table if not exists public.options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  order_no    int  not null,
  label       text not null
);
create unique index if not exists options_question_order_key on public.options(question_id, order_no);
create index        if not exists options_question_idx       on public.options(question_id);

-- sessions (단일 제어 행) --------------------------------------------------
create table if not exists public.sessions (
  id                 uuid primary key default gen_random_uuid(),
  active_question_id uuid references public.questions(id) on delete set null,
  voting_open        boolean not null default false,
  results_visible    boolean not null default false,
  status             text    not null default 'standby' check (status in ('standby','live','ended')),
  updated_at         timestamptz not null default now()
);

-- votes -------------------------------------------------------------------
create table if not exists public.votes (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  option_id   uuid references public.options(id) on delete cascade,
  text_value  text,
  voter_key   text not null,
  created_at  timestamptz not null default now(),
  constraint votes_one_answer check (
    (option_id is not null and text_value is null)
    or (option_id is null and text_value is not null)
  ),
  constraint votes_unique_per_voter unique (question_id, voter_key)
);
create index if not exists votes_question_idx        on public.votes(question_id);
create index if not exists votes_question_option_idx on public.votes(question_id, option_id);

-- sessions.updated_at 자동 갱신 -------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists sessions_touch_updated_at on public.sessions;
create trigger sessions_touch_updated_at
before update on public.sessions
for each row execute function public.touch_updated_at();


-- ===== 0002_rls =====
-- voltup-live · 0002 RLS
-- 청중(anon)은: questions/options/sessions 읽기 + votes INSERT 만.
-- votes SELECT 정책 없음 → 원시 votes 클라이언트 조회 불가. 집계는 0003 의 SECURITY DEFINER RPC 로만.
-- 어드민 쓰기(sessions 제어)는 정책 없음 → serverless 함수가 service_role 로 우회(SUPABASE.md).

alter table public.questions enable row level security;
alter table public.options   enable row level security;
alter table public.sessions  enable row level security;
alter table public.votes     enable row level security;

drop policy if exists questions_read on public.questions;
create policy questions_read on public.questions
  for select to anon, authenticated using (true);

drop policy if exists options_read on public.options;
create policy options_read on public.options
  for select to anon, authenticated using (true);

drop policy if exists sessions_read on public.sessions;
create policy sessions_read on public.sessions
  for select to anon, authenticated using (true);

-- votes: INSERT 만. 현재 열린 질문에만. 옵션은 그 질문 소속이어야.
drop policy if exists votes_insert_open on public.votes;
create policy votes_insert_open on public.votes
  for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.sessions s
      where s.voting_open = true
        and s.active_question_id = votes.question_id
    )
    and (
      votes.option_id is null
      or exists (
        select 1 from public.options o
        where o.id = votes.option_id
          and o.question_id = votes.question_id
      )
    )
  );


-- ===== 0003_results_realtime =====
-- voltup-live · 0003 집계 RPC + 실시간
-- 화면은 원시 votes 를 받지 않는다. 집계 RPC(초기/재연결) + broadcast(라이브)만.

create or replace function public.get_results(q_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  q_type      text;
  result      jsonb;
  total_count int;
begin
  select type into q_type from public.questions where id = q_id;

  if q_type is null then
    return jsonb_build_object('question_id', q_id, 'type', null, 'total', 0, 'items', '[]'::jsonb);
  end if;

  if q_type = 'choice' then
    select jsonb_build_object(
             'question_id', q_id,
             'type', 'choice',
             'total', coalesce(sum(c.cnt), 0)::int,
             'items', coalesce(
               jsonb_agg(
                 jsonb_build_object(
                   'option_id', o.id,
                   'label',     o.label,
                   'order_no',  o.order_no,
                   'count',     coalesce(c.cnt, 0)
                 ) order by o.order_no
               ),
               '[]'::jsonb
             )
           )
      into result
      from public.options o
      left join (
        select option_id, count(*)::int as cnt
        from public.votes
        where question_id = q_id and option_id is not null
        group by option_id
      ) c on c.option_id = o.id
     where o.question_id = q_id;

    return result;
  end if;

  select count(*)::int
    into total_count
    from public.votes
   where question_id = q_id and text_value is not null and btrim(text_value) <> '';

  select coalesce(
           jsonb_agg(jsonb_build_object('word', w.word, 'count', w.cnt)
                     order by w.cnt desc, w.word),
           '[]'::jsonb
         )
    into result
    from (
      select lower(btrim(text_value)) as word, count(*)::int as cnt
      from public.votes
      where question_id = q_id and text_value is not null and btrim(text_value) <> ''
      group by lower(btrim(text_value))
      order by cnt desc, word
      limit 100
    ) w;

  return jsonb_build_object('question_id', q_id, 'type', 'text', 'total', total_count, 'items', result);
end $$;

grant execute on function public.get_results(uuid) to anon, authenticated;

create or replace function public.get_live_count(q_id uuid)
returns int
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int from public.votes where question_id = q_id;
$$;

grant execute on function public.get_live_count(uuid) to anon, authenticated;

-- 투표 INSERT 시 집계만 broadcast (원시 row 아님).
-- realtime.send(payload jsonb, event text, topic text, private boolean)
create or replace function public.broadcast_vote_results()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
begin
  payload := jsonb_build_object(
    'results',    public.get_results(new.question_id),
    'live_count', public.get_live_count(new.question_id)
  );
  perform realtime.send(
    payload,
    'results',
    'results:' || new.question_id::text,
    false
  );
  return new;
end $$;

drop trigger if exists votes_broadcast_results on public.votes;
create trigger votes_broadcast_results
after insert on public.votes
for each row execute function public.broadcast_vote_results();

-- sessions 만 Postgres Changes 로 스트림. votes 는 스트림하지 않는다.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sessions'
    ) then
      execute 'alter publication supabase_realtime add table public.sessions';
    end if;
  end if;
end $$;


-- ===== 0004_broadcast_throttle =====
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


-- ===== 0005_status_backup =====
-- voltup-live · 0005 sessions.status 에 'backup' 추가
-- 비파괴: CHECK 제약만 확장한다. status 값이나 컬럼을 지우지 않는다.

alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions add constraint sessions_status_check
  check (status in ('standby','live','ended','backup'));


-- ===== seed =====
-- voltup-live · seed (개발용). 비파괴: ON CONFLICT DO NOTHING.
-- 실제 문안 확정 시 SOURCE.md 원문으로 교체(윤문 금지). 더미는 '[더미]' 접두사.

insert into public.sessions (id, status)
values ('00000000-0000-0000-0000-000000000001', 'standby')
on conflict (id) do nothing;

insert into public.questions (id, order_no, type, title) values
  ('11111111-0000-0000-0000-000000000001', 1, 'choice', '[더미] 오늘 세션에서 가장 기대되는 주제는?'),
  ('11111111-0000-0000-0000-000000000002', 2, 'choice', '[더미] 임팩트를 만든다면 어느 영역인가?'),
  ('11111111-0000-0000-0000-000000000003', 3, 'text',   '[더미] 이 포럼을 한 단어로 표현하면?')
on conflict (id) do nothing;

insert into public.options (id, question_id, order_no, label) values
  ('22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001',1,'기술'),
  ('22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000001',2,'정책'),
  ('22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000001',3,'교육'),
  ('22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000001',4,'환경'),
  ('22222222-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000002',1,'지역사회'),
  ('22222222-0000-0000-0000-000000000006','11111111-0000-0000-0000-000000000002',2,'글로벌'),
  ('22222222-0000-0000-0000-000000000007','11111111-0000-0000-0000-000000000002',3,'개인')
on conflict (id) do nothing;

-- ===== 0006_remove_backup =====
-- voltup-live · 0006 백업 전환 기능 제거
-- 백업(Slido 전환) 경로를 앱에서 없앴다. status 에서 'backup' 을 되돌린다.
-- 비파괴: 컬럼·행·투표를 지우지 않는다. 남아 있는 'backup' 값만 'standby' 로 정리하고 CHECK 를 축소한다.

update public.sessions set status = 'standby' where status = 'backup';

alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions add constraint sessions_status_check
  check (status in ('standby','live','ended'));
