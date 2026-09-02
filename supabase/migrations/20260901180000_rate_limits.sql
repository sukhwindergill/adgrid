-- Generic fixed-window rate limiter backing Edge Functions' rateLimit.ts.
-- One row per (key, window bucket); atomic increment via UPSERT so
-- concurrent requests from the same caller can't race past the limit.

CREATE TABLE IF NOT EXISTS rate_limit_hits (
  rl_key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INT NOT NULL DEFAULT 1,
  PRIMARY KEY (rl_key, window_start)
);

-- Service-role only table -- Edge Functions call it with the service role
-- client, never exposed to PostgREST for anon/authenticated roles.
ALTER TABLE rate_limit_hits ENABLE ROW LEVEL SECURITY;

-- Old buckets are cheap to accumulate but pointless to keep; sweep anything
-- more than a day old whenever we touch the table.
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_limit INT,
  p_window_seconds INT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INT;
BEGIN
  v_window_start := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);

  INSERT INTO rate_limit_hits (rl_key, window_start, count)
  VALUES (p_key, v_window_start, 1)
  ON CONFLICT (rl_key, window_start)
  DO UPDATE SET count = rate_limit_hits.count + 1
  RETURNING count INTO v_count;

  IF random() < 0.01 THEN
    DELETE FROM rate_limit_hits WHERE window_start < now() - interval '1 day';
  END IF;

  RETURN v_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION check_rate_limit(TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, INT, INT) TO service_role;
