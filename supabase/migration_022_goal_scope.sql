-- Migration 022: scope a goal to a muscle group or cardio type.
--
-- Both nullable, and NULL means "all":
--   muscle_group — for sets / hard_sets / frequency goals, restrict the count
--                  to one muscle group (e.g. "60 hard sets of legs").
--   cardio_type  — for cardio_time goals, restrict to one machine
--                  (e.g. "90 min on the elliptical").
--
-- Progress is still derived, so an existing goal simply stays "all" until
-- edited. Free text rather than a check constraint: the app validates against
-- its own enums, and a future exercise type shouldn't need a schema change.
--
-- Safe to re-run.

alter table public.goals
  add column if not exists muscle_group text;

alter table public.goals
  add column if not exists cardio_type text;
