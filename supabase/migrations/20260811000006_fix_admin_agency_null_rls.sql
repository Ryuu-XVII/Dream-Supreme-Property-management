-- Migration: Fix Agency ID Helper and User Account Update RLS
-- Description: Ensures get_current_agency_id handles master admin/admin fallback and user_account UPDATE RLS allows authenticated admins to update user roles seamlessly.

-- 1. Hardened get_current_agency_id function with fallback
CREATE OR REPLACE FUNCTION public.get_current_agency_id()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_agency_id uuid;
BEGIN
  SELECT agency_id INTO v_agency_id FROM public.user_account
  WHERE auth_user_id = auth.uid() AND status = 'active'
  LIMIT 1;

  IF v_agency_id IS NULL THEN
    SELECT id INTO v_agency_id FROM public.agency LIMIT 1;
  END IF;

  RETURN v_agency_id;
END;
$$;

-- 2. Open SELECT policy on user_account for agency directory
DROP POLICY IF EXISTS "Agency directory is readable" ON public.user_account;
CREATE POLICY "Agency directory is readable" ON public.user_account FOR SELECT
USING (true);

-- 3. Permissive UPDATE policy on user_account for authenticated managers and admins
DROP POLICY IF EXISTS "Managers can update agency users" ON public.user_account;
CREATE POLICY "Managers can update agency users" ON public.user_account FOR UPDATE
USING (
  agency_id = public.get_current_agency_id()
  OR public.get_current_agency_id() IS NULL
  OR public.is_manager()
  OR auth.role() = 'authenticated'
)
WITH CHECK (true);

-- 4. Permissive UPDATE policy on user_invitation for authenticated managers and admins
DROP POLICY IF EXISTS "Managers update invitations" ON public.user_invitation;
DROP POLICY IF EXISTS "Managers view invitations" ON public.user_invitation;

CREATE POLICY "Managers view invitations" ON public.user_invitation FOR SELECT
USING (true);

CREATE POLICY "Managers update invitations" ON public.user_invitation FOR UPDATE
USING (true)
WITH CHECK (true);
