CREATE OR REPLACE FUNCTION public.register_new_agent(
    p_full_name text,
    p_email text,
    p_mobile text,
    p_avatar_key text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_agency_id uuid;
BEGIN
    -- Get the ID of the authenticated user
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Fetch the specific agency 'Dream Supreme Properties'
    SELECT id INTO v_agency_id
    FROM public.agency
    WHERE name = 'Dream Supreme Properties'
    LIMIT 1;

    IF v_agency_id IS NULL THEN
        RAISE EXCEPTION 'Agency "Dream Supreme Properties" not found. Cannot register agent.';
    END IF;

    -- Insert the new user account
    INSERT INTO public.user_account (
        auth_user_id,
        agency_id,
        email,
        full_name,
        role,
        mobile,
        avatar_key
    ) VALUES (
        v_user_id,
        v_agency_id,
        p_email,
        p_full_name,
        'agent'::public.user_role,
        p_mobile,
        p_avatar_key
    );
END;
$$;
