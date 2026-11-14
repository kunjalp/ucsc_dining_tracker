-- NOT SAFE TO RUN TWICE: CREATE POLICY has no DROP or IF NOT EXISTS, so a rerun
-- errors with "policy already exists". No data is lost.
-- Step 1: Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 2: Add basic policies so users can access their own data
CREATE POLICY "Users can view own profile"
ON public.users FOR SELECT
USING ( auth.uid() = id );

CREATE POLICY "Users can update own profile"
ON public.users FOR UPDATE
USING ( auth.uid() = id );

CREATE POLICY "Users can insert their own profile"
ON public.users FOR INSERT
WITH CHECK ( auth.uid() = id );
