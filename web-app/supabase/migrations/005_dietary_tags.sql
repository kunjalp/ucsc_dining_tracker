-- Safe to run twice (ADD COLUMN IF NOT EXISTS).
-- Adds dietary/allergen tags to food_items, sourced from UCSC's
-- LegendImages icon system (e.g. "vegan", "gluten", "milk", "soy").
-- Non-destructive: existing food_items, daily_menus, and meal_logs rows
-- are untouched. Just re-run scraper.py after this to populate the
-- new column on existing rows.

ALTER TABLE public.food_items
  ADD COLUMN IF NOT EXISTS dietary_tags TEXT[] DEFAULT '{}';

NOTIFY pgrst, 'reload schema';
