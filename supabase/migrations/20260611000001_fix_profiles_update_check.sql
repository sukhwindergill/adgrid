-- Add WITH CHECK to profiles UPDATE policy so users cannot change their own
-- role (self-promotion to operator). Role stays whatever it currently is.
ALTER POLICY "Users can update own profile" ON public.profiles
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  );
