-- Migration 020: exercise goals, and a weekday for weekly habit reminders.
--
-- Goals hold only the TARGET. Progress is never stored: it is derived from the
-- exercises and sets already logged, so a goal can't drift out of step with the
-- workouts behind it and back-dating a session updates its goals for free.
--
-- Safe to re-run.

create extension if not exists "pgcrypto";

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- What is being counted. Progress for each is computed in lib/goals.ts.
  --   sets             every logged set
  --   hard_sets        sets marked hard
  --   frequency        distinct days trained
  --   cardio_time      cardio minutes
  --   running_distance kilometres of running
  metric text not null check (
    metric in ('sets', 'hard_sets', 'frequency', 'cardio_time', 'running_distance')
  ),
  target numeric not null check (target > 0),
  -- Inclusive window. A "this week" goal is just a 7-day window; storing dates
  -- rather than a period keyword means a finished goal keeps its real span in
  -- History instead of silently re-scoping.
  start_date date not null,
  end_date date not null,
  name text,
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists goals_user_idx
  on public.goals (user_id, archived, end_date desc);

alter table public.goals enable row level security;

drop policy if exists "goals own" on public.goals;
create policy "goals own" on public.goals
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Weekly habits need a DAY as well as a time: "Sunday 09:00", not just 09:00.
-- 0 = Monday .. 6 = Sunday, matching the app's Mon-first week strips.
-- NULL means "any day", which is how existing weekly habits already behave.
alter table public.habits
  add column if not exists reminder_dow smallint;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'habits_reminder_dow_check') then
    alter table public.habits
      add constraint habits_reminder_dow_check
      check (reminder_dow is null or (reminder_dow >= 0 and reminder_dow <= 6));
  end if;
end $$;
