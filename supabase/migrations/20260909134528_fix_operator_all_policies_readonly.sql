-- Security-audit finding: two RLS policies were declared FOR ALL (covering
-- SELECT/INSERT/UPDATE/DELETE) when their own names say they're read-only
-- ("Operators see all advertisers", "Operators see all integrations"), and
-- neither table has a second policy scoping operator writes to rows they
-- actually own -- the qual is just is_operator(), a blanket role check
-- with no row-ownership condition at all. As written, any authenticated
-- operator could UPDATE or DELETE *any* advertiser's row in `advertisers`
-- (name, email, budget caps, blocked categories/cities/days, frequency
-- caps) or *any* advertiser's row in `integrations` (which has a jsonb
-- `config` column) via a direct REST call, not just view them.
--
-- Both tables are legacy/superseded (profiles + advertiser_integrations
-- cover this today; grep confirms zero references to `advertisers` or
-- `integrations` anywhere in src/ or supabase/functions/) so this has no
-- live exploit path through the app itself, but both tables still have
-- RLS enabled and are exposed over PostgREST by default -- a direct API
-- call is enough, app involvement isn't required. Narrowed to match what
-- the policy names already claimed: read-only.

DROP POLICY IF EXISTS "Operators see all advertisers" ON public.advertisers;
CREATE POLICY "Operators see all advertisers" ON public.advertisers
  FOR SELECT
  USING (is_operator());

DROP POLICY IF EXISTS "Operators see all integrations" ON public.integrations;
CREATE POLICY "Operators see all integrations" ON public.integrations
  FOR SELECT
  USING (is_operator());
