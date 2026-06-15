-- TrackItAll — round 3b migration
-- Safe to re-run (IF NOT EXISTS everywhere). RLS unchanged (auth.uid() = user_id).

-- 1. Measurements: extra tracked metrics.
alter table public.measurements
  add column if not exists height numeric,
  add column if not exists age numeric,
  add column if not exists shoulders numeric,
  add column if not exists navel numeric;

-- 2. PRs: the date the PR was achieved, so users can track progress over time.
alter table public.prs
  add column if not exists achieved_date date;
