-- Security-audit finding: marketplace_threads' single "thread_participants_only"
-- ALL policy let either participant (advertiser_id = auth.uid() OR
-- operator_id = auth.uid()) UPDATE the row, with a WITH CHECK that only
-- requires ONE of those two columns to still equal auth.uid() on the new
-- row -- not that the OTHER party's id stays unchanged. That meant either
-- participant could rewrite the *other* side's identity on an existing
-- thread (e.g. an operator changing advertiser_id to a different
-- advertiser's uuid while keeping operator_id = auth.uid()), which would:
--   - instantly lock the real advertiser out of a conversation they were
--     part of (they no longer match either column), and
--   - hand the entire prior message history to whichever uuid the
--     attacker substituted in -- an uninvited third party gains read
--     access to a conversation they were never part of the moment they
--     next load their own thread list.
-- No client code ever UPDATEs or DELETEs a marketplace_threads row (only
-- fetchOrCreateThread's SELECT-then-INSERT and plain SELECTs for
-- messages) -- this capability was pure unused excess privilege.
--
-- Replaced the ALL policy with SELECT (unchanged behavior) and INSERT
-- only. The INSERT also now validates operator_id against the listing's
-- real operator -- previously an advertiser could set operator_id to any
-- uuid, landing an unsolicited thread in an unrelated operator's inbox
-- for a listing they don't even own.
drop policy if exists "thread_participants_only" on public.marketplace_threads;

create policy "thread_participants_read" on public.marketplace_threads
  for select
  using (advertiser_id = auth.uid() or operator_id = auth.uid());

create policy "advertiser_creates_own_thread" on public.marketplace_threads
  for insert
  with check (
    advertiser_id = auth.uid()
    and exists (
      select 1 from public.marketplace_listings l
      where l.id = marketplace_threads.listing_id
        and l.operator_id = marketplace_threads.operator_id
    )
  );
