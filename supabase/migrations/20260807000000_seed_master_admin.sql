-- Migration: Create Master Admin Account (Seed / Bootstrap)
-- Description: Provision Master Admin credentials in auth.users and public.user_account tables.

DO $$
DECLARE
  v_agency_id uuid;
  v_branch_id uuid;
  v_auth_user_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_user_account_id uuid := '00000000-0000-0000-0000-000000000002'::uuid;
  v_encrypted_password text := crypt('Admin@Dream2026!', gen_salt('bf'));
  v_email text := 'admin@dreamsupreme.co.za';
BEGIN
  -- 1. Ensure primary agency exists or retrieve existing
  SELECT id INTO v_agency_id FROM public.agency ORDER BY created_at ASC LIMIT 1;

  IF v_agency_id IS NULL THEN
    INSERT INTO public.agency (id, name, registration_number, ppra_reference, is_vat_vendor)
    VALUES (
      gen_random_uuid(),
      'Dream Supreme Properties',
      '2026/000001/07',
      'F123456',
      true
    )
    RETURNING id INTO v_agency_id;
  END IF;

  -- 2. Retrieve optional branch
  SELECT id INTO v_branch_id FROM public.branch WHERE agency_id = v_agency_id ORDER BY created_at ASC LIMIT 1;

  -- 3. Provision / Update auth.users master admin record
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    SELECT id INTO v_auth_user_id FROM auth.users WHERE email = v_email;

    UPDATE auth.users
    SET encrypted_password = v_encrypted_password,
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now(),
        raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
        raw_user_meta_data = '{"full_name":"Master Admin"}'::jsonb
    WHERE id = v_auth_user_id;
  ELSE
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      v_auth_user_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'authenticated',
      'authenticated',
      v_email,
      v_encrypted_password,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Master Admin"}'::jsonb,
      now(),
      now()
    );
  END IF;

  -- 4. Provision / Update public.user_account profile with 'admin' role
  INSERT INTO public.user_account (
    id,
    auth_user_id,
    agency_id,
    branch_id,
    full_name,
    email,
    mobile,
    role,
    status
  ) VALUES (
    v_user_account_id,
    v_auth_user_id,
    v_agency_id,
    v_branch_id,
    'Master Admin',
    v_email,
    '+27800000000',
    'admin',
    'active'
  )
  ON CONFLICT (auth_user_id) DO UPDATE
  SET role = 'admin',
      status = 'active',
      agency_id = v_agency_id,
      full_name = 'Master Admin',
      updated_at = now();

END $$;
