-- Practice attempt history (Compare Audio recitation analysis scores)
-- Run in Supabase SQL Editor AFTER schema.sql and student_profile.sql

create table if not exists public.practice_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  surah integer not null check (surah between 1 and 114),
  ayah integer not null check (ayah >= 1),
  qari_key text,
  overall_score integer not null check (overall_score between 0 and 100),
  pitch_score integer check (pitch_score between 0 and 100),
  pace_score integer check (pace_score between 0 and 100),
  pause_score integer check (pause_score between 0 and 100),
  rhythm_score integer check (rhythm_score between 0 and 100),
  madd_score integer check (madd_score between 0 and 100),
  created_at timestamptz not null default now()
);

comment on table public.practice_attempts is
  'One row per Compare Audio analysis run, so recitation practice scores persist across devices.';

create index if not exists practice_attempts_user_idx
  on public.practice_attempts (user_id, created_at desc);

create index if not exists practice_attempts_user_ayah_idx
  on public.practice_attempts (user_id, surah, ayah, created_at desc);

alter table public.practice_attempts enable row level security;

drop policy if exists "Users can read own practice attempts" on public.practice_attempts;
create policy "Users can read own practice attempts"
on public.practice_attempts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own practice attempts" on public.practice_attempts;
create policy "Users can insert own practice attempts"
on public.practice_attempts
for insert
to authenticated
with check (auth.uid() = user_id);

-- Attempts are an immutable history log: no update/delete policy is granted,
-- matching bookmarks/preferences' "no unrestricted mutation" approach.
