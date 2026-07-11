-- Migration 014: track dietary fibre + fibre target
-- Re-runnable. Adds fibre columns everywhere macros live, and seeds fibre
-- values (per 100g) for the seeded foods. Run after migration_013 + seed.

alter table public.foods add column if not exists fiber_per_100g numeric(6, 2) not null default 0;
alter table public.food_log add column if not exists computed_fiber numeric(7, 2) not null default 0;
alter table public.saved_meal_items add column if not exists computed_fiber numeric(7, 2) not null default 0;
alter table public.nutrition_targets add column if not exists daily_fiber_g int not null default 30;

-- Seed fibre (g per 100g) for the fibrous seeded foods. Foods not listed keep 0
-- (dairy, eggs, meat, fish, oils, sugar, etc. are ~0 fibre).
update public.foods set fiber_per_100g = 34   where slug = 'chia-seeds';
update public.foods set fiber_per_100g = 27   where slug = 'flax-seeds';
update public.foods set fiber_per_100g = 15.6 where slug = 'barley';
update public.foods set fiber_per_100g = 14   where slug = 'popcorn';
update public.foods set fiber_per_100g = 12.5 where slug = 'almonds';
update public.foods set fiber_per_100g = 11   where slug in ('whole-wheat-flour','bajra','ragi','besan');
update public.foods set fiber_per_100g = 10   where slug in ('oats','pistachio');
update public.foods set fiber_per_100g = 9    where slug in ('jowar','coconut-fresh');
update public.foods set fiber_per_100g = 8.5  where slug = 'peanuts';
update public.foods set fiber_per_100g = 8    where slug in ('dates','kala-chana','papad');
update public.foods set fiber_per_100g = 7.6  where slug = 'chole-cooked';
update public.foods set fiber_per_100g = 6.7  where slug = 'walnut';
update public.foods set fiber_per_100g = 6    where slug in ('rajma-cooked','lobia','green-moong-whole','soybean-cooked','bread-brown','pumpkin-seeds','peanut-butter','chana-masala','dal-makhani');
update public.foods set fiber_per_100g = 5.4  where slug = 'guava';
update public.foods set fiber_per_100g = 5.3  where slug = 'chikoo';
update public.foods set fiber_per_100g = 5    where slug in ('roti','green-peas');
update public.foods set fiber_per_100g = 4    where slug in ('toor-dal-cooked','moong-dal-cooked','masoor-dal-cooked','chana-dal-cooked','urad-dal-cooked','pomegranate');
update public.foods set fiber_per_100g = 3.3  where slug = 'cashew';
update public.foods set fiber_per_100g = 3.2  where slug = 'bhindi';
update public.foods set fiber_per_100g = 3.1  where slug = 'pear';
update public.foods set fiber_per_100g = 3    where slug in ('french-beans','brinjal','methi','sweet-potato','mixed-veg','sambar','aloo-gobi','drumstick');
update public.foods set fiber_per_100g = 2.8  where slug in ('carrot','beetroot','quinoa-cooked');
update public.foods set fiber_per_100g = 2.7  where slug = 'bread-white';
update public.foods set fiber_per_100g = 2.6  where slug in ('banana','broccoli','karela');
update public.foods set fiber_per_100g = 2.5  where slug = 'cabbage';
update public.foods set fiber_per_100g = 2.4  where slug in ('apple','orange','sweet-corn');
update public.foods set fiber_per_100g = 2.2  where slug in ('spinach','potato-boiled');
update public.foods set fiber_per_100g = 2    where slug in ('cauliflower','strawberry','capsicum');
update public.foods set fiber_per_100g = 1.8  where slug = 'rice-brown-cooked';
update public.foods set fiber_per_100g = 1.7  where slug = 'papaya';
update public.foods set fiber_per_100g = 1.6  where slug = 'mango';
update public.foods set fiber_per_100g = 1.5  where slug in ('poha','upma');
update public.foods set fiber_per_100g = 1.4  where slug = 'pineapple';
update public.foods set fiber_per_100g = 1    where slug in ('mushroom','kiwi','grapes');
