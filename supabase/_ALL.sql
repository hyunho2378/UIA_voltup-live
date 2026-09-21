-- voltup-live · _ALL.sql
-- 0001 → 0002 → 0003 → 0004 → 0005 → 0006 → 0007 → 0008 → 0009 → seed 를 이어붙인 단일 파일.
-- seed 가 맨 뒤인 이유: 시드의 초기 status 가 'cover' 라 0008(CHECK 확장) 뒤에 와야 한다.
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


-- ===== 0006_remove_backup =====
-- voltup-live · 0006 백업 전환 기능 제거
-- 백업(Slido 전환) 경로를 앱에서 없앴다. status 에서 'backup' 을 되돌린다.
-- 비파괴: 컬럼·행·투표를 지우지 않는다. 남아 있는 'backup' 값만 'standby' 로 정리하고 CHECK 를 축소한다.

update public.sessions set status = 'standby' where status = 'backup';

alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions add constraint sessions_status_check
  check (status in ('standby','live','ended'));

-- ===== 0007_results_view =====
-- voltup-live · 0007 결과 뷰 전환 (막대 ↔ 워드클라우드)
-- 주관식 결과를 대형화면에서 어떤 형태로 그릴지 어드민이 정한다. 집계는 그대로다(같은 데이터, 다른 배치).
-- 비파괴: 컬럼 추가만. 기존 행은 default 'bars' 로 채워진다.

alter table public.sessions add column if not exists results_view text not null default 'bars'
  check (results_view in ('bars','cloud'));

-- ===== 0008_cover_state =====
-- voltup-live · 0008 sessions.status 에 'cover' 추가
-- 대형화면에 모듈 시작을 알리는 오프닝(커버) 상태 하나를 더한다.
-- 비파괴: CHECK 제약만 확장한다. 기존 값·행을 지우지 않는다.

alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions add constraint sessions_status_check
  check (status in ('standby','live','ended','cover'));

-- ===== 0009_closing_state =====
-- voltup-live · 0009 sessions.status 에 'closing' 추가
-- 마지막 순서에 띄우는 홍보 화면(2026 세계경주포럼 로고 + 참가등록 QR).
-- 비파괴: CHECK 제약만 확장한다.

alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions add constraint sessions_status_check
  check (status in ('standby','live','ended','cover','closing'));

-- ===== 0010_scale_question =====
-- voltup-live · 0010 척도(슬라이더) 질문 타입 추가
-- 큐시트가 Q1 을 "5개 이산 선택지"에서 "1~5점, 0.5 단위(.5 가능) 연속 척도"로 바꿨다.
-- 슬라이더로 답하고 대형화면도 슬라이더 같은 분포로 보여준다(사용자 요청: "이게 인터랙티브지").
-- 비파괴: CHECK 제약 확장 + 컬럼 추가만. 기존 choice/text 데이터·행은 그대로 둔다.

alter table public.questions drop constraint if exists questions_type_check;
alter table public.questions add constraint questions_type_check
  check (type in ('choice', 'text', 'scale'));

-- 척도값. 1.0~5.0, 0.5 단위만 허용. option_id/text_value 와 마찬가지로 votes_one_answer 가
-- 셋 중 정확히 하나만 채워지도록 강제한다(다른 타입 질문의 무결성은 그대로 유지).
alter table public.votes add column if not exists scale_value numeric(2, 1);

alter table public.votes drop constraint if exists votes_one_answer;
alter table public.votes add constraint votes_one_answer check (
  (option_id is not null and text_value is null and scale_value is null)
  or (option_id is null and text_value is not null and scale_value is null)
  or (option_id is null and text_value is null and scale_value is not null)
);

alter table public.votes drop constraint if exists votes_scale_range;
alter table public.votes add constraint votes_scale_range check (
  scale_value is null
  or (scale_value >= 1 and scale_value <= 5 and scale_value * 2 = trunc(scale_value * 2))
);

-- get_results 에 scale 분기 추가. generate_series 로 1~5 사이 9개 눈금을 전부 만들어(0표 눈금도 포함)
-- choice 의 LEFT JOIN 과 같은 방식으로 눈금마다 count 를 채운다. average 는 클라이언트가 다시 계산하지
-- 않도록 서버에서 미리 반올림해 내려준다.
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
  avg_value   numeric;
  items       jsonb;
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

  if q_type = 'scale' then
    select count(*)::int, coalesce(round(avg(scale_value), 2), 0)::numeric
      into total_count, avg_value
      from public.votes
     where question_id = q_id and scale_value is not null;

    select coalesce(
             jsonb_agg(jsonb_build_object('value', t.val, 'count', coalesce(c.cnt, 0)) order by t.val),
             '[]'::jsonb
           )
      into items
      from (select generate_series(1, 5, 0.5) as val) t
      left join (
        select scale_value, count(*)::int as cnt
        from public.votes
        where question_id = q_id and scale_value is not null
        group by scale_value
      ) c on c.scale_value = t.val;

    return jsonb_build_object(
      'question_id', q_id,
      'type', 'scale',
      'total', total_count,
      'average', avg_value,
      'items', items
    );
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

-- ===== 0011_vote_shape_guard =====
-- voltup-live · 0011 투표 형태 검증 + 참여 수 집계 일치
--
-- 증상: 투표 1건을 했는데 대형화면에 "1명 참여"만 뜨고 막대에는 0표로 남았다.
-- 원인: Q1 이 choice → scale 로 바뀌었는데 청중 폰에 "떠 있던 예전 페이지"(새로고침 전 번들)가
--       남아 있어, 그 화면이 선택지 버튼을 그리고 option_id 로 투표를 넣었다.
--       get_results 의 scale 분기는 scale_value 가 있는 행만 세므로 이 표는 집계에서 빠지는데,
--       get_live_count 는 질문의 모든 행을 세서 1명으로 잡혔다. 그래서 숫자가 어긋난다.
--
-- 이 마이그레이션은 두 가지를 한다.
--   (1) 질문 타입에 맞지 않는 투표를 INSERT 단계에서 거부한다. 표가 조용히 사라지는 대신
--       청중 화면에 "새로고침" 안내가 뜬다. 오래된 화면이 남아 있어도 표를 잃지 않는다.
--   (2) get_live_count 를 타입별 집계와 같은 기준으로 맞춘다. 참여 수와 막대 합이 항상 일치한다.
--
-- 비파괴: 기존 행·컬럼을 건드리지 않는다. 함수 교체와 트리거 추가만 한다.

-- (1) 투표 형태 검증 -------------------------------------------------------
-- CHECK 로는 다른 테이블(questions.type)을 참조할 수 없어 BEFORE INSERT 트리거로 만든다.
create or replace function public.validate_vote_shape()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  q_type text;
begin
  select type into q_type from public.questions where id = new.question_id;

  if q_type is null then
    raise exception 'unknown_question' using errcode = '22023';
  end if;

  if q_type = 'choice' and new.option_id is null then
    raise exception 'vote_shape_mismatch: choice 질문에는 option_id 가 필요하다' using errcode = '22023';
  end if;

  if q_type = 'scale' and new.scale_value is null then
    raise exception 'vote_shape_mismatch: scale 질문에는 scale_value 가 필요하다' using errcode = '22023';
  end if;

  if q_type = 'text' and (new.text_value is null or btrim(new.text_value) = '') then
    raise exception 'vote_shape_mismatch: text 질문에는 text_value 가 필요하다' using errcode = '22023';
  end if;

  return new;
end $$;

drop trigger if exists votes_validate_shape on public.votes;
create trigger votes_validate_shape
before insert on public.votes
for each row execute function public.validate_vote_shape();

-- (2) 참여 수를 타입별 집계 기준과 일치시킨다 ------------------------------
create or replace function public.get_live_count(q_id uuid)
returns int
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  q_type text;
  c      int;
begin
  select type into q_type from public.questions where id = q_id;

  if q_type = 'choice' then
    select count(*) into c from public.votes
     where question_id = q_id and option_id is not null;
  elsif q_type = 'scale' then
    select count(*) into c from public.votes
     where question_id = q_id and scale_value is not null;
  elsif q_type = 'text' then
    select count(*) into c from public.votes
     where question_id = q_id and text_value is not null and btrim(text_value) <> '';
  else
    select count(*) into c from public.votes where question_id = q_id;
  end if;

  return coalesce(c, 0);
end $$;

grant execute on function public.get_live_count(uuid) to anon, authenticated;

-- ===== seed =====
-- 질문 1~4 는 SOURCE.md 원문을 문자 그대로 옮긴 것이다. 윤문 금지.

-- 시작 상태는 표지(cover). 포럼 시작 전 링크를 열면 QR 이 아니라 표지가 떠야 한다.
-- QR 은 어드민 "QR 열기"(status='standby')로 명시적으로 연다.
-- 주의: on conflict do nothing 이라 이미 존재하는 행은 이 값으로 바뀌지 않는다.
-- 운영 DB 의 기존 행은 사람이 SQL Editor 에서 한 번 UPDATE 해야 한다(SUPABASE.md 참고).
insert into public.sessions (id, status)
values ('00000000-0000-0000-0000-000000000001', 'cover')
on conflict (id) do nothing;

-- 2026-09-21: 큐시트 최종 대본으로 전체 교체(SOURCE.md 참고). Q2 가 5지→6지로 늘어나는 것도 이 번이다.
insert into public.questions (id, order_no, type, title) values
  ('11111111-0000-0000-0000-000000000001', 1, 'scale',  '현재 한국 대학은 AI와 일자리 등 미래 사회의 변화에 대응할 수 있도록 학생들에게 필요한 교육과 경험을 충분히 제공하고 있다고 생각하십니까?'),
  ('11111111-0000-0000-0000-000000000002', 2, 'choice', '미래 사회를 살아갈 학생들에게 대학이 가장 우선적으로 제공해야 할 것은 무엇이라고 생각하십니까?'),
  ('11111111-0000-0000-0000-000000000003', 3, 'choice', 'UIA(대학임팩트연합)가 가장 우선적으로 나아가야 할 방향은 무엇이라고 생각하십니까?'),
  ('11111111-0000-0000-0000-000000000004', 4, 'text',   '여러분이 생각하는 ''미래의 대학''을 한 단어 또는 짧은 문구로 표현한다면?')
on conflict (id) do update set order_no = excluded.order_no, type = excluded.type, title = excluded.title;

insert into public.options (id, question_id, order_no, label) values
  -- Q1 척도 슬라이더. 중간 3개 라벨은 더 이상 화면에 안 뜬다(2026-09-21, 이산 5버튼→연속 슬라이더).
  -- 양 끝 설명 라벨만 남긴다. order_no 1=최소, 2=최대.
  ('22222222-0001-0000-0000-000000000001','11111111-0000-0000-0000-000000000001',1,'전혀 그렇지 않다'),
  ('22222222-0001-0000-0000-000000000005','11111111-0000-0000-0000-000000000001',2,'매우 그렇다'),
  -- Q2 6지. 큐시트 직접 인용. 새로 늘어난 6번(F)을 포함한다.
  ('22222222-0002-0000-0000-000000000001','11111111-0000-0000-0000-000000000002',1,'AI·데이터 활용 역량'),
  ('22222222-0002-0000-0000-000000000002','11111111-0000-0000-0000-000000000002',2,'변화적응·대응 역량'),
  ('22222222-0002-0000-0000-000000000003','11111111-0000-0000-0000-000000000002',3,'리더십·소통·협업 역량'),
  ('22222222-0002-0000-0000-000000000004','11111111-0000-0000-0000-000000000002',4,'문제를 발견하고 해결하는 역량'),
  ('22222222-0002-0000-0000-000000000005','11111111-0000-0000-0000-000000000002',5,'실제 현장에서 배우는 경험'),
  ('22222222-0002-0000-0000-000000000006','11111111-0000-0000-0000-000000000002',6,'스스로 배우고 진로를 설계하는 역량'),
  -- Q3 5지. 라벨이 이미 짧아서 줄이지 않고 큐시트 그대로 쓴다. 설명은 SOURCE.md(구두용).
  ('22222222-0003-0000-0000-000000000001','11111111-0000-0000-0000-000000000003',1,'캠퍼스 밖에서 배우는 대학'),
  ('22222222-0003-0000-0000-000000000002','11111111-0000-0000-0000-000000000003',2,'전공의 경계를 넘나드는 대학'),
  ('22222222-0003-0000-0000-000000000003','11111111-0000-0000-0000-000000000003',3,'스스로 설계하는 대학'),
  ('22222222-0003-0000-0000-000000000004','11111111-0000-0000-0000-000000000003',4,'AI 시대에 다시 정의되는 대학'),
  ('22222222-0003-0000-0000-000000000005','11111111-0000-0000-0000-000000000003',5,'새로운 인재를 정의하는 대학')
on conflict (id) do update set order_no = excluded.order_no, label = excluded.label;
