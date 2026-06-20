-- TrackItAll — workout sharing (muscle group → another user, accept-step inbox)
-- Safe to re-run.

-- 1. workout_shares: a pending share snapshots the sender's group/date exercises.
create table if not exists public.workout_shares (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users (id) on delete cascade,
  to_user_id uuid not null references auth.users (id) on delete cascade,
  from_name text not null,
  workout_date date not null,
  muscle_group text not null,
  payload jsonb not null, -- [{name, muscle_group, cardio_type, sets:[...]}]
  status text not null default 'pending', -- pending | accepted | declined
  created_at timestamptz not null default now()
);

create index if not exists workout_shares_to_idx
  on public.workout_shares (to_user_id, status, created_at desc);

alter table public.workout_shares enable row level security;

do $$
begin
  if not exists (select from pg_policies where tablename = 'workout_shares' and policyname = 'ws_select') then
    create policy ws_select on public.workout_shares
      for select using (auth.uid() = to_user_id or auth.uid() = from_user_id);
  end if;
end $$;
-- Inserts/updates happen only through the SECURITY DEFINER functions below.

-- 2. Directory: opted-in users only, safe columns only (no email).
create or replace function public.list_shareable_users()
returns table (user_id uuid, username text, first_name text, last_name text)
language sql security definer set search_path = public as $$
  select p.user_id, p.username, p.first_name, p.last_name
  from public.profiles p
  where p.share_to_community = true and p.user_id <> auth.uid()
  order by p.username;
$$;
grant execute on function public.list_shareable_users() to authenticated;

-- 3. Create a pending share: snapshot caller's exercises+sets for a group/date.
create or replace function public.share_workout(p_to uuid, p_date date, p_group text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_from uuid := auth.uid();
  v_name text;
  v_payload jsonb;
  v_id uuid;
begin
  if v_from is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.profiles where user_id = p_to and share_to_community = true) then
    raise exception 'recipient is not accepting shares';
  end if;

  select coalesce(nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), username, 'Someone')
    into v_name from public.profiles where user_id = v_from;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'name', e.name,
             'muscle_group', e.muscle_group,
             'cardio_type', e.cardio_type,
             'sets', (
               select coalesce(jsonb_agg((to_jsonb(s) - 'id' - 'exercise_id' - 'user_id' - 'created_at') order by s.position), '[]'::jsonb)
               from public.sets s where s.exercise_id = e.id
             )
           ) order by e.position
         ), '[]'::jsonb)
    into v_payload
  from public.exercises e
  where e.user_id = v_from and e.workout_date = p_date and e.muscle_group = p_group;

  if v_payload = '[]'::jsonb then raise exception 'nothing to share'; end if;

  insert into public.workout_shares (from_user_id, to_user_id, from_name, workout_date, muscle_group, payload)
  values (v_from, p_to, coalesce(v_name, 'Someone'), p_date, p_group, v_payload)
  returning id into v_id;
  return v_id;
end; $$;
grant execute on function public.share_workout(uuid, date, text) to authenticated;

-- 4. Accept: copy a pending share's payload into the recipient's own day.
create or replace function public.accept_workout_share(p_share uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_to uuid := auth.uid();
  v_share public.workout_shares;
  v_ex jsonb;
  v_set jsonb;
  v_new_ex uuid;
  v_pos int;
begin
  select * into v_share from public.workout_shares
    where id = p_share and to_user_id = v_to and status = 'pending';
  if not found then raise exception 'share not found'; end if;

  select coalesce(max(position) + 1, 0) into v_pos
    from public.exercises where user_id = v_to and workout_date = v_share.workout_date;

  for v_ex in select * from jsonb_array_elements(v_share.payload) loop
    insert into public.exercises (user_id, workout_date, muscle_group, name, cardio_type, position)
    values (v_to, v_share.workout_date, v_ex->>'muscle_group', v_ex->>'name', v_ex->>'cardio_type', v_pos)
    returning id into v_new_ex;
    v_pos := v_pos + 1;

    for v_set in select * from jsonb_array_elements(coalesce(v_ex->'sets', '[]'::jsonb)) loop
      insert into public.sets (
        exercise_id, user_id, position, reps, weight_kg, distance_km, speed_kmh,
        time_seconds, incline, resistance, distance_m, calories, sets_count, height, floors
      ) values (
        v_new_ex, v_to,
        coalesce((v_set->>'position')::int, 0),
        (v_set->>'reps')::int, (v_set->>'weight_kg')::numeric, (v_set->>'distance_km')::numeric,
        (v_set->>'speed_kmh')::numeric, (v_set->>'time_seconds')::int, (v_set->>'incline')::numeric,
        (v_set->>'resistance')::numeric, (v_set->>'distance_m')::numeric, (v_set->>'calories')::numeric,
        (v_set->>'sets_count')::int, (v_set->>'height')::numeric, (v_set->>'floors')::numeric
      );
    end loop;
  end loop;

  update public.workout_shares set status = 'accepted' where id = p_share;
end; $$;
grant execute on function public.accept_workout_share(uuid) to authenticated;

-- 5. Decline.
create or replace function public.decline_workout_share(p_share uuid)
returns void
language sql security definer set search_path = public as $$
  update public.workout_shares set status = 'declined'
  where id = p_share and to_user_id = auth.uid() and status = 'pending';
$$;
grant execute on function public.decline_workout_share(uuid) to authenticated;
