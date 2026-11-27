-- Group display options: parent questions, intro flash, intro token on state

alter table public.live_quiz_groups
  add column if not exists show_questions_on_parents boolean not null default true,
  add column if not exists show_group_intro_flash boolean not null default true;

alter table public.live_quiz_state
  add column if not exists group_intro_token uuid;

comment on column public.live_quiz_groups.show_questions_on_parents is
  'When false, parent phones stay in watch-only mode; presentation screen still receives questions.';
comment on column public.live_quiz_groups.show_group_intro_flash is
  'When true, selecting this hosting group triggers an animated intro on parent devices.';

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
          'sort_order', g.sort_order,
          'show_questions_on_parents', coalesce(g.show_questions_on_parents, true),
          'show_group_intro_flash', coalesce(g.show_group_intro_flash, true)
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
          'group_mode', g.mode,
          'show_questions_on_parents', coalesce(g.show_questions_on_parents, true)
        )
        order by q.question_number
      )
      from public.live_quiz_questions q
      left join public.live_quiz_groups g on g.id = q.group_id
    ), '[]'::jsonb)
  );
$$;

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
  show_parents boolean;
  show_flash boolean;
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
    show_parents := coalesce((gitem->>'show_questions_on_parents')::boolean, true);
    show_flash := coalesce((gitem->>'show_group_intro_flash')::boolean, true);

    if gid is not null and exists (select 1 from public.live_quiz_groups where id = gid) then
      update public.live_quiz_groups
      set
        name = coalesce(gitem->>'name', 'Group'),
        mode = case when gitem->>'mode' = 'competition' then 'competition' else 'poll' end,
        sort_order = coalesce((gitem->>'sort_order')::int, 0),
        show_questions_on_parents = show_parents,
        show_group_intro_flash = show_flash,
        updated_at = now()
      where id = gid;
    else
      insert into public.live_quiz_groups (
        name, mode, sort_order, show_questions_on_parents, show_group_intro_flash
      )
      values (
        coalesce(gitem->>'name', 'New group'),
        case when gitem->>'mode' = 'competition' then 'competition' else 'poll' end,
        coalesce((gitem->>'sort_order')::int, 0),
        show_parents,
        show_flash
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

create or replace function public.live_quiz_admin_set_active_group(p_pin text, p_group_id int)
returns public.live_quiz_state
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.live_quiz_state;
  g public.live_quiz_groups;
begin
  if not public.live_quiz_check_pin(p_pin) then
    raise exception 'Invalid admin PIN';
  end if;

  if p_group_id is not null and not exists (select 1 from public.live_quiz_groups where id = p_group_id) then
    raise exception 'Unknown group';
  end if;

  if p_group_id is not null then
    select * into g from public.live_quiz_groups where id = p_group_id;
  end if;

  update public.live_quiz_state
  set
    active_group_id = p_group_id,
    group_intro_token = case
      when p_group_id is not null and coalesce(g.show_group_intro_flash, true) then gen_random_uuid()
      else null
    end,
    updated_at = now()
  where id = 1
  returning * into updated;

  return updated;
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
    group_intro_token = null,
    round_id = gen_random_uuid(),
    phase_started_at = now(),
    updated_at = now()
  where id = 1
  returning * into updated;

  return updated;
end;
$$;