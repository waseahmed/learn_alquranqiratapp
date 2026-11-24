-- Question config + clear answers (run after v3)

create table if not exists public.live_quiz_questions (
  question_number int primary key check (question_number >= 1 and question_number <= 5),
  title text not null default '',
  option_1_text text,
  option_2_text text,
  option_3_text text,
  updated_at timestamptz not null default now()
);

insert into public.live_quiz_questions (question_number, title, option_1_text, option_2_text, option_3_text)
values
  (1, 'Question 1', 'Option 1', 'Option 2', 'Option 3'),
  (2, 'Question 2', 'Option 1', 'Option 2', 'Option 3'),
  (3, 'Question 3', 'Option 1', 'Option 2', 'Option 3'),
  (4, 'Question 4', 'Option 1', 'Option 2', 'Option 3'),
  (5, 'Question 5', 'Option 1', 'Option 2', 'Option 3')
on conflict (question_number) do nothing;

alter table public.live_quiz_questions enable row level security;

drop policy if exists "Public read live quiz questions" on public.live_quiz_questions;
create policy "Public read live quiz questions"
on public.live_quiz_questions
for select
to anon, authenticated
using (true);

create or replace function public.live_quiz_question_option_count(
  p_option_1 text,
  p_option_2 text,
  p_option_3 text
)
returns int
language sql
immutable
as $$
  select case
    when nullif(btrim(coalesce(p_option_3, '')), '') is not null then 3
    when nullif(btrim(coalesce(p_option_2, '')), '') is not null then 2
    when nullif(btrim(coalesce(p_option_1, '')), '') is not null then 1
    else 0
  end;
$$;

create or replace function public.live_quiz_get_questions()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'question_number', q.question_number,
      'title', q.title,
      'option_1_text', q.option_1_text,
      'option_2_text', q.option_2_text,
      'option_3_text', q.option_3_text,
      'option_count', public.live_quiz_question_option_count(
        q.option_1_text, q.option_2_text, q.option_3_text
      )
    )
    order by q.question_number
  ), '[]'::jsonb)
  from public.live_quiz_questions q;
$$;

grant execute on function public.live_quiz_get_questions() to anon, authenticated;

create or replace function public.live_quiz_admin_save_questions(
  p_pin text,
  p_questions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  qn int;
  t text;
  o1 text;
  o2 text;
  o3 text;
  cnt int;
begin
  if not public.live_quiz_check_pin(p_pin) then
    raise exception 'Invalid admin PIN';
  end if;

  if jsonb_typeof(p_questions) is distinct from 'array' then
    raise exception 'Questions must be a JSON array';
  end if;

  for item in select * from jsonb_array_elements(p_questions)
  loop
    qn := (item->>'question_number')::int;
    if qn is null or qn < 1 or qn > 5 then
      raise exception 'Each question_number must be 1–5';
    end if;

    t := coalesce(item->>'title', '');
    o1 := nullif(btrim(coalesce(item->>'option_1_text', '')), '');
    o2 := nullif(btrim(coalesce(item->>'option_2_text', '')), '');
    o3 := nullif(btrim(coalesce(item->>'option_3_text', '')), '');

    cnt := public.live_quiz_question_option_count(o1, o2, o3);
    if cnt = 0 then
      o2 := null;
      o3 := null;
    elsif cnt = 1 then
      o2 := null;
      o3 := null;
    elsif cnt = 2 then
      if o2 is null then
        raise exception 'Question %: option 2 required when option 3 is set', qn;
      end if;
      o3 := null;
    else
      if o1 is null or o2 is null or o3 is null then
        raise exception 'Question %: fill options in order (1, then 2, then 3)', qn;
      end if;
    end if;

    insert into public.live_quiz_questions (
      question_number, title, option_1_text, option_2_text, option_3_text, updated_at
    )
    values (qn, t, o1, o2, o3, now())
    on conflict (question_number) do update
    set
      title = excluded.title,
      option_1_text = excluded.option_1_text,
      option_2_text = excluded.option_2_text,
      option_3_text = excluded.option_3_text,
      updated_at = now();
  end loop;

  return public.live_quiz_get_questions();
end;
$$;

grant execute on function public.live_quiz_admin_save_questions(text, jsonb) to anon, authenticated;

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

  update public.live_quiz_state
  set
    phase = 'waiting',
    question_number = null,
    selected_option = null,
    phase_started_at = now(),
    updated_at = now()
  where id = 1;
end;
$$;

grant execute on function public.live_quiz_admin_clear_answers(text) to anon, authenticated;

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

  if p_question < 1 or p_question > 5 then
    raise exception 'Question must be 1–5';
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
    round_id = gen_random_uuid(),
    phase_started_at = now(),
    updated_at = now()
  where id = 1
  returning * into updated;

  return updated;
end;
$$;

create or replace function public.live_quiz_submit_vote(
  p_participant_id uuid,
  p_option int
)
returns public.live_quiz_votes
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.live_quiz_state;
  v public.live_quiz_votes;
  expires_at timestamptz;
  q public.live_quiz_questions;
  max_opt int;
begin
  select * into s from public.live_quiz_state where id = 1;

  if s.phase is distinct from 'question' or s.question_number is null or s.round_id is null then
    raise exception 'No active question';
  end if;

  expires_at := s.phase_started_at + make_interval(secs => coalesce(s.timer_seconds, 10));
  if now() > expires_at then
    raise exception 'Time is up for this question';
  end if;

  select * into q from public.live_quiz_questions where question_number = s.question_number;
  max_opt := public.live_quiz_question_option_count(
    q.option_1_text, q.option_2_text, q.option_3_text
  );
  if p_option < 1 or p_option > max_opt then
    raise exception 'Invalid option for this question';
  end if;

  if not exists (select 1 from public.live_quiz_participants where id = p_participant_id) then
    raise exception 'Unknown participant';
  end if;

  insert into public.live_quiz_votes (
    round_id,
    participant_id,
    question_number,
    option_number
  )
  values (s.round_id, p_participant_id, s.question_number, p_option)
  on conflict (round_id, participant_id) do update
  set option_number = excluded.option_number
  returning * into v;

  return v;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.live_quiz_questions;
exception
  when duplicate_object then null;
end $$;