-- TrackItAll — migration 025: RLS performance + hardening
-- Paste into the Supabase SQL editor and run. Safe to re-run.
--
-- Fixes the Supabase advisor findings from the systems review:
--  1. auth_rls_initplan (24 policies): `auth.uid()` was re-evaluated for every
--     row. Wrapping it as `(select auth.uid())` makes Postgres evaluate it once
--     per query. Same rule, same access; only faster as tables grow.
--  2. multiple_permissive_policies: profiles and favourite_exercises had a
--     SELECT-only policy plus an ALL policy with the identical condition; the
--     ALL policy already covers SELECT, so the extra one is dropped.
--  3. anon_security_definer_function_executable: the workout-sharing functions
--     were callable without signing in. They check auth.uid() themselves, so
--     this was not exploitable, but there is no reason to expose them.
--  4. unindexed_foreign_keys: cheap indexes so user deletion cascades and
--     joins don't scan.

-- ---------------------------------------------------------------------
-- 1. Evaluate auth.uid() once per query, not once per row
-- ---------------------------------------------------------------------
do $$
declare
  p record;
  new_using text;
  new_check text;
  stmt text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (
         (qual is not null and qual ~ 'auth\.uid\(\)' and qual !~* 'select auth\.uid')
         or (with_check is not null and with_check ~ 'auth\.uid\(\)' and with_check !~* 'select auth\.uid')
       )
  loop
    new_using := case when p.qual is null then null
                      else replace(p.qual, 'auth.uid()', '(select auth.uid())') end;
    new_check := case when p.with_check is null then null
                      else replace(p.with_check, 'auth.uid()', '(select auth.uid())') end;
    stmt := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if new_using is not null then stmt := stmt || ' using (' || new_using || ')'; end if;
    if new_check is not null then stmt := stmt || ' with check (' || new_check || ')'; end if;
    execute stmt;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. Drop the redundant SELECT-only policies (the ALL policy covers them)
-- ---------------------------------------------------------------------
drop policy if exists "own profile read" on public.profiles;
drop policy if exists "own favourites read" on public.favourite_exercises;

-- ---------------------------------------------------------------------
-- 3. Sharing functions: signed-in users only
-- ---------------------------------------------------------------------
revoke execute on function public.accept_workout_share(uuid) from public, anon;
revoke execute on function public.decline_workout_share(uuid) from public, anon;
revoke execute on function public.list_shareable_users() from public, anon;
revoke execute on function public.share_workout(uuid, date, text) from public, anon;
grant execute on function public.accept_workout_share(uuid) to authenticated, service_role;
grant execute on function public.decline_workout_share(uuid) to authenticated, service_role;
grant execute on function public.list_shareable_users() to authenticated, service_role;
grant execute on function public.share_workout(uuid, date, text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. Indexes on foreign keys
-- ---------------------------------------------------------------------
create index if not exists circuit_exercises_user_idx on public.circuit_exercises (user_id);
create index if not exists circuits_user_idx on public.circuits (user_id);
create index if not exists food_log_food_idx on public.food_log (food_id);
create index if not exists habit_notifications_user_idx on public.habit_notifications (user_id);
create index if not exists saved_meal_items_food_idx on public.saved_meal_items (food_id);
create index if not exists saved_meal_items_user_idx on public.saved_meal_items (user_id);
create index if not exists saved_meals_user_idx on public.saved_meals (user_id);
create index if not exists workout_shares_from_idx on public.workout_shares (from_user_id);
