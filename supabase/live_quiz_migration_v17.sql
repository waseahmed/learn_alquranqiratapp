-- Fix Supabase safe-update: competition point resets need a WHERE clause

create or replace function public.live_quiz_admin_clear_answers(p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.live_quiz_check_pin(p_pin) then
    raise exception 'Invalid admin PIN';
  end if;

  delete from public.live_quiz_votes;

  update public.live_quiz_participants
  set competition_points = 0
  where competition_points <> 0;

  update public.live_quiz_state
  set
    phase = 'waiting',
    question_number = null,
    selected_option = null,
    round_id = gen_random_uuid(),
    last_podium = null,
    group_intro_token = null,
    session_progress = null,
    group_finale = null,
    last_group_results = '{}'::jsonb,
    phase_started_at = now(),
    updated_at = now()
  where id = 1;
end;
$$;

create or replace function public.live_quiz_admin_clear_group_answers(p_pin text, p_group_id int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.live_quiz_state;
  qnums int[];
  gname text;
  gmode text;
  reset_on_air boolean := false;
begin
  if not public.live_quiz_check_pin(p_pin) then
    raise exception 'Invalid admin PIN';
  end if;

  select name, mode into gname, gmode
  from public.live_quiz_groups
  where id = p_group_id;

  if gname is null then
    raise exception 'Unknown group';
  end if;

  select coalesce(array_agg(q.question_number), array[]::int[])
  into qnums
  from public.live_quiz_questions q
  where q.group_id = p_group_id;

  if cardinality(qnums) > 0 then
    delete from public.live_quiz_votes v
    where v.question_number = any(qnums);
  end if;

  if gmode = 'competition' then
    update public.live_quiz_participants
    set competition_points = 0
    where competition_points <> 0;

    update public.live_quiz_state
    set
      last_podium = null,
      last_group_results = coalesce(last_group_results, '{}'::jsonb) - p_group_id::text,
      group_finale = case
        when (group_finale->>'group_id')::int = p_group_id then null
        else group_finale
      end,
      session_progress = case
        when (session_progress->>'group_id')::int = p_group_id then null
        else session_progress
      end,
      updated_at = now()
    where id = 1;
  else
    update public.live_quiz_state
    set
      last_group_results = coalesce(last_group_results, '{}'::jsonb) - p_group_id::text,
      group_finale = case
        when (group_finale->>'group_id')::int = p_group_id then null
        else group_finale
      end,
      session_progress = case
        when (session_progress->>'group_id')::int = p_group_id then null
        else session_progress
      end,
      updated_at = now()
    where id = 1;
  end if;

  select * into s from public.live_quiz_state where id = 1;

  if s.question_number is not null then
    select exists (
      select 1
      from public.live_quiz_questions q
      where q.question_number = s.question_number
        and q.group_id = p_group_id
    )
    into reset_on_air;
  end if;

  if reset_on_air then
    update public.live_quiz_state
    set
      phase = 'waiting',
      question_number = null,
      selected_option = null,
      round_id = gen_random_uuid(),
      last_podium = null,
      group_intro_token = null,
      phase_started_at = now(),
      updated_at = now()
    where id = 1;
  end if;
end;
$$;

grant execute on function public.live_quiz_admin_clear_answers(text) to anon, authenticated;
grant execute on function public.live_quiz_admin_clear_group_answers(text, int) to anon, authenticated;