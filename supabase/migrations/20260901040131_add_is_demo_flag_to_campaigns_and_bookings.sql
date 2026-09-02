
alter table public.campaigns add column if not exists is_demo boolean not null default false;
alter table public.bookings  add column if not exists is_demo boolean not null default false;
