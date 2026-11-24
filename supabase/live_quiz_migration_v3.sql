-- Run after live_quiz.sql / live_quiz_migration_v2.sql

alter table public.live_quiz_participants
  add column if not exists last_seen_at timestamptz not null default now();

update public.live_quiz_participants
set last_seen_at = coalesce(last_seen_at, created_at, now());

create or replace function public.live_quiz_heartbeat(p_participant_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  ts timestamptz := now();
begin
  update public.live_quiz_participants
  set last_seen_at = ts
  where id = p_participant_id;
  if not found then
    raise exception 'Unknown participant';
  end if;
  return ts;
end;
$$;

grant execute on function public.live_quiz_heartbeat(uuid) to anon, authenticated;

create or replace function public.live_quiz_list_participants(p_pin text)
returns setof public.live_quiz_participants
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.live_quiz_check_pin(p_pin) then
    raise exception 'Invalid admin PIN';
  end if;
  return query
  select *
  from public.live_quiz_participants
  order by last_seen_at desc nulls last, created_at desc
  limit 300;
end;
$$;

create or replace function public.live_quiz_admin_remove_participant(
  p_pin text,
  p_participant_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.live_quiz_check_pin(p_pin) then
    raise exception 'Invalid admin PIN';
  end if;
  delete from public.live_quiz_participants where id = p_participant_id;
  if not found then
    raise exception 'Participant not found';
  end if;
end;
$$;

grant execute on function public.live_quiz_admin_remove_participant(text, uuid) to anon, authenticated;

create or replace function public.live_quiz_admin_detailed_analysis(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  result jsonb := '[]'::jsonb;
  q int;
  q_counts jsonb;
  q_responses jsonb;
  c1 bigint;
  c2 bigint;
  c3 bigint;
  total bigint;
begin
  if not public.live_quiz_check_pin(p_pin) then
    raise exception 'Invalid admin PIN';
  end if;

  for q in 1..5 loop
    select
      count(*) filter (where option_number = 1),
      count(*) filter (where option_number = 2),
      count(*) filter (where option_number = 3),
      count(*)
    into c1, c2, c3, total
    from public.live_quiz_votes v
    where v.question_number = q;

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'participant_id', p.id,
        'kid_name', p.kid_name,
        'parent_role', p.parent_role,
        'option_number', v.option_number,
        'answered_at', v.created_at,
        'round_id', v.round_id
      )
      order by v.created_at desc
    ), '[]'::jsonb)
    into q_responses
    from public.live_quiz_votes v
    join public.live_quiz_participants p on p.id = v.participant_id
    where v.question_number = q;

    q_counts := jsonb_build_array(coalesce(c1, 0), coalesce(c2, 0), coalesce(c3, 0));

    result := result || jsonb_build_array(jsonb_build_object(
      'question_number', q,
      'total_answers', coalesce(total, 0),
      'option_counts', q_counts,
      'responses', q_responses
    ));
  end loop;

  return jsonb_build_object(
    'questions', result,
    'total_participants', (select count(*) from public.live_quiz_participants),
    'total_votes', (select count(*) from public.live_quiz_votes)
  );
end;
$$;

grant execute on function public.live_quiz_admin_detailed_analysis(text) to anon, authenticated;