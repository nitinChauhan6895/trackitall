-- Migration 015: add 'forearms' to the allowed muscle groups.
--
-- This also repairs a gap: 'hiit' has been selectable in the app but was never
-- added to the constraint (migration_002 predates it), so saving a HIIT
-- exercise would be rejected by the database. The list below is the full,
-- current set from lib/types.ts — MUSCLE_GROUPS.
--
-- Safe to re-run.

alter table public.exercises
  drop constraint if exists exercises_muscle_group_check;

alter table public.exercises
  add constraint exercises_muscle_group_check check (
    muscle_group in (
      'chest', 'tricep', 'back', 'bicep', 'forearms', 'shoulders',
      'legs', 'core', 'functional', 'cardio', 'hiit', 'olympic'
    )
  );
