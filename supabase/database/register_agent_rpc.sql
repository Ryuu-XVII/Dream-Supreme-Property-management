CREATE OR REPLACE FUNCTION public.register_new_agent (
  p_full_name text,
  p_email text,
  p_mobile text DEFAULT NULL,
  p_avatar_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auth_uid uuid;
  v_agency_id uuid;
  v_user_account_id uuid;
BEGIN
  -- Get the current authenticated user's ID
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get or create default Agency (Dream Supreme Properties)
  SELECT id INTO v_agency_id FROM public.agency LIMIT 1;
  
  IF v_agency_id IS NULL THEN
    INSERT INTO public.agency (
      name,
      registration_number,
      ppra_reference,
      is_vat_vendor,
      address
    ) VALUES (
      'Dream Supreme Properties',
      '2026/000001/07',
      'F123456',
      true,
      'Cape Town, South Africa'
    )
    RETURNING id INTO v_agency_id;
  END IF;

  -- Create or update the user_account for this auth user
  INSERT INTO public.user_account (
    auth_user_id,
    agency_id,
    full_name,
    email,
    mobile,
    avatar_key,
    role,
    status
  ) VALUES (
    v_auth_uid,
    v_agency_id,
    p_full_name,
    p_email,
    p_mobile,
    p_avatar_key,
    'agent',
    'active'
  )
  ON CONFLICT (auth_user_id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    mobile = COALESCE(EXCLUDED.mobile, public.user_account.mobile),
    avatar_key = COALESCE(EXCLUDED.avatar_key, public.user_account.avatar_key),
    updated_at = now()
  RETURNING id INTO v_user_account_id;

  RETURN v_user_account_id;
END;
$$;
