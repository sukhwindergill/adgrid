-- set_review_due_at is SECURITY DEFINER and only meant to run as a trigger.
-- Same exposure class as reset_screen_approval_on_creative_change: PUBLIC
-- (and thus anon/authenticated) held EXECUTE by default. Revoke all three.
REVOKE EXECUTE ON FUNCTION set_review_due_at() FROM PUBLIC, anon, authenticated;
