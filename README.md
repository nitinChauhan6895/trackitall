# TrackItAll

A mobile-first workout tracker with a warm green/orange/beige theme. A home
screen with workout stats and a monthly calendar, a two-step "Log workout"
flow (pick muscle groups → add exercises and sets), and a PR corner for personal
bests. Username/password sign-in via Supabase, per-user data isolation with Row
Level Security, and installable as a PWA.

## Stack

- **Next.js 14** (App Router, Server Actions)
- **Supabase** — Auth (username/password) + Postgres with RLS
- **Tailwind CSS** — mobile-first, flat warm light theme
- **PWA** — web manifest + service worker

## Features

- Simple username + password login (no email required)
- Home: greeting, workout-day stats (last 7 / 14 days, this month), monthly
  calendar (weeks start Monday) with logged days as filled orange circles and a
  green ring on today
- **Log workout** flow: multi-select muscle groups (Chest, Tricep, Back, Bicep,
  Shoulders, Legs, Core, Functional, Cardio, Olympic lifting), then add
  exercises and sets per group — strength sets take reps × weight, Cardio takes
  distance × speed. Saved in one action.
- Tap a logged day to view/edit that day's workout
- **PR corner**: manually track personal records in kg, time (mm:ss), or
  distance (m/km); add, edit, and delete
- Each user sees only their own data (enforced in the database via RLS)
- Add to Home Screen on iOS/Android

## Setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a project, then grab:

- **Project URL** → `Settings → API → Project URL`
- **anon public key** → `Settings → API → Project API keys → anon public`

### 2. Create the database schema

Open `Supabase Dashboard → SQL Editor → New query`, paste the contents of
[`supabase/schema.sql`](supabase/schema.sql), and run it. This creates the
`exercises`, `sets`, and `prs` tables and the RLS policies that scope every row
to its owner.

> **Already ran an earlier version of the schema?** Run
> [`supabase/migration_002_overhaul.sql`](supabase/migration_002_overhaul.sql)
> instead — it updates the muscle-group list, adds cardio columns to `sets`, and
> creates the `prs` table, without dropping existing data.

### 3. Configure username/password auth

Login uses a username + password. Behind the scenes each username is mapped to a
hidden synthetic email (`username@trackitall.local`) so Supabase's email/password
auth can be used without collecting a real address.

In `Authentication → Providers → Email`:

- Make sure **Email** is enabled.
- **Turn OFF "Confirm email"** — otherwise Supabase tries to send a confirmation
  link to the synthetic address (which doesn't exist) and login can't complete.

No redirect URL configuration is needed.

### 4. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

### 5. Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000, tap **Create an account**, pick a username and
password, and you're in. Next time, just sign in with the same credentials.

## Installing as a PWA

On your phone, open the deployed site in the browser and choose **Add to Home
Screen**. It launches standalone (no browser chrome) using the icons in
`public/icons/`.

> Service workers require HTTPS (or `localhost`). Use the production deployment
> or `localhost` to test install + offline behavior.

## Deploying

Deploy to any Node host (e.g. Vercel):

1. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the
   host's environment.
2. `npm run build` / deploy.

## Data model

```
exercises (id, user_id, workout_date, muscle_group, name, position, created_at)
sets      (id, exercise_id, user_id, position, reps, weight_kg, distance_km, speed_kmh)
prs       (id, user_id, exercise_name, unit_type, value, distance_unit, created_at, updated_at)
```

A "day" is simply all exercises sharing a `workout_date`. Strength sets use
`reps` + `weight_kg`; Cardio sets use `distance_km` + `speed_kmh` (all nullable).
PR `value` holds kg, total seconds (for time, shown as mm:ss), or a distance
amount paired with `distance_unit` (m/km). RLS policies on all three tables
restrict every operation to `auth.uid() = user_id`, so users can only ever read
or write their own rows — even though the client uses the public anon key.

## Project structure

```
app/
  page.tsx                   Home: stats, calendar, PR preview, Log workout
  log/[date]/page.tsx        Log workout wizard wrapper
  log/[date]/LogWizard.tsx   2-step wizard (groups → exercises/sets)
  day/[date]/page.tsx        View/edit a logged day
  prs/page.tsx               PR corner wrapper
  prs/PrManager.tsx          PR list + add/edit/delete
  login/page.tsx             Username/password sign in + sign up
  actions.ts                 Server actions (saveWorkout, sets, PRs, sign out)
lib/
  supabase/                  Browser, server, and middleware clients
  data.ts                    Read queries (stats, days, PRs)
  date.ts                    Calendar/date helpers (Monday-start grid)
  types.ts                   Muscle groups, set/PR types, formatters
  auth.ts                    Username ↔ synthetic-email mapping
supabase/schema.sql          Fresh-install tables + RLS
supabase/migration_002_*.sql Upgrade from the original schema
public/                      manifest, service worker, icons
middleware.ts                Auth-gates every route
```
