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
