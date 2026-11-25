-- Groups, competition mode, PIN verify, podium / leaderboard

update public.live_quiz_secrets
set admin_pin = 'L0gin@123'
where id = 1;

create table if not exists public.live_quiz_groups (
  id serial primary key,
  name text not null,
  mode text not null default 'poll' check (mode in ('poll', 'competition')),
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.live_quiz_groups (id, name, mode, sort_order)
select 1, 'General session', 'poll', 0
where not exists (select 1 from public.live_quiz_groups where id = 1);

select setval(
  pg_get_serial_sequence('public.live_quiz_groups', 'id'),
  greatest((select coalesce(max(id), 1) from public.live_quiz_groups), 1)
);

alter table public.live_quiz_questions
  add column if not exists group_id int references public.live_quiz_groups (id) on delete set null,
  add column if not exists correct_option int
    check (correct_option is null or (correct_option >= 1 and correct_option <= 3));

update public.live_quiz_questions
set group_id = 1
where group_id is null;

alter table public.live_quiz_participants
  add column if not exists competition_points int not null default 0;

alter table public.live_quiz_state
  add column if not exists active_group_id int references public.live_quiz_groups (id) on delete set null,
  add column if not exists last_podium jsonb;

alter table public.live_quiz_questions
  drop constraint if exists live_quiz_questions_question_number_check;

alter table public.live_quiz_questions
  add constraint live_quiz_questions_question_number_check
  check (question_number >= 1 and question_number <= 99);

alter table public.live_quiz_groups enable row level security;

drop policy if exists "Public read live quiz groups" on public.live_quiz_groups;
create policy "Public read live quiz groups"
on public.live_quiz_groups
for select
to anon, authenticated
using (true);

create or replace function public.live_quiz_verify_pin(p_pin text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.live_quiz_check_pin(p_pin);
$$;

grant execute on function public.live_quiz_verify_pin(text) to anon, authenticated;

create or replace function public.live_quiz_get_questions()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'groups',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', g.id,
          'name', g.name,
          'mode', g.mode,
          'sort_order', g.sort_order
        )
        order by g.sort_order, g.id
      )
      from public.live_quiz_groups g
    ), '[]'::jsonb),
    'questions',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'question_number', q.question_number,
          'group_id', q.group_id,
          'title', q.title,
          'option_1_text', q.option_1_text,
          'option_2_text', q.option_2_text,
          'option_3_text', q.option_3_text,
          'correct_option', q.correct_option,
          'option_count', public.live_quiz_question_option_count(
            q.option_1_text, q.option_2_text, q.option_3_text
          ),
          'group_mode', g.mode
        )
        order by q.question_number
      )
      from public.live_quiz_questions q
      left join public.live_quiz_groups g on g.id = q.group_id
    ), '[]'::jsonb)
  );
$$;

create or replace function public.live_quiz_award_competition_round(p_round_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.live_quiz_state;
  q public.live_quiz_questions;
  g public.live_quiz_groups;
  podium jsonb := '[]'::jsonb;
  r record;
  place int := 0;
  pts int;
  pts_list int[] := array[300, 200, 100];
begin
  select * into s from public.live_quiz_state where id = 1;
  if p_round_id is null or s.question_number is null then
    return '[]'::jsonb;
  end if;

  select * into q from public.live_quiz_questions where question_number = s.question_number;
  if not found or q.group_id is null then
    return '[]'::jsonb;
  end if;

  select * into g from public.live_quiz_groups where id = q.group_id;
  if g.mode is distinct from 'competition' or q.correct_option is null then
    return '[]'::jsonb;
  end if;

  for r in
    select v.participant_id, v.created_at, p.kid_name, p.parent_role
    from public.live_quiz_votes v
    join public.live_quiz_participants p on p.id = v.participant_id
    where v.round_id = p_round_id
      and v.option_number = q.correct_option
    order by v.created_at
    limit 3
  loop
    place := place + 1;
    pts := pts_list[place];
    update public.live_quiz_participants
    set competition_points = competition_points + pts
    where id = r.participant_id;

    podium := podium || jsonb_build_array(jsonb_build_object(
      'place', place,
      'participant_id', r.participant_id,
      'kid_name', r.kid_name,
      'parent_role', r.parent_role,
      'points_awarded', pts,
      'answered_at', r.created_at
    ));
  end loop;

  update public.live_quiz_state
  set last_podium = jsonb_build_object(
    'round_id', p_round_id,
    'question_number', s.question_number,
    'question_title', q.title,
    'places', podium
  )
  where id = 1;

  return podium;
end;
$$;

create or replace function public.live_quiz_admin_wait(p_pin text)
returns public.live_quiz_state
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.live_quiz_state;
  rid uuid;
begin
  if not public.live_quiz_check_pin(p_pin) then
    raise exception 'Invalid admin PIN';
  end if;

  select round_id into rid from public.live_quiz_state where id = 1;
  perform public.live_quiz_award_competition_round(rid);

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

create or replace function public.live_quiz_present_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  s public.live_quiz_state;
  lb jsonb;
  q jsonb;
begin
  select * into s from public.live_quiz_state where id = 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'kid_name', p.kid_name,
    'parent_role', p.parent_role,
    'points', p.competition_points
  ) order by p.competition_points desc, p.kid_name), '[]'::jsonb)
  into lb
  from public.live_quiz_participants p
  where p.competition_points > 0;

  if s.question_number is not null then
    select jsonb_build_object(
      'question_number', qn.question_number,
      'title', qn.title,
      'group_mode', g.mode
    )
    into q
    from public.live_quiz_questions qn
    left join public.live_quiz_groups g on g.id = qn.group_id
    where qn.question_number = s.question_number;
  end if;

  return jsonb_build_object(
    'phase', s.phase,
    'remaining_context', q,
    'last_podium', coalesce(s.last_podium, '{}'::jsonb),
    'leaderboard', lb
  );
end;
$$;

grant execute on function public.live_quiz_present_snapshot() to anon, authenticated;

create or replace function public.live_quiz_admin_save_session_config(
  p_pin text,
  p_groups jsonb,
  p_questions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  gitem jsonb;
  qitem jsonb;
  gid int;
  new_id int;
  qn int;
  t text;
  o1 text;
  o2 text;
  o3 text;
  cnt int;
  copt int;
  gmode text;
begin
  if not public.live_quiz_check_pin(p_pin) then
    raise exception 'Invalid admin PIN';
  end if;

  if jsonb_typeof(p_groups) is distinct from 'array' then
    raise exception 'Groups must be a JSON array';
  end if;
  if jsonb_typeof(p_questions) is distinct from 'array' then
    raise exception 'Questions must be a JSON array';
  end if;

  for gitem in select * from jsonb_array_elements(p_groups)
  loop
    gid := nullif(gitem->>'id', '')::int;
    if gid is not null and exists (select 1 from public.live_quiz_groups where id = gid) then
      update public.live_quiz_groups
      set
        name = coalesce(gitem->>'name', 'Group'),
        mode = case when gitem->>'mode' = 'competition' then 'competition' else 'poll' end,
        sort_order = coalesce((gitem->>'sort_order')::int, 0),
        updated_at = now()
      where id = gid;
    else
      insert into public.live_quiz_groups (name, mode, sort_order)
      values (
        coalesce(gitem->>'name', 'New group'),
        case when gitem->>'mode' = 'competition' then 'competition' else 'poll' end,
        coalesce((gitem->>'sort_order')::int, 0)
      )
      returning id into new_id;
    end if;
  end loop;

  for qitem in select * from jsonb_array_elements(p_questions)
  loop
    qn := (qitem->>'question_number')::int;
    if qn is null or qn < 1 or qn > 99 then
      raise exception 'Each question_number must be 1–99';
    end if;

    gid := (qitem->>'group_id')::int;
    if gid is null or not exists (select 1 from public.live_quiz_groups where id = gid) then
      raise exception 'Question %: invalid group', qn;
    end if;

    select mode into gmode from public.live_quiz_groups where id = gid;
    copt := nullif((qitem->>'correct_option')::int, 0);
    if gmode = 'competition' then
      if copt is null or copt < 1 or copt > 3 then
        raise exception 'Question %: competition groups need correct_option 1–3', qn;
      end if;
    else
      copt := null;
    end if;

    t := coalesce(qitem->>'title', '');
    o1 := nullif(btrim(coalesce(qitem->>'option_1_text', '')), '');
    o2 := nullif(btrim(coalesce(qitem->>'option_2_text', '')), '');
    o3 := nullif(btrim(coalesce(qitem->>'option_3_text', '')), '');

    cnt := public.live_quiz_question_option_count(o1, o2, o3);
    if cnt = 0 then
      o2 := null;
      o3 := null;
    elsif cnt = 1 then
      o2 := null;
      o3 := null;
    elsif cnt = 2 then
      o3 := null;
    end if;

    if copt is not null and copt > cnt then
      raise exception 'Question %: correct option out of range', qn;
    end if;

    insert into public.live_quiz_questions (
      question_number, group_id, title, option_1_text, option_2_text, option_3_text,
      correct_option, updated_at
    )
    values (qn, gid, t, o1, o2, o3, copt, now())
    on conflict (question_number) do update
    set
      group_id = excluded.group_id,
      title = excluded.title,
      option_1_text = excluded.option_1_text,
      option_2_text = excluded.option_2_text,
      option_3_text = excluded.option_3_text,
      correct_option = excluded.correct_option,
      updated_at = now();
  end loop;

  return public.live_quiz_get_questions();
end;
$$;

grant execute on function public.live_quiz_admin_save_session_config(text, jsonb, jsonb) to anon, authenticated;

create or replace function public.live_quiz_admin_set_active_group(p_pin text, p_group_id int)
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

  if p_group_id is not null and not exists (select 1 from public.live_quiz_groups where id = p_group_id) then
    raise exception 'Unknown group';
  end if;

  update public.live_quiz_state
  set active_group_id = p_group_id, updated_at = now()
  where id = 1
  returning * into updated;

  return updated;
end;
$$;

grant execute on function public.live_quiz_admin_set_active_group(text, int) to anon, authenticated;

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

  update public.live_quiz_participants
  set competition_points = 0;

  update public.live_quiz_state
  set
    phase = 'waiting',
    question_number = null,
    selected_option = null,
    round_id = gen_random_uuid(),
    last_podium = null,
    phase_started_at = now(),
    updated_at = now()
  where id = 1;
end;
$$;

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