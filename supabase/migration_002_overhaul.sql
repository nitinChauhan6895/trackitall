-- TrackItAll — migration 002 (UI/UX overhaul)
-- Paste this whole block into Supabase → SQL Editor → New query → Run.
-- Safe to run on a database that already has the original schema.sql applied.

-- 1) Muscle groups: new fixed list (arms split into tricep/bicep, plus new groups)
update public.exercises set muscle_group = 'tricep' where muscle_group = 'arms';

alter table public.exercises
  drop constraint if exists exercises_muscle_group_check;

alter table public.exercises
  add constraint exercises_muscle_group_check check (
    muscle_group in (
      'chest', 'tricep', 'back', 'bicep', 'shoulders',
      'legs', 'core', 'functional', 'cardio', 'olympic'
    )
  );

-- 2) Sets: support cardio (distance + speed) alongside reps + weight.
--    Rename the old `weight` column to `weight_kg` if it still exists.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sets' and column_name = 'weight'
  ) then
    alter table public.sets rename column weight to weight_kg;
  end if;
end $$;

alter table public.sets
  add column if not exists weight_kg  numeric(6, 2) check (weight_kg  is null or weight_kg  >= 0),
  add column if not exists distance_km numeric(6, 2) check (distance_km is null or distance_km >= 0),
  add column if not exists speed_kmh   numeric(6, 2) check (speed_kmh   is null or speed_kmh   >= 0);

-- 3) PRs (personal records), manual entry.
create table if not exists public.prs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_name text not null check (char_length(exercise_name) between 1 and 120),
  unit_type text not null check (unit_type in ('kg', 'time', 'distance')),
  value numeric(10, 2) not null check (value >= 0), -- kg, total seconds (time), or distance amount
  distance_unit text check (distance_unit in ('m', 'km')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prs_user_idx on public.prs (user_id, updated_at desc);

alter table public.prs enable row level security;

drop policy if exists "own prs" on public.prs;
create policy "own prs" on public.prs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
