-- Student profile extensions
-- Run in Supabase SQL Editor AFTER schema.sql
-- Then create a public Storage bucket named: avatars
--   (Dashboard → Storage → New bucket → name: avatars → Public: YES)

-- ---------------------------------------------------------------------------
-- Profiles: avatar + safe self-update policy
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists avatar_url text;

-- Students may update their own display_name and avatar_url only (not role).
drop policy if exists "Users can update own profile basics" on public.profiles;
create policy "Users can update own profile basics"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Prevent clients from changing their own role
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role then
    raise exception 'Role cannot be changed from the client';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
before update on public.profiles
for each row execute function public.protect_profile_role();

-- ---------------------------------------------------------------------------
-- User preferences (qari order + theme colors)
-- ---------------------------------------------------------------------------
create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- Ordered list of selected qari keys, e.g. ["husary","mishary","shuraim"]
  qari_order text[] not null default array['husary','mishary','shuraim']::text[],
  -- Theme tokens applied as CSS variables
  theme jsonb not null default '{
    "green": "#1e6039",
    "gold": "#c99334",
    "background": "#f8faf5",
    "ink": "#193322"
  }'::jsonb,
  sidebar jsonb not null default '{
    "showPopular": true,
    "showFullQuran": true,
    "showJuz": true,
    "showAyahSection": true,
    "showAyahIndex": true
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_preferences is
  'Per-user UI preferences. Qari catalog stays in the app; only keys+order are stored here.';

create or replace function public.set_user_preferences_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row execute function public.set_user_preferences_updated_at();

alter table public.user_preferences enable row level security;

drop policy if exists "Users can read own preferences" on public.user_preferences;
create policy "Users can read own preferences"
on public.user_preferences
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own preferences" on public.user_preferences;
create policy "Users can insert own preferences"
on public.user_preferences
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own preferences" on public.user_preferences;
create policy "Users can update own preferences"
on public.user_preferences
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Auto-create preferences when a profile is created
create or replace function public.handle_new_profile_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_created_preferences on public.profiles;
create trigger on_profile_created_preferences
after insert on public.profiles
for each row execute function public.handle_new_profile_preferences();

-- Backfill preferences for existing profiles
insert into public.user_preferences (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Bookmarks (favorite ayahs and surahs)
-- ---------------------------------------------------------------------------
create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('ayah', 'surah')),
  surah integer not null check (surah between 1 and 114),
  ayah integer check (ayah is null or ayah >= 1),
  note text,
  created_at timestamptz not null default now(),
  constraint bookmarks_ayah_required check (
    (kind = 'surah' and ayah is null)
    or (kind = 'ayah' and ayah is not null)
  )
);

-- Unique targets (NULL-safe for surah bookmarks)
create unique index if not exists bookmarks_unique_ayah
  on public.bookmarks (user_id, surah, ayah)
  where kind = 'ayah';

create unique index if not exists bookmarks_unique_surah
  on public.bookmarks (user_id, surah)
  where kind = 'surah';

create index if not exists bookmarks_user_id_idx on public.bookmarks (user_id);

alter table public.bookmarks enable row level security;

drop policy if exists "Users can read own bookmarks" on public.bookmarks;
create policy "Users can read own bookmarks"
on public.bookmarks
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own bookmarks" on public.bookmarks;
create policy "Users can insert own bookmarks"
on public.bookmarks
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own bookmarks" on public.bookmarks;
create policy "Users can delete own bookmarks"
on public.bookmarks
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can update own bookmarks" on public.bookmarks;
create policy "Users can update own bookmarks"
on public.bookmarks
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage bucket: avatars
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

drop policy if exists "Users can upload own avatar" on storage.objects;
create policy "Users can upload own avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own avatar" on storage.objects;
create policy "Users can update own avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own avatar" on storage.objects;
create policy "Users can delete own avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
