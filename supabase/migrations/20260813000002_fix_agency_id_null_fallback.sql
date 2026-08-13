-- Migration: Remove arbitrary-agency fallback from get_current_agency_id
-- Description: Migration 20260811000006 changed get_current_agency_id() to fall back to
-- "SELECT id FROM public.agency LIMIT 1" whenever the caller has no active user_account row
-- (e.g. a newly-registered auth user, or one whose account was archived/deleted). Every RLS
-- policy that calls get_current_agency_id() trusts its return value, so this silently scoped
-- such a user's access to an arbitrary agency instead of denying access. The correct behavior
-- is to return NULL, which makes `agency_id = get_current_agency_id()` evaluate to NULL (not
-- true) in every policy, so access is denied by default. The one caller that previously relied
-- on the NULL-bypass ("... OR get_current_agency_id() IS NULL") was already replaced by
-- migration 20260813000001, so removing the fallback here is safe.

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

  RETURN v_agency_id;
END;
$$;
