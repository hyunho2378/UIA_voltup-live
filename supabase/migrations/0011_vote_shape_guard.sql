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
