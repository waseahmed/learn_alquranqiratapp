-- Per-group delete and group-scoped answer reset

create or replace function public.live_quiz_admin_delete_group(p_pin text, p_group_id int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.live_quiz_check_pin(p_pin) then
    raise exception 'Invalid admin PIN';
  end if;

  if not exists (select 1 from public.live_quiz_groups where id = p_group_id) then
    raise exception 'Unknown group';
  end if;

  delete from public.live_quiz_votes v
  where v.question_number in (
    select q.question_number from public.live_quiz_questions q where q.group_id = p_group_id
  );

  delete from public.live_quiz_questions where group_id = p_group_id;
  delete from public.live_quiz_groups where id = p_group_id;
end;
$$;

grant execute on function public.live_quiz_admin_delete_group(text, int) to anon, authenticated;

create or replace function public.live_quiz_admin_delete_question(p_pin text, p_question_number int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.live_quiz_state;
begin
  if not public.live_quiz_check_pin(p_pin) then
    raise exception 'Invalid admin PIN';
  end if;

  delete from public.live_quiz_votes where question_number = p_question_number;
  delete from public.live_quiz_questions where question_number = p_question_number;

  select * into s from public.live_quiz_state where id = 1;
  if s.question_number = p_question_number then
    update public.live_quiz_state
    set
      phase = 'waiting',
      question_number = null,
      selected_option = null,
      round_id = gen_random_uuid(),
      phase_started_at = now(),
      updated_at = now()
    where id = 1;
  end if;
end;
$$;

grant execute on function public.live_quiz_admin_delete_question(text, int) to anon, authenticated;

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
begin
  if not public.live_quiz_check_pin(p_pin) then
    raise exception 'Invalid admin PIN';
  end if;

  select name into gname from public.live_quiz_groups where id = p_group_id;
  if gname is null then
    raise exception 'Unknown group';
  end if;

  select coalesce(array_agg(q.question_number), array[]::int[])
  into qnums
  from public.live_quiz_questions q
  where q.group_id = p_group_id;

  if qnums = array[]::int[] then
  qnums := array[]::int[];
  end if;

  if cardinality(qnums) > 0 then
    delete from public.live_quiz_votes v
    where v.question_number = any(qnums);
  end if;

  select * into s from public.live_quiz_state where id = 1;

  if s.question_number is not null and s.question_number = any(qnums) then
    update public.live_quiz_state
    set
      phase = 'waiting',
      question_number = null,
      selected_option = null,
      round_id = gen_random_uuid(),
      last_podium = null,
      phase_started_at = now(),
      updated_at = now()
    where id = 1;
  end if;
end;
$$;

grant execute on function public.live_quiz_admin_clear_group_answers(text, int) to anon, authenticated;