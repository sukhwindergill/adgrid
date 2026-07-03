-- Go-live security hardening pt.2 (2026-07-03)
-- Addresses Supabase advisor warnings: always-true INSERT policies, mutable
-- function search_path, and trigger/internal functions exposed as RPC.

-- S3: replace `WITH CHECK (true)` INSERT policies with service-role scoping.
-- These rows are only ever written by edge functions (service role, which
-- bypasses RLS); the always-true check let any authenticated client forge rows.
DROP POLICY IF EXISTS "service_insert_transfers" ON public.operator_transfers;
CREATE POLICY "service_insert_transfers" ON public.operator_transfers
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_insert_payouts" ON public.payouts;
CREATE POLICY "service_insert_payouts" ON public.payouts
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Legacy (unused) tables — scope their open insert policies too.
DROP POLICY IF EXISTS "Pixel can insert pixel events" ON public.pixel_events;
CREATE POLICY "service_insert_pixel_events" ON public.pixel_events
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Display can insert presence" ON public.presence_logs;
CREATE POLICY "service_insert_presence" ON public.presence_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Pixel can insert scans" ON public.scan_events;
CREATE POLICY "service_insert_scan_events" ON public.scan_events
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- S5: pin search_path on the RLS helper / utility functions.
ALTER FUNCTION public.is_operator()           SET search_path = public, pg_temp;
ALTER FUNCTION public.is_advertiser()         SET search_path = public, pg_temp;
ALTER FUNCTION public.current_advertiser_id() SET search_path = public, pg_temp;
ALTER FUNCTION public.current_role()          SET search_path = public, pg_temp;
ALTER FUNCTION public.set_updated_at()        SET search_path = public, pg_temp;

-- Trigger/internal functions must not be client-callable RPCs. Triggers fire as
-- the table owner regardless of the EXECUTE grant, so revoking is safe.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_advertiser_profile()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.promote_operator_role_on_screen_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()                        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lock_account_grant_grantee_columns()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()                       FROM PUBLIC, anon, authenticated;
