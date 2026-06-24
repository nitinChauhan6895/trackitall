-- Migration 011: Coach exercise library v1
-- Re-runnable. Adds muscle_region + recovery_load, converts equipment to text[]
-- (context tags "gym"/"home"), and reseeds exercises_library from the curated v1 set
-- plus a Cardio pool and a small Functional set.
--
-- Categories are now: Compound | Isolation | Finisher | Cardio.
-- injury_flags: Shoulder | Knee | Lower Back | Elbow | Neck | Hip Flexor.

-- 1) Schema: new columns + equipment -> text[] -----------------------------------
alter table exercises_library add column if not exists muscle_region text;
alter table exercises_library add column if not exists recovery_load text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'exercises_library'
      and column_name = 'equipment'
      and data_type <> 'ARRAY'
  ) then
    alter table exercises_library
      alter column equipment type text[]
      using case
        when equipment is null or equipment = '' then '{}'::text[]
        else array[equipment]
      end;
  end if;
end $$;

-- estimated_duration_min stays nullable; the engine fills a per-category default.
alter table exercises_library alter column estimated_duration_min drop not null;

-- 2) Reseed ----------------------------------------------------------------------
delete from exercises_library;

insert into exercises_library
  (id, name, muscle_group, muscle_region, category, equipment, difficulty,
   goal_tags, alternative_exercise_ids, recovery_load, injury_flags)
values
-- Chest
('incline-dumbbell-press','Incline Dumbbell Press','Chest','Upper Chest','Compound',array['gym','home'],'Intermediate',array['Growth','Strength'],array['smith-incline-press','flat-dumbbell-press'],'Medium',array['Shoulder']),
('smith-incline-press','Smith Incline Press','Chest','Upper Chest','Compound',array['gym'],'Intermediate',array['Growth','Strength'],array['incline-dumbbell-press','machine-chest-press'],'Medium',array['Shoulder']),
('flat-dumbbell-press','Flat Dumbbell Press','Chest','Mid Chest','Compound',array['gym','home'],'Intermediate',array['Growth','Strength'],array['machine-chest-press','cable-press'],'Medium',array['Shoulder']),
('machine-chest-press','Machine Chest Press','Chest','Mid Chest','Compound',array['gym'],'Beginner',array['Growth','Strength','Maintenance'],array['flat-dumbbell-press','cable-press'],'Medium',array['Shoulder']),
('decline-press','Decline Press','Chest','Lower Chest','Compound',array['gym'],'Intermediate',array['Growth','Strength'],array['assisted-chest-dip','cable-fly'],'Medium',array['Shoulder']),
('assisted-chest-dip','Assisted Chest Dip','Chest','Lower Chest','Compound',array['gym'],'Intermediate',array['Growth'],array['decline-press','machine-chest-press'],'Medium',array['Shoulder','Elbow']),
('cable-fly','Cable Fly','Chest','Full Chest','Isolation',array['gym'],'Beginner',array['Growth','Maintenance'],array['pec-deck-fly'],'Low',array['Shoulder']),
('pec-deck-fly','Pec Deck Fly','Chest','Full Chest','Isolation',array['gym'],'Beginner',array['Growth','Maintenance'],array['cable-fly'],'Low',array['Shoulder']),
-- Back
('lat-pulldown','Lat Pulldown','Back','Lats','Compound',array['gym'],'Beginner',array['Growth','Strength'],array['pull-up'],'Medium',array['Shoulder']),
('pull-up','Pull Up','Back','Lats','Compound',array['gym','home'],'Intermediate',array['Growth','Strength'],array['lat-pulldown'],'High',array['Shoulder','Elbow']),
('seated-cable-row','Seated Cable Row','Back','Rhomboids','Compound',array['gym'],'Beginner',array['Growth','Strength'],array['chest-supported-row'],'Medium',array[]::text[]),
('chest-supported-row','Chest Supported Row','Back','Rhomboids','Compound',array['gym'],'Beginner',array['Growth','Strength'],array['seated-cable-row'],'Medium',array[]::text[]),
('machine-high-row','Machine High Row','Back','Traps','Compound',array['gym'],'Beginner',array['Growth'],array['tbar-row'],'Medium',array[]::text[]),
('dumbbell-shrug','Dumbbell Shrug','Back','Traps','Isolation',array['gym','home'],'Beginner',array['Growth'],array['machine-high-row'],'Low',array['Neck']),
('back-extension','Back Extension','Back','Lower Back','Isolation',array['gym','home'],'Beginner',array['Growth','Maintenance'],array['romanian-deadlift'],'Low',array['Lower Back']),
-- Legs
('romanian-deadlift','Romanian Deadlift','Legs','Hamstrings','Compound',array['gym','home'],'Intermediate',array['Growth','Strength'],array['dumbbell-rdl','single-leg-rdl'],'High',array['Lower Back']),
('hack-squat','Hack Squat','Legs','Quads','Compound',array['gym'],'Intermediate',array['Growth','Strength'],array['leg-press','front-squat'],'High',array['Knee']),
('leg-extension','Leg Extension','Legs','Quads','Isolation',array['gym'],'Beginner',array['Growth'],array['hack-squat'],'Low',array['Knee']),
('seated-leg-curl','Seated Leg Curl','Legs','Hamstrings','Isolation',array['gym'],'Beginner',array['Growth'],array['lying-leg-curl'],'Low',array[]::text[]),
('barbell-hip-thrust','Barbell Hip Thrust','Legs','Glutes','Compound',array['gym','home'],'Intermediate',array['Growth','Strength'],array['smith-hip-thrust'],'Medium',array['Lower Back']),
('hip-abduction-machine','Hip Abduction Machine','Legs','Glute Medius','Isolation',array['gym'],'Beginner',array['Growth'],array['cable-kickback'],'Low',array[]::text[]),
('standing-calf-raise','Standing Calf Raise','Legs','Gastrocnemius','Isolation',array['gym','home'],'Beginner',array['Growth'],array['leg-press-calf-raise'],'Low',array[]::text[]),
('seated-calf-raise','Seated Calf Raise','Legs','Soleus','Isolation',array['gym'],'Beginner',array['Growth'],array['standing-calf-raise'],'Low',array[]::text[]),
-- Shoulders
('seated-dumbbell-shoulder-press','Seated Dumbbell Shoulder Press','Shoulders','Front Delt','Compound',array['gym','home'],'Intermediate',array['Growth','Strength'],array['machine-shoulder-press'],'Medium',array['Shoulder']),
('cable-lateral-raise','Cable Lateral Raise','Shoulders','Side Delt','Isolation',array['gym'],'Beginner',array['Growth'],array['dumbbell-lateral-raise'],'Low',array[]::text[]),
('reverse-pec-deck','Reverse Pec Deck','Shoulders','Rear Delt','Isolation',array['gym'],'Beginner',array['Growth'],array['cable-rear-delt-fly','face-pull'],'Low',array[]::text[]),
-- Biceps
('incline-dumbbell-curl','Incline Dumbbell Curl','Biceps','Long Head','Isolation',array['gym','home'],'Intermediate',array['Growth'],array['bayesian-curl'],'Low',array['Elbow']),
('preacher-curl','Preacher Curl','Biceps','Short Head','Isolation',array['gym'],'Beginner',array['Growth'],array['spider-curl'],'Low',array['Elbow']),
('hammer-curl','Hammer Curl','Biceps','Brachialis','Isolation',array['gym','home'],'Beginner',array['Growth'],array['rope-hammer-curl'],'Low',array['Elbow']),
-- Triceps
('overhead-cable-extension','Overhead Cable Extension','Triceps','Long Head','Isolation',array['gym'],'Beginner',array['Growth'],array['single-arm-overhead-extension'],'Low',array['Elbow']),
('rope-pushdown','Rope Pushdown','Triceps','Lateral Head','Isolation',array['gym'],'Beginner',array['Growth'],array['straight-bar-pushdown'],'Low',array['Elbow']),
('reverse-grip-pushdown','Reverse Grip Pushdown','Triceps','Medial Head','Isolation',array['gym'],'Beginner',array['Growth'],array['rope-pushdown'],'Low',array['Elbow']),
-- Core
('cable-crunch','Cable Crunch','Core','Upper Abs','Isolation',array['gym'],'Beginner',array['Growth','Maintenance'],array['machine-crunch'],'Low',array[]::text[]),
('hanging-leg-raise','Hanging Leg Raise','Core','Lower Abs','Compound',array['gym','home'],'Intermediate',array['Growth','Maintenance'],array['reverse-crunch'],'Low',array['Hip Flexor']),
('pallof-press','Pallof Press','Core','Obliques','Isolation',array['gym'],'Beginner',array['Maintenance'],array['cable-woodchopper'],'Low',array[]::text[]),
-- Functional (supplements v1 — not in the provided JSON)
('kettlebell-swing','Kettlebell Swing','Functional','Full Body','Compound',array['gym','home'],'Intermediate',array['Fat Loss','General Fitness','Strength'],array['dumbbell-swing'],'Medium',array['Lower Back']),
('farmers-carry','Farmer''s Carry','Functional','Full Body','Compound',array['gym','home'],'Beginner',array['Strength','General Fitness'],array['trap-bar-carry'],'Medium',array[]::text[]),
('sled-push','Sled Push','Functional','Full Body','Compound',array['gym'],'Intermediate',array['Fat Loss','General Fitness'],array['sled-drag'],'High',array[]::text[]),
('box-jump','Box Jump','Functional','Lower Body','Compound',array['gym','home'],'Intermediate',array['General Fitness'],array['broad-jump'],'Medium',array['Knee']),
('battle-ropes','Battle Ropes','Functional','Full Body','Finisher',array['gym'],'Beginner',array['Fat Loss','General Fitness'],array['medicine-ball-slam'],'Low',array[]::text[]),
('medicine-ball-slam','Medicine Ball Slam','Functional','Full Body','Finisher',array['gym','home'],'Beginner',array['Fat Loss','General Fitness'],array['battle-ropes'],'Low',array[]::text[]),
-- Cardio pool (supplements v1 — not in the provided JSON)
('treadmill-run','Treadmill Run','Cardio',null,'Cardio',array['gym','home'],'Beginner',array['Fat Loss','General Fitness','Maintenance'],array['incline-walk','stationary-cycle'],'Low',array[]::text[]),
('incline-walk','Incline Walk','Cardio',null,'Cardio',array['gym','home'],'Beginner',array['Fat Loss','General Fitness','Maintenance'],array['treadmill-run'],'Low',array[]::text[]),
('stair-stepper','Stair Stepper','Cardio',null,'Cardio',array['gym'],'Beginner',array['Fat Loss','General Fitness'],array['incline-walk'],'Low',array['Knee']),
('air-bike','Air Bike','Cardio',null,'Cardio',array['gym','home'],'Beginner',array['Fat Loss','General Fitness'],array['rowing-machine'],'Low',array[]::text[]),
('rowing-machine','Rowing Machine','Cardio',null,'Cardio',array['gym','home'],'Beginner',array['Fat Loss','General Fitness'],array['ski-erg','air-bike'],'Low',array['Lower Back']),
('ski-erg','Ski Erg','Cardio',null,'Cardio',array['gym'],'Beginner',array['Fat Loss','General Fitness'],array['rowing-machine'],'Low',array[]::text[]),
('stationary-cycle','Stationary Cycle','Cardio',null,'Cardio',array['gym','home'],'Beginner',array['Fat Loss','General Fitness','Maintenance'],array['air-bike','treadmill-run'],'Low',array[]::text[]);
