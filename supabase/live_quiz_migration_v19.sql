-- Parent phones: default to showing answer text with numbers (not 1/2/3 only)

alter table public.live_quiz_groups
  alter column send_option_text set default true;

update public.live_quiz_groups
set send_option_text = true
where send_option_text = false;

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
          'send_option_text', coalesce(g.send_option_text, true)
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
          'send_option_text', coalesce(g.send_option_text, true)
        )
        order by q.question_number
      )
      from public.live_quiz_questions q
      left join public.live_quiz_groups g on g.id = q.group_id
    ), '[]'::jsonb)
  );
$$;