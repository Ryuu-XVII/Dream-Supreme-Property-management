-- Migration: Fix RLS Policies and Triggers for Admin & Agent Dual Role
-- Description: Ensures all PostgreSQL RLS policies, trigger functions, and helpers recognize 'admin_agent' and 'admin & agent' as administrative/manager roles.

-- 1. Helper function to check if current user is an admin or manager
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_account
    WHERE auth_user_id = auth.uid()
      AND status = 'active'
      AND role::text IN ('admin', 'principal', 'admin_agent', 'admin & agent')
  );
$$;

-- 2. Update get_current_user_role helper function
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role::text FROM public.user_account
  WHERE auth_user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$;

-- 3. Update can_access_deal helper function
CREATE OR REPLACE FUNCTION public.can_access_deal(p_deal_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.deal d
    WHERE d.id = p_deal_id
      AND d.agency_id = public.get_current_agency_id()
      AND (
        public.get_current_role()::text IN ('principal', 'admin', 'admin_agent', 'admin & agent')
        OR d.created_by = public.get_current_user_account_id()
        OR EXISTS (
          SELECT 1 FROM public.deal_participant dp
          WHERE dp.deal_id = d.id
            AND dp.user_account_id = public.get_current_user_account_id()
        )
      )
  );
$$;

-- 4. Update protect_user_account_sensitive_fields trigger function
CREATE OR REPLACE FUNCTION public.protect_user_account_sensitive_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- If admin override or workflow change is set, allow modification.
  IF coalesce(current_setting('app.admin_override', true), '') = 'true'
     OR coalesce(current_setting('app.workflow_change', true), '') = 'allowed'
     OR public.get_current_role()::text IN ('principal', 'admin', 'admin_agent', 'admin & agent')
     OR public.is_manager() THEN
    RETURN new;
  END IF;

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

-- 5. Update user_account RLS policies
DROP POLICY IF EXISTS "Managers can update agency users" ON public.user_account;
CREATE POLICY "Managers can update agency users" ON public.user_account FOR UPDATE
USING (
  agency_id = public.get_current_agency_id()
  AND (
    public.get_current_role()::text IN ('principal', 'admin', 'admin_agent', 'admin & agent')
    OR public.is_manager()
  )
)
WITH CHECK (agency_id = public.get_current_agency_id());

-- 6. Update user_invitation RLS policies
DROP POLICY IF EXISTS "Managers view invitations" ON public.user_invitation;
CREATE POLICY "Managers view invitations" ON public.user_invitation FOR SELECT
USING (
  agency_id = public.get_current_agency_id()
  OR public.get_current_agency_id() IS NULL
  OR public.get_current_role()::text IN ('principal', 'admin', 'admin_agent', 'admin & agent')
  OR public.is_manager()
);

-- 7. Update notification_preference RLS policies
DROP POLICY IF EXISTS "Managers manage notification preferences" ON public.notification_preference;
CREATE POLICY "Managers manage notification preferences" ON public.notification_preference FOR ALL
USING (
  agency_id = public.get_current_agency_id()
  AND (
    public.get_current_role()::text IN ('principal', 'admin', 'admin_agent', 'admin & agent')
    OR public.is_manager()
  )
)
WITH CHECK (
  agency_id = public.get_current_agency_id()
  AND (
    public.get_current_role()::text IN ('principal', 'admin', 'admin_agent', 'admin & agent')
    OR public.is_manager()
  )
);

-- 8. Update agency profile RLS policies
DROP POLICY IF EXISTS "Managers update agency profile" ON public.agency;
CREATE POLICY "Managers update agency profile" ON public.agency FOR UPDATE
USING (
  id = public.get_current_agency_id()
  AND (
    public.get_current_role()::text IN ('principal', 'admin', 'admin_agent', 'admin & agent')
    OR public.is_manager()
  )
)
WITH CHECK (id = public.get_current_agency_id());

-- 9. Update agency_system_setting RLS policies
DROP POLICY IF EXISTS "Admins update their agency system settings" ON public.agency_system_setting;
CREATE POLICY "Admins update their agency system settings" ON public.agency_system_setting FOR UPDATE
USING (
  agency_id = public.get_current_agency_id()
  AND (
    public.get_current_role()::text IN ('principal', 'admin', 'admin_agent', 'admin & agent')
    OR public.is_manager()
  )
);

-- 10. Update properties, parties, mandates update policies
DROP POLICY IF EXISTS "Managers can update properties" ON public.property;
CREATE POLICY "Managers can update properties" ON public.property FOR UPDATE
USING (
  agency_id = public.get_current_agency_id()
  AND (
    public.get_current_role()::text IN ('principal', 'admin', 'admin_agent', 'admin & agent')
    OR public.is_manager()
    OR EXISTS (SELECT 1 FROM public.deal d WHERE d.property_id = public.property.id AND public.can_access_deal(d.id))
  )
)
WITH CHECK (agency_id = public.get_current_agency_id());

DROP POLICY IF EXISTS "Managers can update parties" ON public.party;
CREATE POLICY "Managers can update parties" ON public.party FOR UPDATE
USING (
  agency_id = public.get_current_agency_id()
  AND (
    public.get_current_role()::text IN ('principal', 'admin', 'admin_agent', 'admin & agent')
    OR public.is_manager()
    OR EXISTS (
      SELECT 1 FROM public.deal_party dp WHERE dp.party_id = public.party.id AND public.can_access_deal(dp.deal_id)
    )
  )
)
WITH CHECK (agency_id = public.get_current_agency_id());

DROP POLICY IF EXISTS "Managers can update mandates" ON public.mandate;
CREATE POLICY "Managers can update mandates" ON public.mandate FOR UPDATE
USING (
  agency_id = public.get_current_agency_id()
  AND (
    public.get_current_role()::text IN ('principal', 'admin', 'admin_agent', 'admin & agent')
    OR public.is_manager()
    OR EXISTS (SELECT 1 FROM public.deal d WHERE d.mandate_id = public.mandate.id AND public.can_access_deal(d.id))
  )
)
WITH CHECK (agency_id = public.get_current_agency_id());
