-- Migration: Close privilege-escalation and cross-tenant-read holes on user_account / user_invitation
-- Description: Migrations 20260811000006, 20260811000007, and 20260811000008 progressively
-- loosened RLS/trigger checks to "any authenticated user" (or an unconditional pass-through),
-- letting any agent read every tenant's user directory and rewrite anyone's role, agency_id,
-- status, or commission_pct. This migration restores real, agency-scoped checks while
-- preserving the legitimate self-service profile edit that motivated the original change
-- (agents editing their own name/email/mobile on Settings > My Profile).

---------------------------------------------------------------------------
-- 1. protect_user_account_sensitive_fields trigger
--    Restore the pre-20260811000007 version: bypass only for genuine
--    service-role/admin contexts, RAISE EXCEPTION when a non-manager tries
--    to touch role / status / agency_id / commission_pct / auth_user_id.
--    (The 000007 version fell through to an unconditional RETURN new at the
--    bottom regardless of the IF checks above it, so it never blocked anything.)
---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_user_account_sensitive_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role text;
BEGIN
  -- 1. Genuine service-role / superuser / explicit admin-override contexts bypass the check.
  IF coalesce(current_setting('app.admin_override', true), '') = 'true'
     OR coalesce(current_setting('app.workflow_change', true), '') = 'allowed'
     OR current_setting('role', true) IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN new;
  END IF;

  -- 2. Fetch the caller's own role from user_account.
  v_caller_role := lower(coalesce(public.get_current_user_role(), ''));

  -- 3. Any admin/manager role may modify sensitive fields.
  IF v_caller_role LIKE '%admin%' OR v_caller_role = 'principal' OR public.is_manager() THEN
    RETURN new;
  END IF;

  -- 4. Everyone else may update their own row, but never the restricted fields.
  IF new.role IS DISTINCT FROM old.role OR
     new.status IS DISTINCT FROM old.status OR
     new.agency_id IS DISTINCT FROM old.agency_id OR
     new.commission_pct IS DISTINCT FROM old.commission_pct OR
     new.auth_user_id IS DISTINCT FROM old.auth_user_id THEN
       RAISE EXCEPTION 'You do not have permission to modify restricted fields.';
  END IF;

  RETURN new;
END;
$$;

---------------------------------------------------------------------------
-- 2. user_account SELECT — restore agency-scoped visibility (was USING (true))
---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Agency directory is readable" ON public.user_account;
DROP POLICY IF EXISTS "Users can view user_account" ON public.user_account;
DROP POLICY IF EXISTS "Users can read own account or agency accounts" ON public.user_account;
DROP POLICY IF EXISTS "Users can view user accounts in their agency" ON public.user_account;

CREATE POLICY "Users can view own account or their agency's directory" ON public.user_account
FOR SELECT
USING (
  auth_user_id = auth.uid()
  OR agency_id = public.get_current_agency_id()
);

---------------------------------------------------------------------------
-- 3. user_account UPDATE — restore manager-scoped agency management, while
--    keeping self-service profile edits working (trigger above still blocks
--    a non-manager from touching sensitive fields even on their own row).
---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Managers can update agency users" ON public.user_account;

CREATE POLICY "Users can update own account or managers update agency users" ON public.user_account
FOR UPDATE
USING (
  auth_user_id = auth.uid()
  OR (
    agency_id = public.get_current_agency_id()
    AND public.is_manager()
  )
)
WITH CHECK (
  auth_user_id = auth.uid()
  OR agency_id = public.get_current_agency_id()
);

---------------------------------------------------------------------------
-- 4. user_invitation SELECT / UPDATE — restore manager-only, agency-scoped
--    access (was USING (true) / WITH CHECK (true), introduced directly by
--    20260811000006 with no prior correctly-scoped version to fall back to).
---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Managers view invitations" ON public.user_invitation;
DROP POLICY IF EXISTS "Managers update invitations" ON public.user_invitation;

CREATE POLICY "Managers view invitations" ON public.user_invitation
FOR SELECT
USING (
  agency_id = public.get_current_agency_id()
  AND public.is_manager()
);

CREATE POLICY "Managers update invitations" ON public.user_invitation
FOR UPDATE
USING (
  agency_id = public.get_current_agency_id()
  AND public.is_manager()
)
WITH CHECK (
  agency_id = public.get_current_agency_id()
);
