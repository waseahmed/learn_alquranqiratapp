-- Admin stats: list participant IDs who answered the current round

create or replace function public.live_quiz_admin_stats(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  s public.live_quiz_state;
  total_joined bigint;
  answered bigint;
  c1 bigint;
  c2 bigint;
  c3 bigint;
  answered_ids jsonb;
begin
  if not public.live_quiz_check_pin(p_pin) then
    raise exception 'Invalid admin PIN';
  end if;

  select count(*) into total_joined from public.live_quiz_participants;
  select * into s from public.live_quiz_state where id = 1;

  if s.round_id is null then
    return jsonb_build_object(
      'total_joined', total_joined,
      'phase', s.phase,
      'question_number', s.question_number,
      'round_id', null,
      'answered_count', 0,
      'option_counts', jsonb_build_array(0, 0, 0),
      'host_option', s.selected_option,
      'answered_participant_ids', '[]'::jsonb
    );
  end if;

  select count(*) into answered
  from public.live_quiz_votes v
  where v.round_id = s.round_id;

  select
    count(*) filter (where option_number = 1),
    count(*) filter (where option_number = 2),
    count(*) filter (where option_number = 3)
  into c1, c2, c3
  from public.live_quiz_votes v
  where v.round_id = s.round_id;

  select coalesce(
    jsonb_agg(v.participant_id::text order by v.created_at),
    '[]'::jsonb
  )
  into answered_ids
  from public.live_quiz_votes v
  where v.round_id = s.round_id;

  return jsonb_build_object(
    'total_joined', total_joined,
    'phase', s.phase,
    'question_number', s.question_number,
    'round_id', s.round_id,
    'answered_count', answered,
    'option_counts', jsonb_build_array(c1, c2, c3),
    'host_option', s.selected_option,
    'answered_participant_ids', answered_ids
  );
end;
$$;