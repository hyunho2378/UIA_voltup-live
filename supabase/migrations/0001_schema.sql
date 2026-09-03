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
