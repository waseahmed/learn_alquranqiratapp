-- Run this if you already applied the original live_quiz.sql (votes + parent role)

-- Session round id (new vote round each time host sends a question)
alter table public.live_quiz_state
  add column if not exists round_id uuid not null default gen_random_uuid();

-- Parent signup: mother / father (replaces gender)
alter table public.live_quiz_participants
  add column if not exists parent_role text;

update public.live_quiz_participants
set parent_role = case
  when gender = 'female' then 'mother'
  when gender = 'male' then 'father'
  else 'mother'
end
where parent_role is null;

alter table public.live_quiz_participants
  alter column parent_role set not null;

do $$
begin
  alter table public.live_quiz_participants
    add constraint live_quiz_participants_parent_role_check
    check (parent_role in ('mother', 'father'));
exception
  when duplicate_object then null;
end $$;

alter table public.live_quiz_participants drop column if exists gender;
alter table public.live_quiz_participants drop column if exists parent_name;

create table if not exists public.live_quiz_votes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null,
  participant_id uuid not null references public.live_quiz_participants (id) on delete cascade,
  question_number int not null check (question_number >= 1 and question_number <= 5),
  option_number int not null check (option_number >= 1 and option_number <= 3),
  created_at timestamptz not null default now(),
  unique (round_id, participant_id)
);

create index if not exists live_quiz_votes_round_id_idx
  on public.live_quiz_votes (round_id);

alter table public.live_quiz_votes enable row level security;

drop policy if exists "No direct vote access" on public.live_quiz_votes;
create policy "No direct vote access"
on public.live_quiz_votes
for all
to anon, authenticated
using (false)
with check (false);

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
begin
  if not public.live_quiz_check_pin(p_pin) then
    raise exception 'Invalid admin PIN';
  end if;

  if p_question < 1 or p_question > 5 then
    raise exception 'Question must be 1–5';
  end if;
  if p_option < 1 or p_option > 3 then
    raise exception 'Option must be 1–3';
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

create or replace function public.live_quiz_admin_wait(
  p_pin text
)
returns public.live_quiz_state
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.live_quiz_state;
begin
  if not public.live_quiz_check_pin(p_pin) then
    raise exception 'Invalid admin PIN';
  end if;

  update public.live_quiz_state
  set
    phase = 'waiting',
    question_number = null,
    selected_option = null,
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
begin
  select * into s from public.live_quiz_state where id = 1;

  if s.phase is distinct from 'question' or s.question_number is null or s.round_id is null then
    raise exception 'No active question';
  end if;

  expires_at := s.phase_started_at + make_interval(secs => coalesce(s.timer_seconds, 10));
  if now() > expires_at then
    raise exception 'Time is up for this question';
  end if;

  if p_option < 1 or p_option > 3 then
    raise exception 'Option must be 1–3';
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

grant execute on function public.live_quiz_submit_vote(uuid, int) to anon, authenticated;

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
      'host_option', s.selected_option
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

  return jsonb_build_object(
    'total_joined', total_joined,
    'phase', s.phase,
    'question_number', s.question_number,
    'round_id', s.round_id,
    'answered_count', answered,
    'option_counts', jsonb_build_array(c1, c2, c3),
    'host_option', s.selected_option
  );
end;
$$;

grant execute on function public.live_quiz_admin_stats(text) to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.live_quiz_votes;
exception
  when duplicate_object then null;
end $$;