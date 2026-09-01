-- Additive: sidebar visibility preferences
-- Run if you already applied student_profile.sql

alter table public.user_preferences
  add column if not exists sidebar jsonb not null default '{
    "showPopular": true,
    "showFullQuran": true,
    "showJuz": true,
    "showAyahSection": true,
    "showAyahIndex": true,
    "autoAdvanceAyah": false
  }'::jsonb;

-- Merge missing sidebar keys into existing preference rows
update public.user_preferences
set sidebar = coalesce(sidebar, '{}'::jsonb) || '{"showAyahIndex": true}'::jsonb
where sidebar is null
   or not (sidebar ? 'showAyahIndex');

update public.user_preferences
set sidebar = coalesce(sidebar, '{}'::jsonb) || '{"autoAdvanceAyah": false}'::jsonb
where sidebar is null
   or not (sidebar ? 'autoAdvanceAyah');
