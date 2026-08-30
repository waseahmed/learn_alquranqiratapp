-- Al Quran Qirat Academy — demo login accounts
-- Run in Supabase SQL Editor AFTER schema.sql
--
-- Default passwords (CHANGE THESE after first login):
--   admin@alquranqiratacademy.com     → Admin@12345
--   teacher@alquranqiratacademy.com   → Teacher@12345
--   student@alquranqiratacademy.com   → Student@12345
--
-- These use crypt() for password hashing and create auth.identities
-- so email/password sign-in works with current Supabase Auth.

create extension if not exists pgcrypto;

-- Helper: create one email user + profile role
create or replace function public.create_aqqa_login(
  p_email text,
  p_password text,
  p_display_name text,
  p_role text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid := gen_random_uuid();
  v_encrypted text;
begin
  if p_role not in ('student', 'teacher', 'admin') then
    raise exception 'Invalid role: %', p_role;
  end if;

  -- Skip if email already exists
  if exists (select 1 from auth.users where lower(email) = lower(p_email)) then
    select id into v_user_id from auth.users where lower(email) = lower(p_email);
    update public.profiles
    set display_name = p_display_name,
        role = p_role,
        active = true,
        updated_at = now()
    where id = v_user_id;
    return v_user_id;
  end if;

  v_encrypted := crypt(p_password, gen_salt('bf'));

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    lower(p_email),
    v_encrypted,
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', p_display_name),
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', lower(p_email),
      'email_verified', true
    ),
    'email',
    v_user_id::text,
    now(),
    now(),
    now()
  );

  -- Trigger usually inserts student profile; force correct role/name
  insert into public.profiles (id, display_name, role, active)
  values (v_user_id, p_display_name, p_role, true)
  on conflict (id) do update
  set display_name = excluded.display_name,
      role = excluded.role,
      active = true,
      updated_at = now();

  return v_user_id;
end;
$$;

-- Create the three starter logins
select public.create_aqqa_login(
  'admin@alquranqiratacademy.com',
  'Admin@12345',
  'Academy Admin',
  'admin'
);

select public.create_aqqa_login(
  'teacher@alquranqiratacademy.com',
  'Teacher@12345',
  'Academy Teacher',
  'teacher'
);

select public.create_aqqa_login(
  'student@alquranqiratacademy.com',
  'Student@12345',
  'Demo Student',
  'student'
);

-- Verify
select
  u.email,
  p.display_name,
  p.role,
  p.active,
  u.email_confirmed_at is not null as email_confirmed
from auth.users u
join public.profiles p on p.id = u.id
where u.email in (
  'admin@alquranqiratacademy.com',
  'teacher@alquranqiratacademy.com',
  'student@alquranqiratacademy.com'
)
order by p.role;

-- Optional later: drop helper if you do not want it left in the DB
-- drop function if exists public.create_aqqa_login(text, text, text, text);
