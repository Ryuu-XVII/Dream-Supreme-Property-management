-- Migration: Admin Portal Schema Updates
-- Description: Adds commission_pct to user_account and RPCs for bulk actions.

-- 1. Add commission_pct to user_account
ALTER TABLE public.user_account 
ADD COLUMN IF NOT EXISTS commission_pct numeric(5,2) NULL;

-- 2. Bulk Retire Users RPC
CREATE OR REPLACE FUNCTION public.admin_bulk_retire_users(p_user_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agency_id uuid;
    v_user_id uuid;
BEGIN
    -- Verify the caller is an admin or principal
    IF public.get_current_role() NOT IN ('admin', 'principal') THEN
        RAISE EXCEPTION 'Unauthorized: Only admins or principals can retire users.';
    END IF;

    v_agency_id := public.get_current_agency_id();

    -- Update users
    UPDATE public.user_account
    SET status = 'archived',
        updated_at = now()
    WHERE id = ANY(p_user_ids)
      AND agency_id = v_agency_id;

    -- Log audit event for each user
    FOREACH v_user_id IN ARRAY p_user_ids LOOP
        INSERT INTO public.audit_log(agency_id, actor_id, entity_type, entity_id, action, after_json)
        VALUES (
            v_agency_id,
            public.get_current_user_account_id(),
            'user_account',
            v_user_id,
            'archived',
            jsonb_build_object('status', 'archived')
        );
    END LOOP;
END;
$$;

-- 3. Bulk Reset Commission RPC
CREATE OR REPLACE FUNCTION public.admin_bulk_reset_commission(p_user_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agency_id uuid;
    v_user_id uuid;
BEGIN
    -- Verify the caller is an admin or principal
    IF public.get_current_role() NOT IN ('admin', 'principal') THEN
        RAISE EXCEPTION 'Unauthorized: Only admins or principals can reset commissions.';
    END IF;

    v_agency_id := public.get_current_agency_id();

    -- Update users to fallback to default rules
    UPDATE public.user_account
    SET commission_pct = NULL,
        updated_at = now()
    WHERE id = ANY(p_user_ids)
      AND agency_id = v_agency_id;

    -- Log audit event for each user
    FOREACH v_user_id IN ARRAY p_user_ids LOOP
        INSERT INTO public.audit_log(agency_id, actor_id, entity_type, entity_id, action, after_json)
        VALUES (
            v_agency_id,
            public.get_current_user_account_id(),
            'user_account',
            v_user_id,
            'commission_reset',
            jsonb_build_object('commission_pct', null)
        );
    END LOOP;
END;
$$;
