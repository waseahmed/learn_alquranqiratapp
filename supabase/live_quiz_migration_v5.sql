-- Parent re-connect: fetch own session by id (public)

create or replace function public.live_quiz_get_participant(p_participant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  p public.live_quiz_participants;
begin
  select * into p from public.live_quiz_participants where id = p_participant_id;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'id', p.id,
    'kid_name', p.kid_name,
    'parent_role', p.parent_role,
    'created_at', p.created_at,
    'last_seen_at', p.last_seen_at
  );
end;
$$;

grant execute on function public.live_quiz_get_participant(uuid) to anon, authenticated;