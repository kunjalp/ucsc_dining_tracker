-- NOT SAFE TO RUN TWICE: CREATE TABLE, CREATE TRIGGER and CREATE POLICY have no
-- IF NOT EXISTS or DROP, so a rerun errors. No data is lost.
create table public.user_goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal_calories integer not null default 2000,
  goal_protein integer not null default 120,
  goal_carbs integer not null default 250,
  goal_fat integer not null default 70,
  updated_at timestamptz not null default now()
);

-- Keep updated_at fresh on every upsert
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger user_goals_set_updated_at
before update on public.user_goals
for each row execute function public.set_updated_at();

-- Row Level Security: users can only read/write their own row
alter table public.user_goals enable row level security;

create policy "Users can view own goals"
  on public.user_goals for select
  using (auth.uid() = user_id);

create policy "Users can insert own goals"
  on public.user_goals for insert
  with check (auth.uid() = user_id);

create policy "Users can update own goals"
  on public.user_goals for update
  using (auth.uid() = user_id);
