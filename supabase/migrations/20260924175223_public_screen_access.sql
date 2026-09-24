-- Close anonymous read access to advertiser_screens and replace the two
-- things the public site legitimately needs with narrow functions.
--
-- advertiser_screens is a plain (security definer) view over screens, so
-- the anon SELECT grant let anyone holding the public anon key read every
-- live screen's operator_id, owner_name, exact lat/lon, cpm_floor,
-- auto_approve and last_seen, bypassing screens' RLS. Every app consumer of
-- the view is signed in, so authenticated keeps its grant.

revoke select on public.advertiser_screens from anon;

-- Homepage "screens live" stat. Hero.jsx previously counted screens
-- directly as anon, which RLS limits to screens with an active invite, so
-- the number was wrong as well as leaky. Demo screens are excluded.
create or replace function public.live_screen_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.screens where status = 'live' and not is_demo;
$$;

revoke all on function public.live_screen_count() from public;
grant execute on function public.live_screen_count() to anon, authenticated;

-- Public screen map (/screens). Coarse on purpose: coordinates rounded to
-- 2 decimals (~1 km), no id, name, owner, address or operator. Returns no
-- rows until the network has min_count real live screens, so a small
-- network can't be enumerated venue by venue; the page shows cities and
-- venue types instead until then. Keep min_count in sync with
-- PUBLIC_MAP_MIN_SCREENS in src/lib/publicScreens.js.
create or replace function public.public_screen_map()
returns table (
  city text,
  state text,
  venue_category text,
  environment text,
  display_size text,
  lat double precision,
  lon double precision,
  cpm_floor numeric,
  monthly_traffic_estimate integer
)
language sql
stable
security definer
set search_path = public
as $$
  with live as (
    select * from public.screens
    where status = 'live' and not is_demo and lat is not null and lon is not null
  )
  select l.city, l.state, l.venue_category, l.environment, l.display_size,
         round(l.lat::numeric, 2)::double precision,
         round(l.lon::numeric, 2)::double precision,
         l.cpm_floor, l.monthly_traffic_estimate
  from live l
  where (select count(*) from live) >= 25;
$$;

revoke all on function public.public_screen_map() from public;
grant execute on function public.public_screen_map() to anon, authenticated;
