-- Generic platform-wide config store. First use: marketplace fee percentage,
-- kept out of application code per spec ("never hardcoded").
CREATE TABLE IF NOT EXISTS platform_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "authenticated_reads_config" ON platform_config
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO platform_config (key, value) VALUES ('marketplace_fee_pct', '5')
ON CONFLICT (key) DO NOTHING;
