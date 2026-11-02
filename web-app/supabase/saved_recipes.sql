-- Recipes tab: each student's saved recipes (a named group of dining hall items
-- with serving sizes). Run once in Supabase -> SQL Editor. Safe to re-run.
-- Row-level security means a student can only ever see and change their own rows.

create table if not exists public.saved_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_recipes_user_idx
  on public.saved_recipes (user_id, created_at desc);

alter table public.saved_recipes enable row level security;

drop policy if exists "recipes_select_own" on public.saved_recipes;
create policy "recipes_select_own" on public.saved_recipes
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "recipes_insert_own" on public.saved_recipes;
create policy "recipes_insert_own" on public.saved_recipes
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "recipes_update_own" on public.saved_recipes;
create policy "recipes_update_own" on public.saved_recipes
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "recipes_delete_own" on public.saved_recipes;
create policy "recipes_delete_own" on public.saved_recipes
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.saved_recipes from anon;
grant select, insert, update, delete on public.saved_recipes to authenticated;

-- At most 50 recipes per student
create or replace function public.saved_recipes_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.saved_recipes where user_id = new.user_id) >= 50 then
    raise exception 'Recipe limit reached (50)';
  end if;
  return new;
end;
$$;

drop trigger if exists saved_recipes_limit_trg on public.saved_recipes;
create trigger saved_recipes_limit_trg
  before insert on public.saved_recipes
  for each row execute function public.saved_recipes_limit();
