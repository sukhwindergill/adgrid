-- Repo/live-DB sync fix: this table and its RLS were applied directly to
-- the live project via migration tooling outside this repo, so the
-- migration history here never recorded them -- a fresh environment
-- provisioned from these files alone would be missing the table entirely.
-- Reconstructed from the live schema (see 2026-09-14 audit) to close that
-- drift; every statement is idempotent so it no-ops against a project that
-- already has this applied.
CREATE TABLE IF NOT EXISTS public.waitlist_entries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  email      text NOT NULL,
  company    text,
  city       text,
  screens    text,
  source     text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;

-- Public marketing form -- anyone (including anonymous visitors) can submit,
-- nobody can read entries back through the client (this table holds contact
-- details of people who are not yet AdGrid users, not something to expose
-- via a public SELECT-able policy).
DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.waitlist_entries;
CREATE POLICY "Anyone can join waitlist" ON public.waitlist_entries
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "No client reads" ON public.waitlist_entries;
CREATE POLICY "No client reads" ON public.waitlist_entries
  FOR SELECT
  USING (false);
