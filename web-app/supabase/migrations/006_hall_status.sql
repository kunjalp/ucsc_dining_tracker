-- NOT SAFE TO RUN TWICE: CREATE TABLE has no IF NOT EXISTS, so a rerun errors.
-- No data is lost.
create table public.hall_status (
    dining_hall varchar(100) primary key,
    is_open boolean not null,
    status_text text,
    updated_at timestamptz default now()
);
