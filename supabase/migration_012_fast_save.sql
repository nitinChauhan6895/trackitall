-- Migration 012: one-round-trip exercise save
-- Re-runnable. Replaces the wizard's count + insert + delete + insert chain
-- with a single RPC. SECURITY INVOKER, so RLS still applies to every row.
--
-- payload: {
--   id?: uuid,               -- present = edit (sets replaced)
--   date: 'YYYY-MM-DD',
--   muscle_group: text,
--   name: text,
--   cardio_type?: text,
--   sets: [{ reps, weight_kg, distance_km, speed_kmh, time_seconds, incline,
--            resistance, distance_m, calories, sets_count, height, floors }]
-- }

create or replace function public.save_exercise_with_sets(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_date date := (payload->>'date')::date;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if payload->>'id' is not null then
    v_id := (payload->>'id')::uuid;
    update public.exercises
       set name = left(payload->>'name', 120),
           cardio_type = nullif(payload->>'cardio_type', '')
     where id = v_id and user_id = auth.uid();
    if not found then
      raise exception 'exercise not found';
    end if;
    delete from public.sets where exercise_id = v_id and user_id = auth.uid();
  else
    insert into public.exercises (user_id, workout_date, muscle_group, name, cardio_type, position)
    values (
      auth.uid(),
      v_date,
      payload->>'muscle_group',
      left(payload->>'name', 120),
      nullif(payload->>'cardio_type', ''),
      coalesce((
        select count(*) from public.exercises
         where user_id = auth.uid() and workout_date = v_date
      ), 0)
    )
    returning id into v_id;
  end if;

  insert into public.sets (
    exercise_id, user_id, position, reps, weight_kg, distance_km, speed_kmh,
    time_seconds, incline, resistance, distance_m, calories, sets_count, height, floors
  )
  select
    v_id, auth.uid(), t.ord - 1,
    (t.s->>'reps')::int,
    (t.s->>'weight_kg')::numeric,
    (t.s->>'distance_km')::numeric,
    (t.s->>'speed_kmh')::numeric,
    (t.s->>'time_seconds')::int,
    (t.s->>'incline')::numeric,
    (t.s->>'resistance')::numeric,
    (t.s->>'distance_m')::numeric,
    (t.s->>'calories')::numeric,
    (t.s->>'sets_count')::int,
    (t.s->>'height')::numeric,
    (t.s->>'floors')::numeric
  from jsonb_array_elements(coalesce(payload->'sets', '[]'::jsonb))
       with ordinality as t(s, ord);

  return v_id;
end;
$$;

revoke all on function public.save_exercise_with_sets(jsonb) from public;
grant execute on function public.save_exercise_with_sets(jsonb) to authenticated;
