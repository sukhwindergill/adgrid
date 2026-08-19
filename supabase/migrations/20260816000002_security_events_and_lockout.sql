-- Items: rate-limit password resets, lock accounts after failed logins,
-- log security events. All three share one append-only ledger table --
-- failed-login lockout and reset throttling are both just windowed COUNTs
-- over this table, and it doubles as the audit log.

CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL, -- 'login_failed' | 'login_success' | 'password_reset_requested' | 'password_changed' | 'account_locked'
  email text, -- lowercased; keyed on email since a failed login has no user id yet
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_events_email_type_created_idx
  ON security_events (email, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS security_events_created_idx
  ON security_events (created_at DESC);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- No client-facing policies: this table is written and read exclusively by
-- Edge Functions using the service_role key (login/reset checks, admin
-- audit views). Regular users/anon must never read or write it directly --
-- it would let an attacker erase their own failed-login trail or read
-- other users' security history.
