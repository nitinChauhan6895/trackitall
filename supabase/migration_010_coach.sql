-- TrackItAll — Coach: rules-based workout generator (schema + seed)
-- Safe to re-run. exercises_library & workout_templates are GLOBAL read-only;
-- coach_profiles is user-scoped (RLS auth.uid() = user_id).

-- ========================= PHASE 1: SCHEMA =========================

create table if not exists public.exercises_library (
  id text primary key,                       -- stable slug
  name text not null,
  muscle_group text not null,                -- Chest, Back, Shoulders, Legs, Biceps, Triceps, Core, Functional, Cardio
  category text not null,                    -- Primary Compound, Secondary Compound, Isolation, Finisher, Cardio
  equipment text not null,                   -- Full Gym, Home Gym, Dumbbells Only, Bodyweight
  difficulty text not null,                  -- Beginner, Intermediate, Advanced
  goal_tags text[] not null default '{}',
  alternative_exercise_ids text[] not null default '{}',
  estimated_duration_min int not null default 10,
  injury_flags text[] not null default '{}' -- Shoulder, Knee, Lower Back
);

create table if not exists public.workout_templates (
  id text primary key,                       -- slug = goal
  goal text not null,                        -- Muscle Growth, Fat Loss, Maintenance, Strength, General Fitness
  duration_min int not null,
  structure jsonb not null,                  -- [{category, sets, rep_min, rep_max, to_failure}]
  cardio_min int not null default 0,
  cardio_optional boolean not null default false
);

create table if not exists public.coach_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  goal text,
  experience text,                           -- Beginner, Intermediate, Advanced
  equipment text,                            -- Full Gym, Home Gym, Dumbbells Only, Bodyweight
  injuries text[] not null default '{}',
  preferred_exercise_ids text[] not null default '{}',
  excluded_exercise_ids text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- RLS: global tables are read-only to any authenticated user; coach_profiles owner-only.
alter table public.exercises_library enable row level security;
alter table public.workout_templates enable row level security;
alter table public.coach_profiles enable row level security;

do $$
begin
  if not exists (select from pg_policies where tablename='exercises_library' and policyname='lib_read') then
    create policy lib_read on public.exercises_library for select to authenticated using (true);
  end if;
  if not exists (select from pg_policies where tablename='workout_templates' and policyname='tpl_read') then
    create policy tpl_read on public.workout_templates for select to authenticated using (true);
  end if;
  if not exists (select from pg_policies where tablename='coach_profiles' and policyname='cp_owner') then
    create policy cp_owner on public.coach_profiles for all
      using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- ========================= PHASE 2: SEED =========================

insert into public.exercises_library
  (id, name, muscle_group, category, equipment, difficulty, goal_tags, alternative_exercise_ids, estimated_duration_min, injury_flags)
values
-- Chest
('bench-press','Bench Press','Chest','Primary Compound','Full Gym','Intermediate','{Growth,Strength,Maintenance}','{incline-bench-press,machine-chest-press,dumbbell-bench-press}',12,'{Shoulder}'),
('incline-bench-press','Incline Bench Press','Chest','Primary Compound','Full Gym','Intermediate','{Growth,Strength}','{bench-press,incline-dumbbell-press}',12,'{Shoulder}'),
('machine-chest-press','Machine Chest Press','Chest','Primary Compound','Full Gym','Beginner','{Growth,Maintenance}','{bench-press,pec-deck}',10,'{}'),
('incline-dumbbell-press','Incline Dumbbell Press','Chest','Secondary Compound','Dumbbells Only','Intermediate','{Growth}','{dumbbell-bench-press,incline-bench-press}',10,'{Shoulder}'),
('dumbbell-bench-press','Dumbbell Bench Press','Chest','Secondary Compound','Dumbbells Only','Beginner','{Growth,Maintenance}','{incline-dumbbell-press,machine-chest-press}',10,'{Shoulder}'),
('cable-fly','Cable Fly','Chest','Isolation','Full Gym','Beginner','{Growth}','{pec-deck}',8,'{Shoulder}'),
('pec-deck','Pec Deck','Chest','Isolation','Full Gym','Beginner','{Growth,Maintenance}','{cable-fly}',8,'{}'),
('pushups','Push-ups','Chest','Finisher','Bodyweight','Beginner','{Growth,Maintenance,General Fitness}','{}',5,'{}'),
-- Back
('deadlift','Deadlift','Back','Primary Compound','Full Gym','Advanced','{Growth,Strength}','{barbell-row,rack-pull}',14,'{Lower Back}'),
('pull-ups','Pull-ups','Back','Primary Compound','Bodyweight','Intermediate','{Growth,Strength}','{lat-pulldown}',10,'{Shoulder}'),
('lat-pulldown','Lat Pulldown','Back','Primary Compound','Full Gym','Beginner','{Growth,Maintenance}','{pull-ups,straight-arm-pulldown}',10,'{}'),
('barbell-row','Barbell Row','Back','Secondary Compound','Full Gym','Intermediate','{Growth,Strength}','{seated-cable-row,one-arm-dumbbell-row}',12,'{Lower Back}'),
('seated-cable-row','Seated Cable Row','Back','Secondary Compound','Full Gym','Beginner','{Growth,Maintenance}','{barbell-row,machine-row}',10,'{}'),
('one-arm-dumbbell-row','One-Arm Dumbbell Row','Back','Secondary Compound','Dumbbells Only','Beginner','{Growth,Maintenance}','{seated-cable-row}',10,'{}'),
('machine-row','Machine Row','Back','Secondary Compound','Full Gym','Beginner','{Growth,Maintenance}','{seated-cable-row}',10,'{}'),
('straight-arm-pulldown','Straight-Arm Pulldown','Back','Isolation','Full Gym','Beginner','{Growth}','{lat-pulldown}',8,'{}'),
('rack-pull','Rack Pull','Back','Secondary Compound','Full Gym','Intermediate','{Strength,Growth}','{deadlift}',10,'{Lower Back}'),
-- Shoulders
('overhead-press','Overhead Press','Shoulders','Primary Compound','Full Gym','Intermediate','{Growth,Strength}','{dumbbell-shoulder-press,machine-shoulder-press}',12,'{Shoulder}'),
('dumbbell-shoulder-press','Dumbbell Shoulder Press','Shoulders','Secondary Compound','Dumbbells Only','Beginner','{Growth,Maintenance}','{overhead-press,arnold-press}',10,'{Shoulder}'),
('machine-shoulder-press','Machine Shoulder Press','Shoulders','Primary Compound','Full Gym','Beginner','{Growth,Maintenance}','{overhead-press}',10,'{}'),
('arnold-press','Arnold Press','Shoulders','Secondary Compound','Dumbbells Only','Intermediate','{Growth}','{dumbbell-shoulder-press}',10,'{Shoulder}'),
('lateral-raise','Lateral Raise','Shoulders','Isolation','Dumbbells Only','Beginner','{Growth,Maintenance}','{cable-lateral-raise}',8,'{}'),
('cable-lateral-raise','Cable Lateral Raise','Shoulders','Isolation','Full Gym','Beginner','{Growth}','{lateral-raise}',8,'{}'),
('rear-delt-fly','Rear Delt Fly','Shoulders','Isolation','Dumbbells Only','Beginner','{Growth,Maintenance}','{face-pull}',8,'{}'),
('face-pull','Face Pull','Shoulders','Finisher','Full Gym','Beginner','{Growth,Maintenance,General Fitness}','{rear-delt-fly}',6,'{}'),
-- Legs
('back-squat','Back Squat','Legs','Primary Compound','Full Gym','Intermediate','{Growth,Strength}','{front-squat,hack-squat,leg-press}',14,'{Knee,Lower Back}'),
('front-squat','Front Squat','Legs','Primary Compound','Full Gym','Advanced','{Growth,Strength}','{back-squat,hack-squat}',14,'{Knee}'),
('leg-press','Leg Press','Legs','Primary Compound','Full Gym','Beginner','{Growth,Maintenance}','{hack-squat,back-squat}',12,'{Knee}'),
('hack-squat','Hack Squat','Legs','Secondary Compound','Full Gym','Intermediate','{Growth}','{leg-press,back-squat}',12,'{Knee}'),
('romanian-deadlift','Romanian Deadlift','Legs','Secondary Compound','Full Gym','Intermediate','{Growth,Strength}','{leg-curl}',12,'{Lower Back}'),
('bulgarian-split-squat','Bulgarian Split Squat','Legs','Secondary Compound','Dumbbells Only','Intermediate','{Growth}','{walking-lunges}',12,'{Knee}'),
('walking-lunges','Walking Lunges','Legs','Secondary Compound','Dumbbells Only','Beginner','{Growth,Maintenance,General Fitness}','{bulgarian-split-squat}',10,'{Knee}'),
('leg-extension','Leg Extension','Legs','Isolation','Full Gym','Beginner','{Growth,Maintenance}','{leg-curl}',8,'{Knee}'),
('leg-curl','Leg Curl','Legs','Isolation','Full Gym','Beginner','{Growth,Maintenance}','{leg-extension}',8,'{}'),
('calf-raise','Calf Raise','Legs','Finisher','Full Gym','Beginner','{Growth,Maintenance}','{}',6,'{}'),
-- Biceps
('barbell-curl','Barbell Curl','Biceps','Secondary Compound','Full Gym','Beginner','{Growth,Strength}','{ez-bar-curl,dumbbell-curl}',8,'{}'),
('ez-bar-curl','EZ Bar Curl','Biceps','Secondary Compound','Full Gym','Beginner','{Growth,Maintenance}','{barbell-curl,preacher-curl}',8,'{}'),
('dumbbell-curl','Dumbbell Curl','Biceps','Isolation','Dumbbells Only','Beginner','{Growth,Maintenance}','{hammer-curl,incline-dumbbell-curl}',8,'{}'),
('hammer-curl','Hammer Curl','Biceps','Isolation','Dumbbells Only','Beginner','{Growth,Maintenance}','{dumbbell-curl}',8,'{}'),
('incline-dumbbell-curl','Incline Dumbbell Curl','Biceps','Isolation','Dumbbells Only','Intermediate','{Growth}','{dumbbell-curl}',8,'{}'),
('preacher-curl','Preacher Curl','Biceps','Isolation','Full Gym','Beginner','{Growth}','{ez-bar-curl,cable-curl}',8,'{}'),
('cable-curl','Cable Curl','Biceps','Isolation','Full Gym','Beginner','{Growth,Maintenance}','{preacher-curl}',8,'{}'),
('concentration-curl','Concentration Curl','Biceps','Finisher','Dumbbells Only','Beginner','{Growth,Maintenance}','{}',6,'{}'),
-- Triceps
('close-grip-bench-press','Close-Grip Bench Press','Triceps','Secondary Compound','Full Gym','Intermediate','{Growth,Strength}','{dips,skull-crushers}',10,'{Shoulder}'),
('dips','Dips','Triceps','Secondary Compound','Bodyweight','Intermediate','{Growth,Strength}','{close-grip-bench-press}',8,'{Shoulder}'),
('tricep-pushdown','Tricep Pushdown','Triceps','Isolation','Full Gym','Beginner','{Growth,Maintenance}','{rope-pushdown}',8,'{}'),
('rope-pushdown','Rope Pushdown','Triceps','Isolation','Full Gym','Beginner','{Growth,Maintenance}','{tricep-pushdown}',8,'{}'),
('overhead-tricep-extension','Overhead Tricep Extension','Triceps','Isolation','Dumbbells Only','Beginner','{Growth}','{skull-crushers}',8,'{Shoulder}'),
('skull-crushers','Skull Crushers','Triceps','Isolation','Full Gym','Intermediate','{Growth}','{overhead-tricep-extension,close-grip-bench-press}',8,'{}'),
('dumbbell-kickback','Dumbbell Kickback','Triceps','Finisher','Dumbbells Only','Beginner','{Growth,Maintenance}','{}',6,'{}'),
('diamond-pushups','Diamond Push-ups','Triceps','Finisher','Bodyweight','Beginner','{Growth,Maintenance,General Fitness}','{}',5,'{}'),
-- Core
('hanging-leg-raise','Hanging Leg Raise','Core','Secondary Compound','Bodyweight','Intermediate','{Growth,General Fitness}','{cable-crunch}',8,'{}'),
('cable-crunch','Cable Crunch','Core','Isolation','Full Gym','Beginner','{Growth,Maintenance}','{crunches}',8,'{}'),
('crunches','Crunches','Core','Isolation','Bodyweight','Beginner','{Maintenance,General Fitness}','{cable-crunch}',6,'{}'),
('russian-twist','Russian Twist','Core','Isolation','Bodyweight','Beginner','{Maintenance,General Fitness}','{}',6,'{Lower Back}'),
('ab-wheel-rollout','Ab Wheel Rollout','Core','Secondary Compound','Bodyweight','Intermediate','{Growth,General Fitness}','{}',6,'{Lower Back}'),
('plank','Plank','Core','Finisher','Bodyweight','Beginner','{Maintenance,General Fitness}','{side-plank}',5,'{}'),
('side-plank','Side Plank','Core','Finisher','Bodyweight','Beginner','{Maintenance,General Fitness}','{plank}',5,'{}'),
('mountain-climbers','Mountain Climbers','Core','Finisher','Bodyweight','Beginner','{General Fitness,Fat Loss}','{}',5,'{}'),
-- Functional
('kettlebell-swing','Kettlebell Swing','Functional','Secondary Compound','Dumbbells Only','Intermediate','{Fat Loss,General Fitness}','{goblet-squat}',8,'{Lower Back}'),
('goblet-squat','Goblet Squat','Functional','Secondary Compound','Dumbbells Only','Beginner','{General Fitness,Growth}','{kettlebell-swing}',8,'{Knee}'),
('box-jumps','Box Jumps','Functional','Finisher','Bodyweight','Intermediate','{Fat Loss,General Fitness}','{burpees}',6,'{Knee}'),
('burpees','Burpees','Functional','Finisher','Bodyweight','Beginner','{Fat Loss,General Fitness}','{box-jumps}',6,'{}'),
('wall-ball','Wall Ball','Functional','Secondary Compound','Full Gym','Beginner','{Fat Loss,General Fitness}','{}',8,'{Knee}'),
('farmers-carry','Farmers Carry','Functional','Finisher','Dumbbells Only','Beginner','{General Fitness,Strength}','{}',6,'{Lower Back}'),
('sled-push','Sled Push','Functional','Secondary Compound','Full Gym','Intermediate','{Fat Loss,General Fitness}','{sled-pull}',8,'{}'),
('battle-ropes','Battle Ropes','Functional','Finisher','Full Gym','Beginner','{Fat Loss,General Fitness}','{}',6,'{}'),
('sled-pull','Sled Pull','Functional','Secondary Compound','Full Gym','Intermediate','{Fat Loss,General Fitness}','{sled-push}',8,'{}'),
-- Cardio pool
('incline-walk','Incline Walk','Cardio','Cardio','Full Gym','Beginner','{Fat Loss,Maintenance,General Fitness}','{stair-stepper,running}',15,'{}'),
('running','Running','Cardio','Cardio','Bodyweight','Beginner','{Fat Loss,General Fitness}','{incline-walk,rowing}',20,'{Knee}'),
('stair-stepper','Stair Stepper','Cardio','Cardio','Full Gym','Beginner','{Fat Loss,Maintenance}','{incline-walk}',15,'{Knee}'),
('air-bike','Air Bike','Cardio','Cardio','Full Gym','Beginner','{Fat Loss,General Fitness}','{rowing,skierg}',12,'{}'),
('rowing','Rowing','Cardio','Cardio','Full Gym','Beginner','{Fat Loss,General Fitness}','{air-bike,skierg}',15,'{Lower Back}'),
('skierg','SkiErg','Cardio','Cardio','Full Gym','Beginner','{Fat Loss,General Fitness}','{rowing,air-bike}',12,'{}')
on conflict (id) do nothing;

insert into public.workout_templates (id, goal, duration_min, structure, cardio_min, cardio_optional) values
('muscle-growth','Muscle Growth',60,'[
  {"category":"Primary Compound","sets":4,"rep_min":6,"rep_max":8,"to_failure":false},
  {"category":"Secondary Compound","sets":3,"rep_min":8,"rep_max":10,"to_failure":false},
  {"category":"Secondary Compound","sets":3,"rep_min":8,"rep_max":10,"to_failure":false},
  {"category":"Isolation","sets":3,"rep_min":12,"rep_max":15,"to_failure":false},
  {"category":"Finisher","sets":2,"rep_min":0,"rep_max":0,"to_failure":true}
]'::jsonb,10,true),
('maintenance','Maintenance',45,'[
  {"category":"Primary Compound","sets":3,"rep_min":8,"rep_max":10,"to_failure":false},
  {"category":"Secondary Compound","sets":3,"rep_min":10,"rep_max":12,"to_failure":false},
  {"category":"Isolation","sets":2,"rep_min":12,"rep_max":15,"to_failure":false}
]'::jsonb,15,false),
('fat-loss','Fat Loss',60,'[
  {"category":"Primary Compound","sets":3,"rep_min":8,"rep_max":10,"to_failure":false},
  {"category":"Secondary Compound","sets":3,"rep_min":10,"rep_max":12,"to_failure":false},
  {"category":"Secondary Compound","sets":3,"rep_min":10,"rep_max":12,"to_failure":false},
  {"category":"Isolation","sets":3,"rep_min":12,"rep_max":15,"to_failure":false},
  {"category":"Isolation","sets":3,"rep_min":12,"rep_max":15,"to_failure":false}
]'::jsonb,20,false),
('strength','Strength',60,'[
  {"category":"Primary Compound","sets":5,"rep_min":3,"rep_max":5,"to_failure":false},
  {"category":"Secondary Compound","sets":4,"rep_min":5,"rep_max":8,"to_failure":false},
  {"category":"Secondary Compound","sets":4,"rep_min":5,"rep_max":8,"to_failure":false},
  {"category":"Isolation","sets":3,"rep_min":10,"rep_max":12,"to_failure":false}
]'::jsonb,10,true),
('general-fitness','General Fitness',45,'[
  {"category":"Primary Compound","sets":3,"rep_min":8,"rep_max":12,"to_failure":false},
  {"category":"Secondary Compound","sets":3,"rep_min":8,"rep_max":12,"to_failure":false},
  {"category":"Isolation","sets":2,"rep_min":12,"rep_max":15,"to_failure":false},
  {"category":"Finisher","sets":1,"rep_min":0,"rep_max":0,"to_failure":true}
]'::jsonb,15,true)
on conflict (id) do nothing;
