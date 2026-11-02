-- Browse tab: one row per dining-hall dish, with the halls/stations that serve it,
-- built inside Postgres so the app makes ONE request instead of paging through
-- every daily_menus row. Run once in Supabase -> SQL Editor. Safe to re-run.
-- Read-only: it changes no tables and no data.

create or replace function public.browse_items()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with served as (
    select
      dm.food_item_id,
      dm.dining_hall,
      dm.date,
      trim(replace(coalesce(dm.station, ''), '--', '')) as station
    from public.daily_menus dm
    where dm.food_item_id is not null
      and dm.dining_hall in (
        'John R. Lewis & College Nine Dining Hall',
        'Cowell & Stevenson Dining Hall',
        'Crown & Merrill Dining Hall',
        'Porter & Kresge Dining Hall',
        'Rachel Carson & Oakes Dining Hall'
      )
  ),
  agg as (
    select
      food_item_id,
      array_agg(distinct dining_hall) as halls,
      coalesce(
        array_agg(distinct dining_hall)
          filter (where date = (now() at time zone 'America/Los_Angeles')::date),
        '{}'
      ) as today_halls,
      array_agg(distinct station) as stations
    from served
    group by food_item_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'recipe_id', f.recipe_id,
        'name', f.name,
        'portion', f.portion,
        'calories', f.calories,
        'protein', f.protein,
        'carbs', f.carbs,
        'sugar', f.sugar,
        'fat', f.fat,
        'allergens', f.allergens,
        'dietary_tags', to_jsonb(f.dietary_tags),
        'halls', to_jsonb(a.halls),
        'today_halls', to_jsonb(a.today_halls),
        'stations', to_jsonb(a.stations)
      )
    ),
    '[]'::jsonb
  )
  from agg a
  join public.food_items f on f.recipe_id = a.food_item_id;
$$;

grant execute on function public.browse_items() to anon, authenticated;
