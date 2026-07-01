-- When a user registers their first screen they become a de-facto operator.
-- The profiles UPDATE WITH CHECK prevents client-side role changes, so we use
-- a SECURITY DEFINER trigger which runs outside RLS to promote the role.
-- Only upgrades advertiser → operator, never downgrades.

CREATE OR REPLACE FUNCTION public.promote_operator_role_on_screen_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles
    SET role = 'operator'
  WHERE id = NEW.operator_id
    AND role = 'advertiser';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_operator_role ON public.screens;

CREATE TRIGGER trg_promote_operator_role
  AFTER INSERT ON public.screens
  FOR EACH ROW
  EXECUTE FUNCTION public.promote_operator_role_on_screen_insert();
