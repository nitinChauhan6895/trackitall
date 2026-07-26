-- Migration 021: repair cardio durations that were logged as minutes but
-- stored as seconds.
--
-- Before the min/sec selector, the cardio Duration field read a bare number as
-- SECONDS, so a "30 minute" run was saved as 30 seconds. This multiplies those
-- mis-entries back to minutes.
--
-- Only touches cardio-group sets whose time_seconds is in [4, 200):
--   * a real cardio session is >= 200 s (3+ min), so genuine data is left alone
--     — including anything already saved correctly (e.g. 1800 s = 30 min);
--   * the lower bound of 4 guarantees every bumped value lands >= 240 s, so a
--     second run of this migration can't touch it again. It is therefore safe
--     to re-run.
--
-- A genuine sub-3-minute cardio effort (rare) would be over-corrected; edit its
-- duration by hand if so.

update public.sets s
set time_seconds = s.time_seconds * 60
from public.exercises e
where s.exercise_id = e.id
  and e.muscle_group = 'cardio'
  and s.time_seconds is not null
  and s.time_seconds >= 4
  and s.time_seconds < 200;
