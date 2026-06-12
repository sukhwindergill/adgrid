-- anon never legitimately updates bookings; RLS already blocks it (no anon
-- policy) but drop the grant too so a future permissive policy can't reopen it.
REVOKE UPDATE ON public.bookings FROM anon;
