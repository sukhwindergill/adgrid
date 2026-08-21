-- Pre-sale Q&A thread tied to a listing. One thread per (listing, advertiser)
-- pair, created lazily on first message. Price/dates are never negotiated
-- here — they live only on marketplace_listings.

CREATE TABLE IF NOT EXISTS marketplace_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  advertiser_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (listing_id, advertiser_id)
);

CREATE TABLE IF NOT EXISTS marketplace_thread_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES marketplace_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketplace_threads_listing_idx ON marketplace_threads(listing_id);
CREATE INDEX IF NOT EXISTS marketplace_thread_messages_thread_idx ON marketplace_thread_messages(thread_id, created_at);

ALTER TABLE marketplace_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_thread_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "thread_participants_only" ON marketplace_threads
    FOR ALL USING (advertiser_id = auth.uid() OR operator_id = auth.uid())
    WITH CHECK (advertiser_id = auth.uid() OR operator_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "thread_message_participants_only" ON marketplace_thread_messages
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM marketplace_threads t
        WHERE t.id = thread_id AND (t.advertiser_id = auth.uid() OR t.operator_id = auth.uid())
      )
    )
    WITH CHECK (
      sender_id = auth.uid() AND EXISTS (
        SELECT 1 FROM marketplace_threads t
        WHERE t.id = thread_id AND (t.advertiser_id = auth.uid() OR t.operator_id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
