-- Auto-send sequence, session progress, and per-group stored results

alter table public.live_quiz_groups
  add column if not exists auto_send_questions boolean not null default false,
  add column if not exists auto_send_gap_seconds int not null default 5
    check (auto_send_gap_seconds >= 3 and auto_send_gap_seconds <= 60);

alter table public.live_quiz_state
  add column if not exists session_progress jsonb,
  add column if not exists last_group_results jsonb not null default '{}'::jsonb,
  add column if not exists group_finale jsonb;

create or replace function public.live_quiz_session_progress_for(p_group_id int, p_question_number int)
returns jsonb
language sql
stable
set search_path = public
as $$
  with ordered as (
    select question_number, row_number() over (order by question_number) as rn
    from public.live_quiz_questions
    where group_id = p_group_id
  ),
  total as (select count(*)::int as n from ordered),
  cur as (select coalesce(rn, 0)::int as n from ordered where question_number = p_question_number)
  select jsonb_build_object(
    'group_id', p_group_id,
    'total', (select n from total),
    'completed', (select n from cur),
    'pending', greatest(0, (select n from total) - (select n from cur)),
    'question_number', p_question_number
  );
$$;

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
          'auto_send_gap_seconds', coalesce(g.auto_send_gap_seconds, 5)
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
  auto_send boolean;
  gap_sec int;
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
        updated_at = now()
      where id = gid;
    else
      insert into public.live_quiz_groups (
        name, mode, sort_order, show_questions_on_parents, show_group_intro_flash,
        auto_send_questions, auto_send_gap_seconds
      )
      values (
        coalesce(gitem->>'name', 'New group'),
        case when gitem->>'mode' = 'competition' then 'competition' else 'poll' end,
        coalesce((gitem->>'sort_order')::int, 0),
        show_parents,
        show_flash,
        auto_send,
        gap_sec
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
    group_finale = null,
    session_progress = public.live_quiz_session_progress_for(q.group_id, p_question),
    round_id = gen_random_uuid(),
    phase_started_at = now(),
    updated_at = now()
  where id = 1
  returning * into updated;

  return updated;
end;
$$;

create or replace function public.live_quiz_admin_finalize_round(p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rid uuid;
begin
  if not public.live_quiz_check_pin(p_pin) then
    raise exception 'Invalid admin PIN';
  end if;
  select round_id into rid from public.live_quiz_state where id = 1;
  perform public.live_quiz_maybe_finalize_current_round();
  if rid is not null then
    perform public.live_quiz_award_competition_round(rid);
  end if;
end;
$$;

grant execute on function public.live_quiz_admin_finalize_round(text) to anon, authenticated;

create or replace function public.live_quiz_admin_show_group_results(p_pin text, p_group_id int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.live_quiz_groups;
  snapshot jsonb;
  lb jsonb;
  places jsonb;
  q_total int;
begin
  if not public.live_quiz_check_pin(p_pin) then
    raise exception 'Invalid admin PIN';
  end if;

  select * into g from public.live_quiz_groups where id = p_group_id;
  if not found then
    raise exception 'Unknown group';
  end if;

  perform public.live_quiz_maybe_finalize_current_round();

  select count(*)::int into q_total
  from public.live_quiz_questions q where q.group_id = p_group_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'kid_name', part.kid_name,
    'parent_role', part.parent_role,
    'points', part.competition_points,
    'participant_id', part.id
  ) order by part.competition_points desc, part.kid_name), '[]'::jsonb)
  into lb
  from public.live_quiz_participants part
  where g.mode = 'competition' and part.competition_points > 0;

  if g.mode <> 'competition' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'kid_name', part.kid_name,
      'parent_role', part.parent_role,
      'points', 0,
      'participant_id', part.id
    ) order by part.kid_name), '[]'::jsonb)
    into lb
    from public.live_quiz_participants part;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'place', sub.rn,
    'rank', sub.rn,
    'kid_name', sub.kid_name,
    'parent_role', sub.parent_role,
    'points', sub.points,
    'participant_id', sub.participant_id
  ) order by sub.rn), '[]'::jsonb)
  into places
  from (
    select
      row_number() over (order by coalesce(part.competition_points, 0) desc, part.kid_name) as rn,
      part.id as participant_id,
      part.kid_name,
      part.parent_role,
      coalesce(part.competition_points, 0) as points
    from public.live_quiz_participants part
  ) sub
  where sub.rn <= 3;

  snapshot := jsonb_build_object(
    'group_id', p_group_id,
    'group_name', g.name,
    'group_mode', g.mode,
    'questions_total', q_total,
    'finalized', true,
    'finalized_at', now(),
    'leaderboard', coalesce(lb, '[]'::jsonb),
    'places', coalesce(places, '[]'::jsonb),
    'ranking', coalesce(places, '[]'::jsonb)
  );

  update public.live_quiz_state
  set
    last_group_results = coalesce(last_group_results, '{}'::jsonb)
      || jsonb_build_object(p_group_id::text, snapshot),
    group_finale = snapshot,
    last_podium = snapshot,
    phase = 'waiting',
    question_number = null,
    selected_option = null,
    session_progress = jsonb_build_object(
      'group_id', p_group_id,
      'total', q_total,
      'completed', q_total,
      'pending', 0,
      'question_number', null
    ),
    phase_started_at = now(),
    updated_at = now()
  where id = 1;

  return snapshot;
end;
$$;

grant execute on function public.live_quiz_admin_show_group_results(text, int) to anon, authenticated;

drop function if exists public.live_quiz_present_snapshot();

create or replace function public.live_quiz_present_snapshot(p_focus_group_id int default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.live_quiz_state;
  lb jsonb;
  q jsonb;
  p jsonb;
  live jsonb := '[]'::jsonb;
  expires_at timestamptz;
  remain_sec int := 0;
  ans_count bigint := 0;
  qrow public.live_quiz_questions;
  correct_opt int;
  focused jsonb;
begin
  select * into s from public.live_quiz_state where id = 1;

  if s.phase = 'question' and s.round_id is not null then
    expires_at := s.phase_started_at + make_interval(secs => coalesce(s.timer_seconds, 10));
    if now() >= expires_at then
      perform public.live_quiz_maybe_finalize_current_round();
      select * into s from public.live_quiz_state where id = 1;
    else
      remain_sec := greatest(
        0,
        floor(extract(epoch from (expires_at - now())))::int
      );
    end if;
  end if;

  if p_focus_group_id is not null and s.last_group_results ? p_focus_group_id::text then
    focused := s.last_group_results -> p_focus_group_id::text;
  else
    focused := null;
  end if;

  select last_podium into p from public.live_quiz_state where id = 1;
  if focused is not null and coalesce(focused->>'finalized', 'false') = 'true' then
    p := focused;
  elsif s.group_finale is not null then
    p := s.group_finale;
  end if;

  if s.round_id is not null and s.phase = 'question' then
    select count(*) into ans_count
    from public.live_quiz_votes v
    where v.round_id = s.round_id;

    if s.question_number is not null then
      select * into qrow from public.live_quiz_questions where question_number = s.question_number;
      correct_opt := qrow.correct_option;
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'rank', sub.rn,
      'participant_id', sub.participant_id,
      'kid_name', sub.kid_name,
      'parent_role', sub.parent_role,
      'option_number', sub.option_number,
      'is_correct', sub.is_correct,
      'response_ms', sub.response_ms,
      'answered_at', sub.created_at
    ) order by sub.rn), '[]'::jsonb)
    into live
    from (
      select
        row_number() over (order by v.created_at) as rn,
        v.participant_id,
        v.created_at,
        v.option_number,
        p.kid_name,
        p.parent_role,
        (correct_opt is not null and v.option_number = correct_opt) as is_correct,
        round(
          (extract(epoch from (v.created_at - s.phase_started_at)) * 1000)::numeric,
          0
        )::bigint as response_ms
      from public.live_quiz_votes v
      join public.live_quiz_participants p on p.id = v.participant_id
      where v.round_id = s.round_id
    ) sub;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'kid_name', part.kid_name,
    'parent_role', part.parent_role,
    'points', part.competition_points
  ) order by part.competition_points desc, part.kid_name), '[]'::jsonb)
  into lb
  from public.live_quiz_participants part
  where part.competition_points > 0;

  if focused is not null and focused ? 'leaderboard' then
    lb := focused->'leaderboard';
  end if;

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
  elsif p is not null and (p ? 'question_title' or p ? 'group_name') then
    q := jsonb_build_object(
      'question_number', p->'question_number',
      'title', coalesce(p->>'question_title', p->>'group_name'),
      'group_mode', p->>'group_mode'
    );
  end if;

  return jsonb_build_object(
    'phase', s.phase,
    'round_id', s.round_id,
    'phase_started_at', s.phase_started_at,
    'timer_seconds', coalesce(s.timer_seconds, 10),
    'remaining_seconds', remain_sec,
    'answer_count', coalesce(ans_count, 0),
    'live_answers', coalesce(live, '[]'::jsonb),
    'remaining_context', q,
    'last_podium', coalesce(p, '{}'::jsonb),
    'leaderboard', coalesce(lb, '[]'::jsonb),
    'session_progress', coalesce(s.session_progress, '{}'::jsonb),
    'group_finale', coalesce(s.group_finale, '{}'::jsonb),
    'focus_group_id', p_focus_group_id
  );
end;
$$;

grant execute on function public.live_quiz_present_snapshot(int) to anon, authenticated;