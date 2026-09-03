-- voltup-live · 0002 RLS
-- 청중(anon)은: questions/options/sessions 읽기 + votes INSERT 만.
-- votes SELECT 정책은 없음 → 원시 votes 클라이언트 조회 불가. 집계는 0003 의 SECURITY DEFINER RPC 로만.
-- 어드민 쓰기(sessions 제어)는 정책을 두지 않는다 → serverless 함수가 service_role 로 우회(0004 계획 / SUPABASE.md 참조).

alter table public.questions enable row level security;
alter table public.options   enable row level security;
alter table public.sessions  enable row level security;
alter table public.votes     enable row level security;

-- questions: 공개 읽기
drop policy if exists questions_read on public.questions;
create policy questions_read on public.questions
  for select to anon, authenticated using (true);

-- options: 공개 읽기
drop policy if exists options_read on public.options;
create policy options_read on public.options
  for select to anon, authenticated using (true);

-- sessions: 공개 읽기 (쓰기 정책 없음 = anon 쓰기 전면 차단)
drop policy if exists sessions_read on public.sessions;
create policy sessions_read on public.sessions
  for select to anon, authenticated using (true);

-- votes: INSERT 만. 그리고 "현재 열린 질문"에만. 옵션은 그 질문 소속이어야.
-- → 닫힌 질문/남의 질문 옵션으로의 투표를 서버에서 차단.
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

-- NOTE: DROP POLICY IF EXISTS 는 정책 정의만 교체하며 데이터를 파괴하지 않는다 → 재적용 안전.
