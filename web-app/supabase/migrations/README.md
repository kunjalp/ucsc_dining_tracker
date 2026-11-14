# Migrations

Reference copies of the SQL applied to the live Supabase database.
Run in order in the SQL Editor. Claude never runs these.

| File | What it does | Safe to rerun? | Applied in live DB |
|---|---|---|---|
| 001_schema.sql | Drops and creates food_items, daily_menus, meal_logs, with RLS | NO, destroys data | Yes |
| 002_fix_log_date.sql | Sets meal_logs.log_date default to LA time, deletes 2026-07-17 test logs | NO, deletes data | Yes |
| 003_users_rls.sql | RLS and own-row policies on public.users | No (errors, no data loss) | Yes |
| 004_user_goals.sql | user_goals table, updated_at trigger, RLS | No (errors, no data loss) | Yes |
| 005_dietary_tags.sql | Adds food_items.dietary_tags text[] | Yes | Yes |
| 006_hall_status.sql | hall_status table (open/closed per hall) | No (errors, no data loss) | Yes |
| 007_browse_items.sql | browse_items() RPC, one jsonb for the Browse tab | Yes | Yes |
| 008_saved_recipes.sql | saved_recipes table, RLS, 50-recipe limit trigger | Yes | Yes |
| 009_allergens.sql | Adds food_items.allergens text (browse_items needs it) | Yes | Unverified |

001 and 002 are SETUP ONLY. Never rerun them.
