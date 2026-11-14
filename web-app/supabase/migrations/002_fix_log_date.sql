-- SETUP ONLY. DO NOT RERUN. This destroys or deletes data.
-- This safely updates the default value for log_date without dropping your table
ALTER TABLE public.meal_logs
  ALTER COLUMN log_date SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Los_Angeles')::date;

-- This deletes any testing data that got logged on the "17th" by mistake
DELETE FROM public.meal_logs
WHERE log_date = '2026-07-17';
