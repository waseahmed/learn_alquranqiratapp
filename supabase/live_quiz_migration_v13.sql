-- Presentation screen: live answer feed, answer count, and timer context

create or replace function public.live_quiz_present_snapshot()
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

  select last_podium into p from public.live_quiz_state where id = 1;

  if s.round_id is not null then
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
        case
          when s.phase = 'question' and s.phase_started_at is not null then
            round(
              (extract(epoch from (v.created_at - s.phase_started_at)) * 1000)::numeric,
              0
            )::bigint
          else null
        end as response_ms
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
  elsif p is not null and p ? 'question_title' then
    q := jsonb_build_object(
      'question_number', p->'question_number',
      'title', p->>'question_title',
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
    'leaderboard', lb
  );
end;
$$;

grant execute on function public.live_quiz_present_snapshot() to anon, authenticated;