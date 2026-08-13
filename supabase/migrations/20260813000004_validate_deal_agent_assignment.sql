-- Migration: Validate deal agent assignment stays within the caller's agency
-- Description: create_deal_full checked the caller's own agency via get_current_agency_id()
-- but never verified that p_agent_id (the user_account assigned as listing_agent) actually
-- belongs to that agency, or exists/is active at all. Any agent could pass an arbitrary uuid
-- -- another agency's user, an archived account, or a non-existent id -- and have it recorded
-- as the deal's listing agent, which downstream feeds commission-split calculations.

CREATE OR REPLACE FUNCTION public.create_deal_full (
  p_address_line text,
  p_suburb text,
  p_city text,
  p_property_type public.property_type,
  p_beds smallint,
  p_baths smallint,
  p_garages smallint,
  p_erf_size_sqm numeric,
  p_floor_size_sqm numeric,

  p_mandate_type public.mandate_type,
  p_listing_price_cents bigint,
  p_commission_rate_bps int,

  p_seller_name text,
  p_seller_email text,
  p_seller_mobile text,
  p_seller_fica public.fica_status,

  p_buyer_name text,
  p_buyer_email text,
  p_buyer_mobile text,
  p_buyer_fica public.fica_status,

  p_sale_price_cents bigint,
  p_otp_signed_on date,
  p_occupation_date date,
  p_conveyancer_name text,
  p_agent_id uuid,

  p_bond_amount_cents bigint,
  p_bond_due_date date,
  p_fica_due_date date
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_agency_id uuid;
  v_property_id uuid;
  v_seller_id uuid;
  v_buyer_id uuid;
  v_mandate_id uuid;
  v_deal_id uuid;
BEGIN
  v_agency_id := public.get_current_agency_id();
  IF v_agency_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_account
    WHERE id = p_agent_id AND agency_id = v_agency_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Assigned agent must be an active member of your agency';
  END IF;

  -- 1. Create property
  INSERT INTO public.property (agency_id, address_line, suburb, city, property_type, bedrooms, bathrooms, garages, erf_size_sqm, floor_size_sqm)
  VALUES (v_agency_id, p_address_line, p_suburb, p_city, p_property_type, p_beds, p_baths, p_garages, p_erf_size_sqm, p_floor_size_sqm)
  RETURNING id INTO v_property_id;

  -- 2. Create parties
  INSERT INTO public.party (agency_id, party_type, full_name, email, mobile, fica_status)
  VALUES (v_agency_id, 'seller', p_seller_name, p_seller_email, p_seller_mobile, p_seller_fica)
  RETURNING id INTO v_seller_id;

  INSERT INTO public.party (agency_id, party_type, full_name, email, mobile, fica_status)
  VALUES (v_agency_id, 'purchaser', p_buyer_name, p_buyer_email, p_buyer_mobile, p_buyer_fica)
  RETURNING id INTO v_buyer_id;

  -- 3. Create mandate
  INSERT INTO public.mandate (agency_id, property_id, mandate_type, listing_price_cents, commission_rate_bps)
  VALUES (v_agency_id, v_property_id, p_mandate_type, p_listing_price_cents, p_commission_rate_bps)
  RETURNING id INTO v_mandate_id;

  -- 4. Create deal
  INSERT INTO public.deal (agency_id, property_id, mandate_id, reference, stage, status, sale_price_cents, otp_signed_on, occupation_date)
  VALUES (v_agency_id, v_property_id, v_mandate_id, 'DSP-' || to_char(now(), 'YYYY') || '-' || floor(random() * 9000 + 1000)::text, 'otp_signed', 'active', p_sale_price_cents, p_otp_signed_on, p_occupation_date)
  RETURNING id INTO v_deal_id;

  -- 5. Deal participants
  INSERT INTO public.deal_participant (deal_id, user_account_id, role, split_value)
  VALUES (v_deal_id, p_agent_id, 'listing_agent', 100);

  -- 6. Deal parties
  INSERT INTO public.deal_party (deal_id, party_id, role)
  VALUES (v_deal_id, v_seller_id, 'seller'), (v_deal_id, v_buyer_id, 'purchaser');

  -- 7. Conditions
  IF p_bond_amount_cents > 0 THEN
    INSERT INTO public.suspensive_condition (deal_id, condition_type, description, due_on, original_due_on, responsible_party)
    VALUES (v_deal_id, 'bond_approval', 'Bond approval required', p_bond_due_date, p_bond_due_date, 'purchaser');
  END IF;

  IF p_fica_due_date IS NOT NULL THEN
    INSERT INTO public.suspensive_condition (deal_id, condition_type, description, due_on, original_due_on, responsible_party)
    VALUES (v_deal_id, 'fica_clearance', 'Deposit clearance', p_fica_due_date, p_fica_due_date, 'purchaser');
  END IF;

  RETURN v_deal_id;
END;
$$;
