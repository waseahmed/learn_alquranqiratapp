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
  parent_name text not null,
  gender text not null check (gender in ('male', 'female')),
  created_at timestamptz not null default now()
);

comment on table public.live_quiz_participants is
  'Parent/kid join form — no auth; used for attendance visibility on admin.';

alter table public.live_quiz_state enable row level security;
alter table public.live_quiz_secrets enable row level security;
alter table public.live_quiz_participants enable row level security;

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

-- Realtime: enable in Dashboard → Database → Replication if this fails
do $$
begin
  alter publication supabase_realtime add table public.live_quiz_state;
exception
  when duplicate_object then null;
end $$;