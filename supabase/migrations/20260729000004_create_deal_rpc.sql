-- =============================================================================
-- CREATE DEAL RPC
-- Migration: 20260729000004_create_deal_rpc.sql
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_deal_full(
    p_address_line text,
    p_suburb text,
    p_city text,
    p_property_type text,
    p_beds int,
    p_baths int,
    p_garages int,
    p_erf_size_sqm numeric,
    p_floor_size_sqm numeric,
    
    p_mandate_type text,
    p_listing_price_cents bigint,
    p_commission_rate_bps int,
    
    p_seller_name text,
    p_seller_email text,
    p_seller_mobile text,
    p_seller_fica text,
  
    p_buyer_name text,
    p_buyer_email text,
    p_buyer_mobile text,
    p_buyer_fica text,
  
    p_sale_price_cents bigint,
    p_otp_signed_on date,
    p_occupation_date date,
    p_conveyancer_name text,
    p_agent_id text,
    
    p_bond_amount_cents bigint,
    p_bond_due_date date,
    p_fica_due_date date
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_agency_id uuid;
    v_user_account_id uuid;
    v_property_id uuid;
    v_seller_id uuid;
    v_buyer_id uuid;
    v_mandate_id uuid;
    v_conveyancer_id uuid;
    v_deal_id uuid;
BEGIN
    -- 1. Get current user's account and agency
    SELECT id, agency_id INTO v_user_account_id, v_agency_id
    FROM public.user_account
    WHERE auth_user_id = auth.uid()
    AND status = 'active'
    LIMIT 1;

    IF v_user_account_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated or user account inactive';
    END IF;

    -- 2. Insert Property
    INSERT INTO public.property (agency_id, address_line, suburb, city, property_type, bedrooms, bathrooms, garages, erf_size_sqm, floor_size_sqm)
    VALUES (v_agency_id, p_address_line, p_suburb, p_city, p_property_type::public.property_type, p_beds, p_baths, p_garages, p_erf_size_sqm, p_floor_size_sqm)
    RETURNING id INTO v_property_id;

    -- 3. Insert Parties (Seller and Buyer)
    INSERT INTO public.party (agency_id, party_type, full_name, email, mobile, fica_status)
    VALUES (v_agency_id, 'seller', p_seller_name, p_seller_email, p_seller_mobile, p_seller_fica::public.fica_status)
    RETURNING id INTO v_seller_id;

    INSERT INTO public.party (agency_id, party_type, full_name, email, mobile, fica_status)
    VALUES (v_agency_id, 'purchaser', p_buyer_name, p_buyer_email, p_buyer_mobile, p_buyer_fica::public.fica_status)
    RETURNING id INTO v_buyer_id;

    -- 4. Insert Mandate
    INSERT INTO public.mandate (agency_id, property_id, mandate_type, listing_price_cents, commission_rate_bps, signed_on, status)
    VALUES (v_agency_id, v_property_id, p_mandate_type::public.mandate_type, p_listing_price_cents, p_commission_rate_bps, CURRENT_DATE, 'active')
    RETURNING id INTO v_mandate_id;

    -- 5. Deal Conveyancer (lookup or create)
    IF p_conveyancer_name IS NOT NULL AND p_conveyancer_name != '' THEN
        SELECT id INTO v_conveyancer_id FROM public.conveyancer_firm WHERE name = p_conveyancer_name AND agency_id = v_agency_id LIMIT 1;
        IF v_conveyancer_id IS NULL THEN
            INSERT INTO public.conveyancer_firm (agency_id, name) VALUES (v_agency_id, p_conveyancer_name) RETURNING id INTO v_conveyancer_id;
        END IF;
    END IF;

    -- 6. Insert Deal
    -- Ensure deal status goes to active (or registered if completed, but creation is active)
    INSERT INTO public.deal (agency_id, property_id, mandate_id, deal_type, reference, stage, status, sale_price_cents, otp_signed_on, occupation_date, conveyancer_firm_id, created_by)
    VALUES (
        v_agency_id, v_property_id, v_mandate_id, 'sale', 
        'D' || to_char(CURRENT_DATE, 'YYMM') || '-' || upper(substring(regexp_replace(gen_random_uuid()::text, '-', '', 'g') from 1 for 4)), 
        'otp_signed', 'active', p_sale_price_cents, p_otp_signed_on, p_occupation_date, v_conveyancer_id, v_user_account_id
    )
    RETURNING id INTO v_deal_id;

    -- 7. Insert Deal Participants (Listing Agent)
    INSERT INTO public.deal_participant (deal_id, user_account_id, role, split_value)
    VALUES (v_deal_id, v_user_account_id, 'listing_agent', 100);

    -- 8. Link Parties to Deal
    INSERT INTO public.deal_party (deal_id, party_id, role) VALUES (v_deal_id, v_seller_id, 'seller');
    INSERT INTO public.deal_party (deal_id, party_id, role) VALUES (v_deal_id, v_buyer_id, 'purchaser');

    -- 9. Insert Suspensive Conditions
    IF p_bond_amount_cents > 0 AND p_bond_due_date IS NOT NULL THEN
        INSERT INTO public.suspensive_condition (deal_id, condition_type, description, due_on, original_due_on, status)
        VALUES (v_deal_id, 'bond_approval', 'Bond approval required', p_bond_due_date, p_bond_due_date, 'pending');
    END IF;

    IF p_fica_due_date IS NOT NULL THEN
        INSERT INTO public.suspensive_condition (deal_id, condition_type, description, due_on, original_due_on, status)
        VALUES (v_deal_id, 'fica_clearance', 'FICA clearance required', p_fica_due_date, p_fica_due_date, 'pending');
    END IF;

    RETURN v_deal_id;
END;
$$;
