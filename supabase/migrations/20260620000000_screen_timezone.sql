-- Add timezone to screens; existing rows default to America/Toronto
alter table screens add column if not exists timezone text not null default 'America/Toronto';
