-- SETUP ONLY. DO NOT RERUN. This destroys or deletes data.
-- =============================================================
-- WARNING: this drops and recreates food_items and daily_menus.
-- Any data already in those tables (from scraper.py runs) will
-- be lost. Rerun scraper.py after this to repopulate them.
-- meal_logs is new and will start empty either way.
-- =============================================================

DROP TABLE IF EXISTS public.meal_logs;
DROP TABLE IF EXISTS public.daily_menus;
DROP TABLE IF EXISTS public.food_items;

CREATE TABLE public.food_items (
    recipe_id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    portion TEXT,
    calories DOUBLE PRECISION DEFAULT 0.0,
    protein DOUBLE PRECISION DEFAULT 0.0,
    carbs DOUBLE PRECISION DEFAULT 0.0,
    sugar DOUBLE PRECISION DEFAULT 0.0,
    fat DOUBLE PRECISION DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.daily_menus (
    id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    dining_hall VARCHAR(100) NOT NULL,
    meal_type VARCHAR(50) NOT NULL,
    station VARCHAR(100),
    food_item_id VARCHAR(255) REFERENCES public.food_items(recipe_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, dining_hall, meal_type, station, food_item_id)
);

-- Per-user log of what someone actually ate. This is what powers the
-- "choose your hall, choose what you had" tracker and the daily/weekly/
-- monthly macro summaries.
-- Per-user log of what someone actually ate.
CREATE TABLE public.meal_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Forces PostgreSQL to default to California's current date instead of UTC
    log_date DATE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Los_Angeles')::date,
    dining_hall VARCHAR(100),
    meal_type VARCHAR(50),
    food_item_id VARCHAR(255) REFERENCES public.food_items(recipe_id),
    servings NUMERIC NOT NULL DEFAULT 1,
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.food_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;

-- food_items / daily_menus: readable by anyone (anon key), written only
-- by your scraper via the service role key (which bypasses RLS entirely).
DROP POLICY IF EXISTS "Allow public read access to food_items" ON public.food_items;
CREATE POLICY "Allow public read access to food_items"
    ON public.food_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access to daily_menus" ON public.daily_menus;
CREATE POLICY "Allow public read access to daily_menus"
    ON public.daily_menus FOR SELECT USING (true);

-- meal_logs: each signed-in user can only see/create/update/delete their
-- own rows. This is enforced for real, since your app's users hit
-- Supabase with their own session (anon key + auth.uid()), not the
-- service role key.
DROP POLICY IF EXISTS "Users can manage their own logs" ON public.meal_logs;
CREATE POLICY "Users can manage their own logs"
    ON public.meal_logs FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
