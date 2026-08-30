-- Additive: sidebar visibility preferences
-- Run if you already applied student_profile.sql

alter table public.user_preferences
  add column if not exists sidebar jsonb not null default '{
    "showPopular": true,
    "showFullQuran": true,
    "showJuz": true,
    "showAyahSection": true,
    "showAyahIndex": true
  }'::jsonb;

-- Merge showAyahIndex into existing preference rows that lack it
update public.user_preferences
set sidebar = coalesce(sidebar, '{}'::jsonb) || '{"showAyahIndex": true}'::jsonb
where sidebar is null
   or not (sidebar ? 'showAyahIndex');
