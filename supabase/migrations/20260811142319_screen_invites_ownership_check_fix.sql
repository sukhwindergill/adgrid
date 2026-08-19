-- Fix for screen_invites_schema (20260811000001): the "Operators manage own
-- screen invites" policy trusted a client-supplied operator_id column
-- instead of verifying real ownership of screen_id against screens, letting
-- any authenticated user forge an invite for a screen they don't own. Same
-- bug class already fixed in 20260701000001_scope_operator_screens_rls.sql
-- and 20260701000000_scope_operator_bookings_rls.sql.
drop policy if exists "Operators manage own screen invites" on screen_invites;

create policy "Operators manage own screen invites"
  on screen_invites for all
  using (exists (select 1 from screens where id = screen_invites.screen_id and operator_id = auth.uid()))
  with check (exists (select 1 from screens where id = screen_id and operator_id = auth.uid()));

-- Documenting the accepted tradeoff on the public-read-by-token policy
-- (unchanged behavior, comment only): this grants unauthenticated SELECT on
-- the entire table, not just "a row matching a token you already know" --
-- e.g. GET /rest/v1/screen_invites?select=* returns every invite.
-- operator_invites accepts the same shape on the rationale that its 256-bit
-- token is unguessable; that reasoning is weaker here since bulk listing
-- needs no guessing, and converted_advertiser_id + operator_id together
-- link two users' identities. Accepted for now to match operator_invites'
-- shipped shape; revisit if this table's rows are considered sensitive
-- per-row.
drop policy if exists "Anyone can read screen invite by token" on screen_invites;

create policy "Anyone can read screen invite by token"
  on screen_invites for select
  using (true);
