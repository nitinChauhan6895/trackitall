-- Migration 019: web-push subscriptions + reminder de-duplication.
--
-- A PWA cannot schedule a notification for a future time; the only thing that
-- wakes a closed app is a push message. So each device registers a push
-- subscription here, and an external trigger asks the server hourly who is due.
--
-- timezone is stored per SUBSCRIPTION rather than per user: it comes from the
-- device (Intl.DateTimeFormat().resolvedOptions().timeZone), phones travel, and
-- one account can be signed in on several devices in different zones. An IANA
-- name rather than an offset, so DST is handled for us.
--
-- Safe to re-run.

create extension if not exists "pgcrypto";

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- The push service URL identifies the device; re-subscribing must update in
  -- place rather than pile up dead rows.
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- One row per habit per day that we actually notified about. The unique
-- constraint is the de-duplication: the trigger may fire late, twice, or
-- overlap, and inserting here is what decides whether a push goes out.
create table if not exists public.habit_notifications (
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  sent_at timestamptz not null default now(),
  primary key (habit_id, local_date)
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
alter table public.habit_notifications enable row level security;

-- Users manage their own subscriptions from the browser. The sender runs with
-- the service-role key, which bypasses RLS.
drop policy if exists "push_subscriptions own" on public.push_subscriptions;
create policy "push_subscriptions own" on public.push_subscriptions
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "habit_notifications own" on public.habit_notifications;
create policy "habit_notifications own" on public.habit_notifications
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
