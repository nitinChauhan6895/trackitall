-- TrackItAll — round 6 migration (HIIT circuits)
-- Reusable circuit library. Safe to re-run. RLS scoped to auth.uid() = user_id.

create table if not exists public.circuits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  set_times integer[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.circuit_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  circuit_id uuid not null references public.circuits (id) on delete cascade,
  position integer not null default 0,
  name text not null,
  category text,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists circuit_exercises_circuit_id_idx
  on public.circuit_exercises (circuit_id);

alter table public.circuits enable row level security;
alter table public.circuit_exercises enable row level security;

do $$
begin
  if not exists (
    select from pg_policies where tablename = 'circuits' and policyname = 'circuits_owner'
  ) then
    create policy circuits_owner on public.circuits
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (
    select from pg_policies where tablename = 'circuit_exercises' and policyname = 'circuit_exercises_owner'
  ) then
    create policy circuit_exercises_owner on public.circuit_exercises
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
