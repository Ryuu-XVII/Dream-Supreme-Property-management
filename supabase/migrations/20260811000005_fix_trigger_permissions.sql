-- Migration: Fix protect_user_account_sensitive_fields Trigger Function
-- Description: Ensures service role, superusers, and admins with dual role ('admin_agent', 'admin & agent') can modify user account fields.

CREATE OR REPLACE FUNCTION public.protect_user_account_sensitive_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role text;
BEGIN
  -- 1. If bypass settings are enabled (e.g. service_role or admin override), permit update
  IF coalesce(current_setting('app.admin_override', true), '') = 'true'
     OR coalesce(current_setting('app.workflow_change', true), '') = 'allowed'
     OR current_setting('role', true) IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN new;
  END IF;

  -- 2. Fetch current caller role from user_account table
  v_caller_role := lower(coalesce(public.get_current_user_role(), ''));

  -- 3. If caller has any admin role, permit modification of sensitive fields
  IF v_caller_role LIKE '%admin%' OR v_caller_role = 'principal' OR public.is_manager() THEN
    RETURN new;
  END IF;

  -- 4. If non-admin user attempts to alter restricted fields, throw exception
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
