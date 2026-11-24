-- Live quiz (public parent + admin screens, no Supabase Auth required)
-- Run in Supabase SQL Editor after schema.sql

-- Singleton session state (broadcast to all clients via Realtime)
create table if not exists public.live_quiz_state (
  id int primary key default 1 check (id = 1),
  phase text not null default 'waiting'
    check (phase in ('waiting', 'question')),
  question_number int
    check (question_number is null or (question_number >= 1 and question_number <= 5)),
  selected_option int
    check (selected_option is null or (selected_option >= 1 and selected_option <= 3)),
  round_id uuid not null default gen_random_uuid(),
  phase_started_at timestamptz not null default now(),
  timer_seconds int not null default 10,
  updated_at timestamptz not null default now()
);

insert into public.live_quiz_state (id)
values (1)
on conflict (id) do nothing;

comment on table public.live_quiz_state is
  'Single-row broadcast state for the live parent quiz screen.';

create table if not exists public.live_quiz_secrets (
  id int primary key default 1 check (id = 1),
  admin_pin text not null
);

-- Change this PIN before going live (must match what you give the host).
insert into public.live_quiz_secrets (id, admin_pin)
values (1, 'aqqa-live')
on conflict (id) do nothing;

create table if not exists public.live_quiz_participants (
  id uuid primary key default gen_random_uuid(),
  kid_name text not null,
  parent_role text not null check (parent_role in ('mother', 'father')),
  created_at timestamptz not null default now()
);

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

comment on table public.live_quiz_participants is
  'Parent/kid join form — no auth; used for attendance visibility on admin.';

alter table public.live_quiz_state enable row level security;
alter table public.live_quiz_secrets enable row level security;
alter table public.live_quiz_participants enable row level security;
alter table public.live_quiz_votes enable row level security;

drop policy if exists "No direct vote access" on public.live_quiz_votes;
create policy "No direct vote access"
on public.live_quiz_votes
for all
to anon, authenticated
using (false)
with check (false);

-- Anyone can read current quiz screen state
drop policy if exists "Public read live quiz state" on public.live_quiz_state;
create policy "Public read live quiz state"
on public.live_quiz_state
for select
to anon, authenticated
using (true);

-- No direct writes; use RPC below
drop policy if exists "Public read participants" on public.live_quiz_participants;
create policy "Public read participants"
on public.live_quiz_participants
for select
to anon, authenticated
using (true);

drop policy if exists "Public insert participants" on public.live_quiz_participants;
create policy "Public insert participants"
on public.live_quiz_participants
for insert
to anon, authenticated
with check (true);

-- Secrets: no client access (PIN checked only inside security definer functions)
revoke all on public.live_quiz_secrets from anon, authenticated;

create or replace function public.live_quiz_check_pin(p_pin text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.live_quiz_secrets s
    where s.id = 1 and s.admin_pin = p_pin
  );
$$;

revoke all on function public.live_quiz_check_pin(text) from public;
grant execute on function public.live_quiz_check_pin(text) to anon, authenticated;

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

grant execute on function public.live_quiz_admin_show_option(text, int, int) to anon, authenticated;

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

grant execute on function public.live_quiz_admin_wait(text) to anon, authenticated;

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
  order by created_at desc
  limit 200;
end;
$$;

grant execute on function public.live_quiz_list_participants(text) to anon, authenticated;

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

-- Realtime: enable in Dashboard → Database → Replication if this fails
do $$
begin
  alter publication supabase_realtime add table public.live_quiz_state;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.live_quiz_votes;
exception
  when duplicate_object then null;
end $$;