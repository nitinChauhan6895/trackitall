-- TrackItAll — Round 2 migration
-- Paste this whole block into the Supabase SQL editor (Dashboard → SQL → New query) and run.
-- Safe to re-run (uses IF NOT EXISTS / ON CONFLICT / OR REPLACE).

-- =====================================================================
-- 1. PROFILES (first/last name, username, real email)
-- =====================================================================
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  username   text unique not null,
  first_name text,
  last_name  text,
  email      text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists "own profile write" on public.profiles;
create policy "own profile write" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-create a profile whenever a new auth user signs up. The signup call
-- passes username / first_name / last_name / email in the user metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, username, first_name, last_name, email)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))),
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    coalesce(new.raw_user_meta_data ->> 'email', new.email)
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for any users created before this migration.
insert into public.profiles (user_id, username, email)
select u.id, lower(split_part(u.email, '@', 1)), u.email
from auth.users u
on conflict (user_id) do nothing;

-- Pre-auth helpers (callable by anon): resolve a username to the login email,
-- and check whether a username is already taken. SECURITY DEFINER so they can
-- read profiles past RLS, but they expose only what login/signup need.
create or replace function public.email_for_username(p_username text)
returns text
language sql
security definer
set search_path = public
as $$
  select email from public.profiles where username = lower(p_username) limit 1;
$$;

create or replace function public.username_available(p_username text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (select 1 from public.profiles where username = lower(p_username));
$$;

grant execute on function public.email_for_username(text) to anon, authenticated;
grant execute on function public.username_available(text) to anon, authenticated;

-- =====================================================================
-- 2. CARDIO: per-exercise type + richer set fields
-- =====================================================================
alter table public.exercises
  add column if not exists cardio_type text;

alter table public.sets
  add column if not exists time_seconds int     check (time_seconds is null or time_seconds >= 0),
  add column if not exists incline      numeric(6, 2) check (incline is null or incline >= 0),
  add column if not exists resistance   numeric(6, 2) check (resistance is null or resistance >= 0),
  add column if not exists distance_m   numeric(8, 2) check (distance_m is null or distance_m >= 0);

-- =====================================================================
-- 3. MEASUREMENTS (body metrics)
-- =====================================================================
create table if not exists public.measurements (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  entry_date   date not null,
  bodyweight   numeric(6, 2) check (bodyweight is null or bodyweight >= 0),
  body_fat_pct numeric(5, 2) check (body_fat_pct is null or body_fat_pct >= 0),
  chest        numeric(6, 2) check (chest is null or chest >= 0),
  waist        numeric(6, 2) check (waist is null or waist >= 0),
  arms         numeric(6, 2) check (arms is null or arms >= 0),
  thighs       numeric(6, 2) check (thighs is null or thighs >= 0),
  created_at   timestamptz not null default now()
);

create index if not exists measurements_user_date_idx
  on public.measurements (user_id, entry_date desc);

alter table public.measurements enable row level security;

drop policy if exists "own measurements" on public.measurements;
create policy "own measurements" on public.measurements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
