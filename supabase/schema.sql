-- TrackItAll schema (fresh install)
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
-- If you already ran an earlier version, run supabase/migration_002_overhaul.sql instead.

-- Exercises: one row per exercise logged on a given day, for a given user.
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_date date not null,
  muscle_group text not null check (
    muscle_group in (
      'chest', 'tricep', 'back', 'bicep', 'shoulders',
      'legs', 'core', 'functional', 'cardio', 'olympic'
    )
  ),
  name text not null check (char_length(name) between 1 and 120),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists exercises_user_date_idx
  on public.exercises (user_id, workout_date);

-- Sets: one row per set. Strength sets use reps + weight_kg; cardio sets use
-- distance_km + speed_kmh. All are nullable so either mode works.
create table if not exists public.sets (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  position int not null default 0,
  reps int check (reps is null or reps >= 0),
  weight_kg numeric(6, 2) check (weight_kg is null or weight_kg >= 0),
  distance_km numeric(6, 2) check (distance_km is null or distance_km >= 0),
  speed_kmh numeric(6, 2) check (speed_kmh is null or speed_kmh >= 0)
);

create index if not exists sets_exercise_idx on public.sets (exercise_id);

-- PRs (personal records), manual entry.
create table if not exists public.prs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_name text not null check (char_length(exercise_name) between 1 and 120),
  unit_type text not null check (unit_type in ('kg', 'time', 'distance')),
  value numeric(10, 2) not null check (value >= 0),
  distance_unit text check (distance_unit in ('m', 'km')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prs_user_idx on public.prs (user_id, updated_at desc);

-- Row Level Security: each user can only see and modify their own rows.
alter table public.exercises enable row level security;
alter table public.sets enable row level security;
alter table public.prs enable row level security;

drop policy if exists "own exercises" on public.exercises;
create policy "own exercises" on public.exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own sets" on public.sets;
create policy "own sets" on public.sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own prs" on public.prs;
create policy "own prs" on public.prs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
