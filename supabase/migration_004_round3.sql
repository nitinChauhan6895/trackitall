-- TrackItAll — round 3 migration
-- Safe to re-run (IF NOT EXISTS everywhere). RLS already scoped to auth.uid() = user_id
-- on prs and profiles from earlier migrations; adding columns doesn't change that.

-- 1. PRs: optional reps (some PRs are weight + reps, e.g. 120 kg x 5)
alter table public.prs
  add column if not exists reps integer;

-- 2. Profiles: community-sharing preference (UI + persisted flag for now;
--    sharing/visibility logic reads this flag later).
alter table public.profiles
  add column if not exists share_to_community boolean not null default false;
