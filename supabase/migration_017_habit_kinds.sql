-- Migration 017: counter vs timer habits, and categories.
--
-- kind
--   'count' — a tally (7 / 10 g). target_per_period and habit_logs.count are
--             both in the habit's own unit.
--   'timer' — a duration. BOTH target_per_period and habit_logs.count are in
--             SECONDS, so a running timer can persist partial progress without
--             a second unit sneaking in. The create form takes minutes and
--             converts; the UI formats back to mm:ss.
--
-- category groups habits behind the All / Diet / Health chips. Free text so a
-- user can invent their own; NULL simply means uncategorised.
--
-- Existing rows default to 'count', which is exactly what they already were.
--
-- Safe to re-run.

alter table public.habits
  add column if not exists kind text not null default 'count';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'habits_kind_check'
  ) then
    alter table public.habits
      add constraint habits_kind_check check (kind in ('count', 'timer'));
  end if;
end $$;

alter table public.habits
  add column if not exists category text;

create index if not exists habits_user_category_idx
  on public.habits (user_id, category);
