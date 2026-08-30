-- Add tos_accepted_at to profiles for legal consent tracking.
-- The handle_new_user trigger reads it from raw_user_meta_data (safe — not a
-- privileged field like role). Existing rows default to NULL (pre-launch users).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tos_accepted_at timestamptz;

-- Update trigger to capture consent timestamp at signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, name, tos_accepted_at)
  VALUES (
    NEW.id,
    NEW.email,
    'advertiser',
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    CASE
      WHEN NEW.raw_user_meta_data->>'tos_accepted_at' IS NOT NULL
      THEN (NEW.raw_user_meta_data->>'tos_accepted_at')::timestamptz
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$;
