-- Safe to run twice (IF NOT EXISTS). UNVERIFIED: not confirmed applied in the live database.
-- browse_items() (007) reads food_items.allergens. Type is text: the scraper stores the
-- label's ALLERGENS line as one string (scraper.py get_text), and the app reads it as string | null.
ALTER TABLE public.food_items ADD COLUMN IF NOT EXISTS allergens text;
