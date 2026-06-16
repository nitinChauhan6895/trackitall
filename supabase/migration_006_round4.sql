-- TrackItAll — round 4 migration
-- Safe to re-run. RLS on sets is unchanged (already scoped to auth.uid() = user_id).

-- Calories burned for a cardio entry (optional).
alter table public.sets
  add column if not exists calories numeric;
