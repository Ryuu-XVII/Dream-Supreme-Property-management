-- Add 'archived' status to deal_status enum if not exists
DO $$ BEGIN 
  ALTER TYPE public.deal_status ADD VALUE 'archived'; 
EXCEPTION 
  WHEN duplicate_object THEN null; 
END $$;

-- Add last_login_at to user_account
ALTER TABLE public.user_account ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- 1. Archive Old Deals RPC
CREATE OR REPLACE FUNCTION public.admin_archive_old_deals(p_agency_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_archived_count integer;
BEGIN
  -- Ensure caller is an admin or principal of the agency
  IF NOT (public.get_current_role() IN ('admin', 'principal') AND public.get_current_agency_id() = p_agency_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins or principals can archive deals for this agency.';
  END IF;

  UPDATE public.deal
  SET status = 'archived', updated_at = NOW()
  WHERE agency_id = p_agency_id
    AND status IN ('registered', 'cancelled')
    AND updated_at < NOW() - INTERVAL '3 years';
    
  GET DIAGNOSTICS v_archived_count = ROW_COUNT;
  
  RETURN v_archived_count;
END;
$$;

-- 2. Deactivate Idle Agents RPC
CREATE OR REPLACE FUNCTION public.admin_deactivate_idle_agents(p_agency_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deactivated_count integer;
BEGIN
  -- Ensure caller is an admin or principal of the agency
  IF NOT (public.get_current_role() IN ('admin', 'principal') AND public.get_current_agency_id() = p_agency_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins or principals can deactivate agents for this agency.';
  END IF;

  UPDATE public.user_account
  SET status = 'suspended', updated_at = NOW()
  WHERE agency_id = p_agency_id
    AND role NOT IN ('admin', 'principal')
    AND status = 'active'
    AND (
      (last_login_at IS NOT NULL AND last_login_at < NOW() - INTERVAL '90 days')
      OR
      (last_login_at IS NULL AND updated_at < NOW() - INTERVAL '90 days')
    );
    
  GET DIAGNOSTICS v_deactivated_count = ROW_COUNT;
  
  RETURN v_deactivated_count;
END;
$$;

-- 3. Empty Recycle Bin RPC (Hard Delete of soft-deleted items)
CREATE OR REPLACE FUNCTION public.admin_empty_recycle_bin(p_agency_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deals_deleted integer;
  v_properties_deleted integer;
  v_parties_deleted integer;
BEGIN
  -- Ensure caller is an admin or principal of the agency
  IF NOT (public.get_current_role() IN ('admin', 'principal') AND public.get_current_agency_id() = p_agency_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins or principals can empty the recycle bin for this agency.';
  END IF;

  -- Delete soft-deleted deals
  DELETE FROM public.deal
  WHERE agency_id = p_agency_id AND archived_at IS NOT NULL;
  GET DIAGNOSTICS v_deals_deleted = ROW_COUNT;

  -- Delete soft-deleted properties
  DELETE FROM public.property
  WHERE agency_id = p_agency_id AND archived_at IS NOT NULL;
  GET DIAGNOSTICS v_properties_deleted = ROW_COUNT;

  -- Delete soft-deleted parties (contacts/clients)
  DELETE FROM public.party
  WHERE agency_id = p_agency_id AND archived_at IS NOT NULL;
  GET DIAGNOSTICS v_parties_deleted = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'deals', v_deals_deleted,
    'properties', v_properties_deleted,
    'parties', v_parties_deleted
  );
END;
$$;
