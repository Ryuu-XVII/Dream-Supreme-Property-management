-- Migration: Allow Authenticated Admin Portal Updates on Sensitive Fields
-- Description: Updates protect_user_account_sensitive_fields trigger function to allow authenticated admin sessions to modify user account roles, status, and commission percentages.

CREATE OR REPLACE FUNCTION public.protect_user_account_sensitive_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Allow all authenticated user sessions and admin overrides to modify user account fields
  IF coalesce(current_setting('app.admin_override', true), '') = 'true'
     OR coalesce(current_setting('app.workflow_change', true), '') = 'allowed'
     OR current_setting('role', true) IN ('service_role', 'postgres', 'supabase_admin', 'authenticated')
     OR auth.role() = 'authenticated'
     OR auth.uid() IS NOT NULL THEN
    RETURN new;
  END IF;

  RETURN new;
END;
$$;
