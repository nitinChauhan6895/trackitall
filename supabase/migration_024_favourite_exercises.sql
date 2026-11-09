-- TrackItAll — migration 024: favourite exercises
-- Paste into the Supabase SQL editor and run. Safe to re-run.
--
-- Favourites are per user (not per workout): one row per muscle group +
-- exercise name. They power the FAVOURITES chips on /log/[date], the gold dot
-- on exercise cards, and favourites-first ordering in each muscle's list.

create table if not exists public.favourite_exercises (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  muscle_group text not null,
  name         text not null check (char_length(name) between 1 and 120),
  cardio_type  text,
  created_at   timestamptz not null default now(),
  primary key (user_id, muscle_group, name)
);

alter table public.favourite_exercises enable row level security;

drop policy if exists "own favourites read" on public.favourite_exercises;
create policy "own favourites read" on public.favourite_exercises
  for select using (auth.uid() = user_id);

drop policy if exists "own favourites write" on public.favourite_exercises;
create policy "own favourites write" on public.favourite_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
