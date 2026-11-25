-- Allow question numbers 1–99 (group-based question banks) and remove-all participants

alter table public.live_quiz_state
  drop constraint if exists live_quiz_state_question_number_check;

alter table public.live_quiz_state
  add constraint live_quiz_state_question_number_check
  check (question_number is null or (question_number >= 1 and question_number <= 99));

alter table public.live_quiz_votes
  drop constraint if exists live_quiz_votes_question_number_check;

alter table public.live_quiz_votes
  add constraint live_quiz_votes_question_number_check
  check (question_number >= 1 and question_number <= 99);

create or replace function public.live_quiz_admin_show_option(
  p_pin text,
  p_question int,
  p_option int
)
returns public.live_quiz_state
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.live_quiz_state;
  q public.live_quiz_questions;
  max_opt int;
begin
  if not public.live_quiz_check_pin(p_pin) then
    raise exception 'Invalid admin PIN';
  end if;

  if p_question < 1 or p_question > 99 then
    raise exception 'Question must be 1–99';
  end if;

  select * into q from public.live_quiz_questions where question_number = p_question;
  if not found then
    raise exception 'Question % is not configured', p_question;
  end if;

  max_opt := public.live_quiz_question_option_count(
    q.option_1_text, q.option_2_text, q.option_3_text
  );
  if max_opt = 0 then
    raise exception 'Question % has no answer options', p_question;
  end if;
  if p_option < 1 or p_option > max_opt then
    raise exception 'Option must be 1–% for this question', max_opt;
  end if;

  update public.live_quiz_state
  set
    phase = 'question',
    question_number = p_question,
    selected_option = p_option,
    active_group_id = q.group_id,
    round_id = gen_random_uuid(),
    phase_started_at = now(),
    updated_at = now()
  where id = 1
  returning * into updated;

  return updated;
end;
$$;

create or replace function public.live_quiz_admin_remove_all_participants(p_pin text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  removed bigint;
begin
  if not public.live_quiz_check_pin(p_pin) then
    raise exception 'Invalid admin PIN';
  end if;

  delete from public.live_quiz_votes
  where participant_id in (select id from public.live_quiz_participants);

  delete from public.live_quiz_participants;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

grant execute on function public.live_quiz_admin_remove_all_participants(text) to anon, authenticated;