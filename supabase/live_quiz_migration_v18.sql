-- Group option: show answer text on parent phones (not only 1 / 2 / 3)

alter table public.live_quiz_groups
  add column if not exists send_option_text boolean not null default false;

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
          'show_group_intro_flash', coalesce(g.show_group_intro_flash, true),
          'auto_send_questions', coalesce(g.auto_send_questions, false),
          'auto_send_gap_seconds', coalesce(g.auto_send_gap_seconds, 5),
          'send_option_text', coalesce(g.send_option_text, false)
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
          'show_questions_on_parents', coalesce(g.show_questions_on_parents, true),
          'send_option_text', coalesce(g.send_option_text, false)
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
  auto_send boolean;
  gap_sec int;
  send_text boolean;
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
    auto_send := coalesce((gitem->>'auto_send_questions')::boolean, false);
    gap_sec := coalesce(nullif((gitem->>'auto_send_gap_seconds')::int, 0), 5);
    send_text := coalesce((gitem->>'send_option_text')::boolean, false);

    if gid is not null and exists (select 1 from public.live_quiz_groups where id = gid) then
      update public.live_quiz_groups
      set
        name = coalesce(gitem->>'name', 'Group'),
        mode = case when gitem->>'mode' = 'competition' then 'competition' else 'poll' end,
        sort_order = coalesce((gitem->>'sort_order')::int, 0),
        show_questions_on_parents = show_parents,
        show_group_intro_flash = show_flash,
        auto_send_questions = auto_send,
        auto_send_gap_seconds = gap_sec,
        send_option_text = send_text,
        updated_at = now()
      where id = gid;
    else
      insert into public.live_quiz_groups (
        name, mode, sort_order, show_questions_on_parents, show_group_intro_flash,
        auto_send_questions, auto_send_gap_seconds, send_option_text
      )
      values (
        coalesce(gitem->>'name', 'New group'),
        case when gitem->>'mode' = 'competition' then 'competition' else 'poll' end,
        coalesce((gitem->>'sort_order')::int, 0),
        show_parents,
        show_flash,
        auto_send,
        gap_sec,
        send_text
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