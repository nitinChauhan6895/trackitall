-- TrackItAll — round 5 migration (HIIT circuits)
-- Safe to re-run. RLS on sets unchanged (auth.uid() = user_id).

-- Scalar metrics used by some HIIT exercises.
alter table public.sets
  add column if not exists sets_count integer,
  add column if not exists height numeric,
  add column if not exists floors numeric;
