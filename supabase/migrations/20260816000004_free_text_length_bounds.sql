-- Item 13 (sanitize before storing): the free-text fields on `bookings`
-- had no length bound at all -- unbounded text columns accept arbitrary
-- megabyte-scale payloads from the create-campaign form. React's default
-- JSX escaping and the escapeHtml() calls in send-notification/
-- handle-approval-token already stop these from becoming stored XSS, but
-- nothing stopped storage/display abuse via pathologically long values.
-- CHECK constraints here are DB-level and hold regardless of which client
-- path writes the row. Existing data confirmed far under these caps.

ALTER TABLE bookings
  ADD CONSTRAINT bookings_campaign_name_length CHECK (campaign_name IS NULL OR length(campaign_name) <= 200),
  ADD CONSTRAINT bookings_advertiser_name_length CHECK (advertiser_name IS NULL OR length(advertiser_name) <= 200),
  ADD CONSTRAINT bookings_headline_length CHECK (headline IS NULL OR length(headline) <= 280);
