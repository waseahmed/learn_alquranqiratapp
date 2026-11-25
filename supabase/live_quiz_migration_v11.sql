-- Millisecond rankings, auto-finalize when timer ends, group-scoped analysis

create or replace function public.live_quiz_award_competition_round(p_round_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.live_quiz_state;
  q public.live_quiz_questions;
  g public.live_quiz_groups;
  podium jsonb := '[]'::jsonb;
  ranking jsonb;
  r record;
  place int := 0;
  pts int;
  pts_list int[] := array[300, 200, 100];
  existing jsonb;
  qnum int;
begin
  if p_round_id is null then
    return '[]'::jsonb;
  end if;

  select last_podium into existing from public.live_quiz_state where id = 1;
  if existing is not null
    and existing->>'round_id' = p_round_id::text
    and coalesce(existing->>'finalized', 'false') = 'true' then
    return coalesce(existing->'places', '[]'::jsonb);
  end if;

  select * into s from public.live_quiz_state where id = 1;
  qnum := s.question_number;
  if qnum is null then
    select v.question_number into qnum
    from public.live_quiz_votes v
    where v.round_id = p_round_id
    limit 1;
  end if;
  if qnum is null then
    return '[]'::jsonb;
  end if;

  select * into q from public.live_quiz_questions where question_number = qnum;
  if not found then
    return '[]'::jsonb;
  end if;

  g := null;
  if q.group_id is not null then
    select * into g from public.live_quiz_groups where id = q.group_id;
  end if;

  if g is not null and g.mode = 'competition' and q.correct_option is not null then
    place := 0;
    for r in
      select
        v.participant_id,
        v.created_at,
        v.option_number,
        p.kid_name,
        p.parent_role,
        round(
          (extract(epoch from (v.created_at - s.phase_started_at)) * 1000)::numeric,
          0
        )::bigint as response_ms
      from public.live_quiz_votes v
      join public.live_quiz_participants p on p.id = v.participant_id
      where v.round_id = p_round_id
        and v.option_number = q.correct_option
      order by v.created_at
    loop
      place := place + 1;
      pts := case when place <= 3 then pts_list[place] else 0 end;
      if place <= 3 then
        update public.live_quiz_participants
        set competition_points = competition_points + pts
        where id = r.participant_id;
      end if;

      podium := podium || jsonb_build_array(jsonb_build_object(
        'place', place,
        'participant_id', r.participant_id,
        'kid_name', r.kid_name,
        'parent_role', r.parent_role,
        'points_awarded', pts,
        'response_ms', r.response_ms,
        'answered_at', r.created_at
      ));
    end loop;

    select coalesce(jsonb_agg(jsonb_build_object(
      'rank', sub.rn,
      'participant_id', sub.participant_id,
      'kid_name', sub.kid_name,
      'parent_role', sub.parent_role,
      'option_number', sub.option_number,
      'is_correct', true,
      'response_ms', sub.response_ms,
      'answered_at', sub.created_at,
      'points_awarded', case sub.rn when 1 then 300 when 2 then 200 when 3 then 100 else 0 end
    ) order by sub.rn), '[]'::jsonb)
    into ranking
    from (
      select
        row_number() over (order by v.created_at) as rn,
        v.participant_id,
        v.created_at,
        v.option_number,
        p.kid_name,
        p.parent_role,
        round(
          (extract(epoch from (v.created_at - s.phase_started_at)) * 1000)::numeric,
          0
        )::bigint as response_ms
      from public.live_quiz_votes v
      join public.live_quiz_participants p on p.id = v.participant_id
      where v.round_id = p_round_id
        and v.option_number = q.correct_option
    ) sub;
  else
    select coalesce(jsonb_agg(jsonb_build_object(
      'rank', sub.rn,
      'participant_id', sub.participant_id,
      'kid_name', sub.kid_name,
      'parent_role', sub.parent_role,
      'option_number', sub.option_number,
      'is_correct', sub.is_correct,
      'response_ms', sub.response_ms,
      'answered_at', sub.created_at,
      'points_awarded', 0
    ) order by sub.rn), '[]'::jsonb)
    into ranking
    from (
      select
        row_number() over (order by v.created_at) as rn,
        v.participant_id,
        v.created_at,
        v.option_number,
        p.kid_name,
        p.parent_role,
        (q.correct_option is not null and v.option_number = q.correct_option) as is_correct,
        round(
          (extract(epoch from (v.created_at - s.phase_started_at)) * 1000)::numeric,
          0
        )::bigint as response_ms
      from public.live_quiz_votes v
      join public.live_quiz_participants p on p.id = v.participant_id
      where v.round_id = p_round_id
    ) sub;

    podium := '[]'::jsonb;
  end if;

  update public.live_quiz_state
  set last_podium = jsonb_build_object(
    'round_id', p_round_id,
    'question_number', qnum,
    'question_title', q.title,
    'group_mode', coalesce(g.mode, 'poll'),
    'places', podium,
    'ranking', coalesce(ranking, '[]'::jsonb),
    'finalized', true,
    'finalized_at', now()
  )
  where id = 1;

  return podium;
end;
$$;

create or replace function public.live_quiz_maybe_finalize_current_round()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.live_quiz_state;
  expires_at timestamptz;
begin
  select * into s from public.live_quiz_state where id = 1;
  if s.phase is distinct from 'question' or s.round_id is null or s.question_number is null then
    return;
  end if;

  expires_at := s.phase_started_at + make_interval(secs => coalesce(s.timer_seconds, 10));
  if now() < expires_at then
    return;
  end if;

  perform public.live_quiz_award_competition_round(s.round_id);
end;
$$;

grant execute on function public.live_quiz_maybe_finalize_current_round() to anon, authenticated;

create or replace function public.live_quiz_public_round_results()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  s public.live_quiz_state;
  p jsonb;
  expires_at timestamptz;
begin
  select * into s from public.live_quiz_state where id = 1;

  if s.phase = 'question' and s.round_id is not null then
    expires_at := s.phase_started_at + make_interval(secs => coalesce(s.timer_seconds, 10));
    if now() >= expires_at then
      perform public.live_quiz_maybe_finalize_current_round();
    end if;
  end if;

  select last_podium into p from public.live_quiz_state where id = 1;

  return jsonb_build_object(
    'phase', s.phase,
    'round_id', s.round_id,
    'last_podium', coalesce(p, '{}'::jsonb),
    'show_results',
    p is not null
      and coalesce(p->>'finalized', 'false') = 'true'
      and s.round_id is not null
      and p->>'round_id' = s.round_id::text
  );
end;
$$;

grant execute on function public.live_quiz_public_round_results() to anon, authenticated;

create or replace function public.live_quiz_present_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.live_quiz_state;
  lb jsonb;
  q jsonb;
  p jsonb;
  expires_at timestamptz;
begin
  select * into s from public.live_quiz_state where id = 1;

  if s.phase = 'question' and s.round_id is not null then
    expires_at := s.phase_started_at + make_interval(secs => coalesce(s.timer_seconds, 10));
    if now() >= expires_at then
      perform public.live_quiz_maybe_finalize_current_round();
    end if;
  end if;

  select last_podium into p from public.live_quiz_state where id = 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'kid_name', part.kid_name,
    'parent_role', part.parent_role,
    'points', part.competition_points
  ) order by part.competition_points desc, part.kid_name), '[]'::jsonb)
  into lb
  from public.live_quiz_participants part
  where part.competition_points > 0;

  if s.question_number is not null then
    select jsonb_build_object(
      'question_number', qn.question_number,
      'title', qn.title,
      'group_mode', g.mode
    )
    into q
    from public.live_quiz_questions qn
    left join public.live_quiz_groups g on g.id = qn.group_id
    where qn.question_number = s.question_number;
  elsif p is not null and p ? 'question_title' then
    q := jsonb_build_object(
      'question_number', p->'question_number',
      'title', p->>'question_title',
      'group_mode', p->>'group_mode'
    );
  end if;

  return jsonb_build_object(
    'phase', s.phase,
    'remaining_context', q,
    'last_podium', coalesce(p, '{}'::jsonb),
    'leaderboard', lb
  );
end;
$$;

drop function if exists public.live_quiz_admin_detailed_analysis(text);

create or replace function public.live_quiz_admin_detailed_analysis(
  p_pin text,
  p_group_id int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  result jsonb := '[]'::jsonb;
  qr record;
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

  for qr in
    select q.question_number
    from public.live_quiz_questions q
    where p_group_id is null or q.group_id = p_group_id
    order by q.question_number
  loop
    select
      count(*) filter (where option_number = 1),
      count(*) filter (where option_number = 2),
      count(*) filter (where option_number = 3),
      count(*)
    into c1, c2, c3, total
    from public.live_quiz_votes v
    where v.question_number = qr.question_number;

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'participant_id', p.id,
        'kid_name', p.kid_name,
        'parent_role', p.parent_role,
        'option_number', v.option_number,
        'answered_at', v.created_at,
        'round_id', v.round_id
      )
      order by v.created_at asc
    ), '[]'::jsonb)
    into q_responses
    from public.live_quiz_votes v
    join public.live_quiz_participants p on p.id = v.participant_id
    where v.question_number = qr.question_number;

    q_counts := jsonb_build_array(coalesce(c1, 0), coalesce(c2, 0), coalesce(c3, 0));

    result := result || jsonb_build_array(jsonb_build_object(
      'question_number', qr.question_number,
      'total_answers', coalesce(total, 0),
      'option_counts', q_counts,
      'responses', q_responses
    ));
  end loop;

  return jsonb_build_object(
    'questions', result,
    'group_id', p_group_id,
    'total_participants', (select count(*) from public.live_quiz_participants),
    'total_votes', (
      select count(*) from public.live_quiz_votes v
      join public.live_quiz_questions qq on qq.question_number = v.question_number
      where p_group_id is null or qq.group_id = p_group_id
    )
  );
end;
$$;