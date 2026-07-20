-- Migration 016: habit tracking.
--
-- Two tables:
--   habits      — the definition (name, cadence, target, icon, reminder)
--   habit_logs  — one row per habit per day, with a count so a habit can be
--                 "8 glasses of water" rather than just done/not-done.
--
-- Weekly habits reuse the same per-day log rows; "3 of 5 this week" is computed
-- by counting logs inside the week rather than storing a separate weekly row,
-- which keeps history at day resolution for the calendar view.
--
-- Safe to re-run.

create extension if not exists "pgcrypto";

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  icon text,
  color text,
  cadence text not null default 'daily' check (cadence in ('daily', 'weekly')),
  -- daily: units per day (8 glasses). weekly: times per week (5 runs).
  target_per_period integer not null default 1 check (target_per_period > 0),
  unit text,
  reminder_time text,
  archived boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  count integer not null default 1 check (count >= 0),
  note text,
  created_at timestamptz not null default now(),
  -- One row per habit per day; progress is the `count` column.
  unique (habit_id, log_date)
);

create index if not exists habits_user_idx on public.habits (user_id, archived, position);
create index if not exists habit_logs_user_date_idx on public.habit_logs (user_id, log_date);
create index if not exists habit_logs_habit_date_idx on public.habit_logs (habit_id, log_date desc);

alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;

drop policy if exists "habits own" on public.habits;
create policy "habits own" on public.habits
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "habit_logs own" on public.habit_logs;
create policy "habit_logs own" on public.habit_logs
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
