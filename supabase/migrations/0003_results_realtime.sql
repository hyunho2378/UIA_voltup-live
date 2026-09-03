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
