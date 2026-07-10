-- Migration 013: Nutrition / calorie tracker
-- Re-runnable. Creates the shared foods DB + per-user diary, targets, and
-- saved-meal templates. Run this, then run seed_nutrition_foods.sql.
--
-- RLS summary:
--   foods              → shared read + insert; update/delete only by creator
--                        (seeded rows have created_by = null, so nobody deletes them)
--   food_log           → private (auth.uid() = user_id)
--   nutrition_targets  → private
--   saved_meals/items  → private

-- ---------- foods (shared family database) ----------
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  slug text unique,            -- stable key for seeded rows (null for custom)
  name text not null check (char_length(name) between 1 and 120),
  calories_per_100g numeric(7, 2) not null default 0 check (calories_per_100g >= 0),
  protein_per_100g numeric(6, 2) not null default 0 check (protein_per_100g >= 0),
  carbs_per_100g numeric(6, 2) not null default 0 check (carbs_per_100g >= 0),
  fat_per_100g numeric(6, 2) not null default 0 check (fat_per_100g >= 0),
  default_unit text not null default 'g' check (default_unit in ('g', 'ml', 'piece')),
  common_portions jsonb not null default '[]'::jsonb, -- [{label, grams}]
  source text not null default 'custom' check (source in ('seeded', 'custom')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists foods_name_idx on public.foods (lower(name));
create index if not exists foods_created_by_idx on public.foods (created_by);

-- ---------- food_log (each user's daily entries) ----------
create table if not exists public.food_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  meal text not null check (meal in ('Breakfast', 'Lunch', 'Dinner', 'Snack')),
  food_id uuid references public.foods (id) on delete set null,
  food_name text not null,     -- snapshot so history survives food edits/deletes
  quantity numeric(8, 2) not null check (quantity >= 0),
  unit text not null default 'g',
  computed_calories numeric(8, 2) not null default 0,
  computed_protein numeric(7, 2) not null default 0,
  computed_carbs numeric(7, 2) not null default 0,
  computed_fat numeric(7, 2) not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists food_log_user_date_idx on public.food_log (user_id, log_date);

-- ---------- nutrition_targets (per user) ----------
create table if not exists public.nutrition_targets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  daily_calories int not null default 2000 check (daily_calories >= 0),
  daily_protein_g int not null default 120 check (daily_protein_g >= 0),
  daily_carbs_g int not null default 220 check (daily_carbs_g >= 0),
  daily_fat_g int not null default 65 check (daily_fat_g >= 0),
  updated_at timestamptz not null default now()
);

-- ---------- saved_meals (quick-log templates, per user) ----------
create table if not exists public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now()
);
create table if not exists public.saved_meal_items (
  id uuid primary key default gen_random_uuid(),
  saved_meal_id uuid not null references public.saved_meals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid references public.foods (id) on delete set null,
  food_name text not null,
  quantity numeric(8, 2) not null check (quantity >= 0),
  unit text not null default 'g',
  computed_calories numeric(8, 2) not null default 0,
  computed_protein numeric(7, 2) not null default 0,
  computed_carbs numeric(7, 2) not null default 0,
  computed_fat numeric(7, 2) not null default 0
);
create index if not exists saved_meal_items_meal_idx on public.saved_meal_items (saved_meal_id);

-- ---------- RLS ----------
alter table public.foods enable row level security;
alter table public.food_log enable row level security;
alter table public.nutrition_targets enable row level security;
alter table public.saved_meals enable row level security;
alter table public.saved_meal_items enable row level security;

-- foods: everyone reads; anyone inserts (must own created_by); only creator edits/deletes.
drop policy if exists "foods readable by all" on public.foods;
create policy "foods readable by all" on public.foods
  for select to authenticated using (true);

drop policy if exists "foods insertable by authenticated" on public.foods;
create policy "foods insertable by authenticated" on public.foods
  for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists "foods updatable by creator" on public.foods;
create policy "foods updatable by creator" on public.foods
  for update to authenticated using (auth.uid() = created_by) with check (auth.uid() = created_by);

drop policy if exists "foods deletable by creator" on public.foods;
create policy "foods deletable by creator" on public.foods
  for delete to authenticated using (auth.uid() = created_by);

-- food_log: private
drop policy if exists "own food_log" on public.food_log;
create policy "own food_log" on public.food_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- nutrition_targets: private
drop policy if exists "own nutrition_targets" on public.nutrition_targets;
create policy "own nutrition_targets" on public.nutrition_targets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- saved_meals / items: private
drop policy if exists "own saved_meals" on public.saved_meals;
create policy "own saved_meals" on public.saved_meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own saved_meal_items" on public.saved_meal_items;
create policy "own saved_meal_items" on public.saved_meal_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Seeded foods are inserted by a service/admin context; allow the seed script
-- (run as table owner in the SQL editor) to bypass RLS. No policy needed —
-- the SQL editor runs as the postgres role which bypasses RLS.
