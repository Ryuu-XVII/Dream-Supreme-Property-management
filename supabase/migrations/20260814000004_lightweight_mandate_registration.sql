-- Migration: Lightweight mandate-only registration
-- Description: "Register Mandate" (Mandates Register > New Listing, and the
-- /mandates/new wizard) was calling create_deal(), the RPC built for a fully
-- signed OTP deal. That forced every listing intake through a fabricated
-- "Unassigned Purchaser" and required FICA/OTP-grade data the mandate forms
-- never even collect (sanctions screening, date of birth, income-tax number,
-- source of funds, property-disclosure confirmation) — see the mandates.tsx
-- "Convert to Deal" action, which already treats a mandate and a deal as two
-- separate stages. This migration gives mandates their own lightweight path:
-- property + seller + listing terms only, nothing purchaser/OTP-related.

alter table public.mandate
  add column if not exists seller_party_id uuid references public.party(id) on delete set null,
  add column if not exists listing_agent_id uuid references public.user_account(id) on delete set null;

alter table public.document
  add column if not exists mandate_id uuid references public.mandate(id) on delete set null;

create or replace function public.create_mandate(p_payload jsonb)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_actor_id uuid := public.get_current_user_account_id();
  v_property_id uuid;
  v_party_id uuid;
  v_listing_agent_id uuid;
  v_mandate_id uuid;
begin
  if v_agency_id is null or v_actor_id is null then
    raise exception 'An active company account is required.';
  end if;
  if nullif(trim(p_payload->>'address'), '') is null then
    raise exception 'Property street address is required.';
  end if;
  if nullif(trim(p_payload->>'suburb'), '') is null then
    raise exception 'Property suburb is required.';
  end if;
  if coalesce((p_payload->>'listingPriceCents')::bigint, 0) <= 0 then
    raise exception 'A positive listing price is required.';
  end if;
  if nullif(p_payload->>'mandateExpiresOn', '') is null then
    raise exception 'Mandate expiry date is required.';
  end if;
  if nullif(trim(p_payload->>'sellerName'), '') is null then
    raise exception 'Seller / mandator full name is required.';
  end if;

  v_listing_agent_id := coalesce(nullif(p_payload->>'leadAgentId', '')::uuid, v_actor_id);
  if not public.is_manager() and v_listing_agent_id <> v_actor_id then
    raise exception 'Only a manager may assign a mandate to another practitioner.';
  end if;
  if not exists (
    select 1 from public.user_account
    where id = v_listing_agent_id and agency_id = v_agency_id and status = 'active'
      and role in ('principal', 'agent', 'candidate', 'admin', 'admin_agent')
  ) then
    raise exception 'The selected listing agent is not an active agency practitioner.';
  end if;

  insert into public.property (
    agency_id, address_line, suburb, city, province, postal_code, erf_number,
    title_deed_number, property_type, is_sectional_title, bedrooms, bathrooms,
    garages, erf_size_sqm, floor_size_sqm, legal_description, deeds_office
  ) values (
    v_agency_id, trim(p_payload->>'address'), trim(p_payload->>'suburb'),
    nullif(trim(p_payload->>'city'), ''), nullif(p_payload->>'province', ''),
    nullif(p_payload->>'postalCode', ''), nullif(p_payload->>'erfNumber', ''),
    nullif(trim(p_payload->>'titleDeedNumber'), ''),
    coalesce((p_payload->>'propertyType')::public.property_type, 'house'),
    coalesce((p_payload->>'isSectionalTitle')::boolean, false),
    coalesce((p_payload->>'bedrooms')::int, 0), coalesce((p_payload->>'bathrooms')::int, 0),
    coalesce((p_payload->>'garages')::int, 0), coalesce((p_payload->>'erfSizeSqm')::numeric, 0),
    coalesce((p_payload->>'floorSizeSqm')::numeric, 0),
    nullif(trim(p_payload->>'legalDescription'), ''), nullif(trim(p_payload->>'deedsOffice'), '')
  ) returning id into v_property_id;

  insert into public.party (
    agency_id, party_type, entity_type, full_name, id_or_reg_number, email, mobile,
    address_line, city, province, fica_status, popia_consent_at
  ) values (
    v_agency_id, 'seller', 'natural_person', trim(p_payload->>'sellerName'),
    nullif(trim(p_payload->>'sellerIdNumber'), ''), nullif(trim(p_payload->>'sellerEmail'), ''),
    nullif(trim(p_payload->>'sellerMobile'), ''), nullif(trim(p_payload->>'sellerAddress'), ''),
    nullif(trim(p_payload->>'city'), ''), nullif(p_payload->>'province', ''),
    coalesce((p_payload->>'sellerFicaStatus')::public.fica_status, 'not_started'),
    case when coalesce((p_payload->>'sellerPopiaConsent')::boolean, false) then now() end
  ) returning id into v_party_id;

  insert into public.mandate (
    agency_id, property_id, mandate_type, listing_price_cents, commission_rate_bps,
    signed_on, expires_on, status, seller_party_id, listing_agent_id
  ) values (
    v_agency_id, v_property_id, coalesce((p_payload->>'mandateType')::public.mandate_type, 'sole'),
    (p_payload->>'listingPriceCents')::bigint, coalesce((p_payload->>'commissionRateBps')::int, 500),
    coalesce(nullif(p_payload->>'mandateSignedOn', '')::date, current_date),
    (p_payload->>'mandateExpiresOn')::date, 'active', v_party_id, v_listing_agent_id
  ) returning id into v_mandate_id;

  insert into public.audit_log(agency_id, actor_id, entity_type, entity_id, action, after_json)
  values (
    v_agency_id, v_actor_id, 'mandate', v_mandate_id, 'create',
    jsonb_build_object('property_id', v_property_id, 'seller_party_id', v_party_id)
  );

  return v_mandate_id;
end;
$$;

revoke all on function public.create_mandate(jsonb) from public, anon;
grant execute on function public.create_mandate(jsonb) to authenticated;

-- The create_deal() manager-reassignment check only recognized 'principal' and
-- 'admin' via get_current_role(), so an 'admin_agent' / dual-role user who is
-- genuinely a manager could be wrongly blocked from assigning a deal (even to
-- themselves, if their agentId selection didn't exactly resolve to their own
-- row). is_manager() already covers the full set of manager-equivalent roles
-- and is used consistently elsewhere for this exact check.
create or replace function public.create_deal(p_payload jsonb)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_actor_id uuid := public.get_current_user_account_id();
  v_property_id uuid;
  v_party_id uuid;
  v_primary_purchaser_id uuid;
  v_mandate_id uuid;
  v_deal_id uuid;
  v_conveyancer_id uuid;
  v_lead_agent_id uuid;
  v_reference text;
  v_condition jsonb;
  v_party jsonb;
  v_seller_count int := jsonb_array_length(coalesce(p_payload->'sellers', '[]'::jsonb));
  v_purchaser_count int := jsonb_array_length(coalesce(p_payload->'purchasers', '[]'::jsonb));
begin
  if v_agency_id is null or v_actor_id is null then
    raise exception 'An active company account is required.';
  end if;
  if nullif(trim(p_payload->>'address'), '') is null then raise exception 'Property address is required.'; end if;
  if nullif(trim(p_payload->>'legalDescription'), '') is null then raise exception 'The deeds-search legal description is required.'; end if;
  if nullif(trim(p_payload->>'titleDeedNumber'), '') is null then raise exception 'The current title deed number is required.'; end if;
  if coalesce((p_payload->>'salePriceCents')::bigint, 0) <= 0 then raise exception 'A positive sale price is required.'; end if;
  if nullif(p_payload->>'effectiveDate', '') is null then raise exception 'The agreement effective date is required.'; end if;
  if not coalesce((p_payload->>'propertyDisclosureCompleted')::boolean, false) then
    raise exception 'The statutory property condition disclosure must be completed.';
  end if;
  if v_seller_count < 1 or v_purchaser_count < 1 then
    raise exception 'At least one seller and one purchaser are required.';
  end if;
  if abs((select sum((party->>'sharePercent')::numeric) from jsonb_array_elements(p_payload->'sellers') party) - 100) > 0.001
     or abs((select sum((party->>'sharePercent')::numeric) from jsonb_array_elements(p_payload->'purchasers') party) - 100) > 0.001 then
    raise exception 'Seller shares and purchaser shares must each total 100 percent.';
  end if;

  for v_party in
    select value from jsonb_array_elements(coalesce(p_payload->'sellers', '[]'::jsonb) || coalesce(p_payload->'purchasers', '[]'::jsonb))
  loop
    if nullif(trim(v_party->>'name'), '') is null or nullif(trim(v_party->>'idNumber'), '') is null then
      raise exception 'Every party requires a full legal name and ID, passport, or registration number.';
    end if;
    if nullif(trim(v_party->>'email'), '') is null and nullif(trim(v_party->>'mobile'), '') is null then
      raise exception 'Every party requires an email address or mobile number.';
    end if;
    if not coalesce((v_party->>'sanctionsScreened')::boolean, false) then
      raise exception 'Targeted-financial-sanctions screening is required for every party.';
    end if;
    if (v_party->>'entityType') = 'natural_person' then
      if nullif(v_party->>'dateOfBirth', '') is null or nullif(trim(v_party->>'maritalStatus'), '') is null then
        raise exception 'Natural-person parties require date of birth and marital status.';
      end if;
      if not coalesce((v_party->>'isSaResident')::boolean, true)
         and (nullif(trim(v_party->>'passportNumber'), '') is null
           or nullif(trim(v_party->>'passportCountry'), '') is null) then
        raise exception 'Non-resident natural persons require passport number and issuing country.';
      end if;
      if (p_payload->>'salePriceCents')::bigint >= 200000000
         and nullif(trim(v_party->>'taxNumber'), '') is null then
        raise exception 'Natural-person parties require an income-tax number from R2 million.';
      end if;
    else
      if nullif(trim(v_party->>'taxNumber'), '') is null
         or nullif(trim(v_party->>'representativeName'), '') is null
         or nullif(trim(v_party->>'representativeCapacity'), '') is null
         or nullif(trim(v_party->>'beneficialOwnerDetails'), '') is null then
        raise exception 'Entity parties require tax, representative, capacity, and beneficial-owner details.';
      end if;
    end if;
  end loop;

  if exists (
    select 1 from jsonb_array_elements(p_payload->'purchasers') purchaser
    where nullif(trim(purchaser->>'sourceOfFunds'), '') is null
  ) then
    raise exception 'Every purchaser requires a source-of-funds description.';
  end if;
  if coalesce((p_payload->>'isVatSale')::boolean, false)
     and not exists (
       select 1 from jsonb_array_elements(p_payload->'sellers') seller
       where coalesce((seller->>'isVatVendor')::boolean, false)
     ) then
    raise exception 'A VAT sale requires at least one VAT-vendor seller.';
  end if;
  if coalesce((p_payload->>'depositCents')::bigint, 0) > 0
     and (nullif(p_payload->>'depositDueOn', '') is null
       or nullif(trim(p_payload->>'depositHolder'), '') is null) then
    raise exception 'Deposit due date and stakeholder are required when a deposit is payable.';
  end if;

  v_lead_agent_id := coalesce(nullif(p_payload->>'leadAgentId', '')::uuid, v_actor_id);
  if not public.is_manager() and v_lead_agent_id <> v_actor_id then
    raise exception 'Only a manager may assign a deal to another practitioner.';
  end if;
  if not exists (
    select 1 from public.user_account
    where id = v_lead_agent_id and agency_id = v_agency_id and status = 'active'
      and role in ('principal', 'agent', 'candidate')
  ) then
    raise exception 'The selected lead practitioner is not an active agency practitioner.';
  end if;

  insert into public.property (
    agency_id, address_line, suburb, city, province, postal_code, erf_number,
    title_deed_number, property_type, is_sectional_title, bedrooms, bathrooms,
    garages, erf_size_sqm, floor_size_sqm, legal_description, deeds_office,
    property_use, is_improved, seller_acquired_on, seller_original_purchase_price_cents
  ) values (
    v_agency_id, trim(p_payload->>'address'), trim(p_payload->>'suburb'),
    trim(p_payload->>'city'), p_payload->>'province', p_payload->>'postalCode',
    p_payload->>'erfNumber', trim(p_payload->>'titleDeedNumber'),
    (p_payload->>'propertyType')::public.property_type,
    coalesce((p_payload->>'isSectionalTitle')::boolean, false),
    coalesce((p_payload->>'bedrooms')::int, 0), coalesce((p_payload->>'bathrooms')::int, 0),
    coalesce((p_payload->>'garages')::int, 0), coalesce((p_payload->>'erfSizeSqm')::numeric, 0),
    coalesce((p_payload->>'floorSizeSqm')::numeric, 0), trim(p_payload->>'legalDescription'),
    nullif(trim(p_payload->>'deedsOffice'), ''), nullif(trim(p_payload->>'propertyUse'), ''),
    coalesce((p_payload->>'isImproved')::boolean, true),
    nullif(p_payload->>'sellerAcquiredOn', '')::date,
    nullif(p_payload->>'sellerOriginalPurchasePriceCents', '')::bigint
  ) returning id into v_property_id;

  insert into public.mandate (
    agency_id, property_id, mandate_type, listing_price_cents,
    commission_rate_bps, signed_on, expires_on, status
  ) values (
    v_agency_id, v_property_id, (p_payload->>'mandateType')::public.mandate_type,
    (p_payload->>'listingPriceCents')::bigint, (p_payload->>'commissionRateBps')::int,
    (p_payload->>'mandateSignedOn')::date, (p_payload->>'mandateExpiresOn')::date, 'active'
  ) returning id into v_mandate_id;

  if nullif(trim(p_payload->>'conveyancer'), '') is not null then
    select id into v_conveyancer_id from public.conveyancer_firm
    where agency_id = v_agency_id and lower(name) = lower(trim(p_payload->>'conveyancer'))
    limit 1;
    if v_conveyancer_id is null then
      insert into public.conveyancer_firm(agency_id, name)
      values (v_agency_id, trim(p_payload->>'conveyancer')) returning id into v_conveyancer_id;
    end if;
  end if;

  v_reference := 'DSP-' || to_char(current_date, 'YYYY') || '-' ||
    lpad(nextval('public.deal_reference_seq')::text, 5, '0');

  insert into public.deal (
    agency_id, branch_id, property_id, mandate_id, reference, stage, status,
    sale_price_cents, otp_signed_on, effective_date, offer_expires_on, occupation_date,
    conveyancer_firm_id, conveyancer_reference, is_vat_sale, vat_inclusive, created_by,
    deposit_cents, deposit_due_on, deposit_holder, balance_payment_method,
    occupational_rent_cents, sale_method, transfer_share_percent, parties_connected,
    seller_is_non_resident, property_disclosure_completed, disclosure_defects,
    fixtures_included, fixtures_excluded, special_conditions
  ) values (
    v_agency_id, nullif(p_payload->>'branchId', '')::uuid, v_property_id, v_mandate_id,
    v_reference, 'otp_signed', 'active', (p_payload->>'salePriceCents')::bigint,
    (p_payload->>'effectiveDate')::date, (p_payload->>'effectiveDate')::date,
    nullif(p_payload->>'offerExpiresOn', '')::date, nullif(p_payload->>'occupationDate', '')::date,
    v_conveyancer_id, nullif(p_payload->>'conveyancerReference', ''),
    coalesce((p_payload->>'isVatSale')::boolean, false),
    coalesce((p_payload->>'vatInclusive')::boolean, true), v_actor_id,
    coalesce((p_payload->>'depositCents')::bigint, 0), nullif(p_payload->>'depositDueOn', '')::date,
    nullif(trim(p_payload->>'depositHolder'), ''), nullif(trim(p_payload->>'balancePaymentMethod'), ''),
    coalesce((p_payload->>'occupationalRentCents')::bigint, 0), nullif(trim(p_payload->>'saleMethod'), ''),
    (p_payload->>'transferSharePercent')::numeric,
    coalesce((p_payload->>'partiesConnected')::boolean, false),
    coalesce((p_payload->>'sellerIsNonResident')::boolean, false), true,
    nullif(trim(p_payload->>'disclosureDefects'), ''), nullif(trim(p_payload->>'fixturesIncluded'), ''),
    nullif(trim(p_payload->>'fixturesExcluded'), ''), nullif(trim(p_payload->>'specialConditions'), '')
  ) returning id into v_deal_id;

  for v_party in select value from jsonb_array_elements(p_payload->'sellers') loop
    insert into public.party (
      agency_id, party_type, entity_type, full_name, id_or_reg_number, email, mobile,
      marital_status, is_vat_vendor, fica_status, popia_consent_at, tax_number,
      date_of_birth, nationality, is_sa_resident, passport_number, passport_country,
      representative_name, representative_capacity, beneficial_owner_details, source_of_funds,
      sanctions_screened_at, risk_rating, is_prominent_person
    ) values (
      v_agency_id, 'seller', (v_party->>'entityType')::public.entity_type, trim(v_party->>'name'),
      trim(v_party->>'idNumber'), nullif(trim(v_party->>'email'), ''), nullif(trim(v_party->>'mobile'), ''),
      nullif(v_party->>'maritalStatus', ''), coalesce((v_party->>'isVatVendor')::boolean, false),
      coalesce((v_party->>'ficaStatus')::public.fica_status, 'not_started'),
      case when coalesce((v_party->>'popiaConsent')::boolean, false) then now() end,
      nullif(trim(v_party->>'taxNumber'), ''), nullif(v_party->>'dateOfBirth', '')::date,
      nullif(trim(v_party->>'nationality'), ''), coalesce((v_party->>'isSaResident')::boolean, true),
      nullif(trim(v_party->>'passportNumber'), ''), nullif(trim(v_party->>'passportCountry'), ''),
      nullif(trim(v_party->>'representativeName'), ''), nullif(trim(v_party->>'representativeCapacity'), ''),
      nullif(trim(v_party->>'beneficialOwnerDetails'), ''), nullif(trim(v_party->>'sourceOfFunds'), ''),
      case when coalesce((v_party->>'sanctionsScreened')::boolean, false) then now() end,
      nullif(trim(v_party->>'riskRating'), ''), coalesce((v_party->>'isProminentPerson')::boolean, false)
    ) returning id into v_party_id;
    insert into public.deal_party(deal_id, party_id, role, share_percent)
    values (v_deal_id, v_party_id, 'seller', (v_party->>'sharePercent')::numeric);
  end loop;

  for v_party in select value from jsonb_array_elements(p_payload->'purchasers') loop
    insert into public.party (
      agency_id, party_type, entity_type, full_name, id_or_reg_number, email, mobile,
      marital_status, is_vat_vendor, fica_status, popia_consent_at, tax_number,
      date_of_birth, nationality, is_sa_resident, passport_number, passport_country,
      representative_name, representative_capacity, beneficial_owner_details, source_of_funds,
      sanctions_screened_at, risk_rating, is_prominent_person
    ) values (
      v_agency_id, 'purchaser', (v_party->>'entityType')::public.entity_type, trim(v_party->>'name'),
      trim(v_party->>'idNumber'), nullif(trim(v_party->>'email'), ''), nullif(trim(v_party->>'mobile'), ''),
      nullif(v_party->>'maritalStatus', ''), coalesce((v_party->>'isVatVendor')::boolean, false),
      coalesce((v_party->>'ficaStatus')::public.fica_status, 'not_started'),
      case when coalesce((v_party->>'popiaConsent')::boolean, false) then now() end,
      nullif(trim(v_party->>'taxNumber'), ''), nullif(v_party->>'dateOfBirth', '')::date,
      nullif(trim(v_party->>'nationality'), ''), coalesce((v_party->>'isSaResident')::boolean, true),
      nullif(trim(v_party->>'passportNumber'), ''), nullif(trim(v_party->>'passportCountry'), ''),
      nullif(trim(v_party->>'representativeName'), ''), nullif(trim(v_party->>'representativeCapacity'), ''),
      nullif(trim(v_party->>'beneficialOwnerDetails'), ''), nullif(trim(v_party->>'sourceOfFunds'), ''),
      case when coalesce((v_party->>'sanctionsScreened')::boolean, false) then now() end,
      nullif(trim(v_party->>'riskRating'), ''), coalesce((v_party->>'isProminentPerson')::boolean, false)
    ) returning id into v_party_id;
    if v_primary_purchaser_id is null then v_primary_purchaser_id := v_party_id; end if;
    insert into public.deal_party(deal_id, party_id, role, share_percent)
    values (v_deal_id, v_party_id, 'purchaser', (v_party->>'sharePercent')::numeric);
  end loop;

  insert into public.deal_participant(deal_id, user_account_id, role, split_type, split_value)
  values (v_deal_id, v_lead_agent_id, 'listing_agent', 'percentage', 100);

  insert into public.offer(
    deal_id, property_id, purchaser_party_id, offer_price_cents, deposit_cents,
    bond_amount_cents, expires_on, status, notes
  ) values (
    v_deal_id, v_property_id, v_primary_purchaser_id, (p_payload->>'salePriceCents')::bigint,
    coalesce((p_payload->>'depositCents')::bigint, 0), coalesce((p_payload->>'bondAmountCents')::bigint, 0),
    nullif(p_payload->>'offerExpiresOn', '')::date, 'accepted', nullif(trim(p_payload->>'specialConditions'), '')
  );

  for v_condition in select value from jsonb_array_elements(coalesce(p_payload->'conditions', '[]'::jsonb)) loop
    insert into public.suspensive_condition(
      deal_id, condition_type, description, due_on, original_due_on, responsible_party, status
    ) values (
      v_deal_id, (v_condition->>'type')::public.condition_type, v_condition->>'description',
      (v_condition->>'dueOn')::date, (v_condition->>'dueOn')::date,
      v_condition->>'responsibleParty', 'pending'
    );
  end loop;

  insert into public.checklist_item(deal_id, category, label, is_required)
  values
    (v_deal_id, 'mandate', 'Signed mandate', true),
    (v_deal_id, 'otp', 'Signed offer to purchase', true),
    (v_deal_id, 'property_disclosure', 'PPRA property condition disclosure', true),
    (v_deal_id, 'seller_fica', 'Seller FICA documents', true),
    (v_deal_id, 'purchaser_fica', 'Purchaser FICA documents', true),
    (v_deal_id, 'title_deed', 'Current title deed copy', true),
    (v_deal_id, 'municipal_account', 'Latest municipal account', true);

  if exists (select 1 from jsonb_array_elements(p_payload->'sellers') p where p->>'entityType' <> 'natural_person')
     or exists (select 1 from jsonb_array_elements(p_payload->'purchasers') p where p->>'entityType' <> 'natural_person') then
    insert into public.checklist_item(deal_id, category, label, is_required)
    values (v_deal_id, 'entity_authority', 'Entity registration, authority, and resolution documents', true);
  end if;
  if coalesce((p_payload->>'partiesConnected')::boolean, false) then
    insert into public.checklist_item(deal_id, category, label, is_required)
    values (v_deal_id, 'connected_party_valuations', 'Two independent estate-agent valuations', true);
  end if;
  if coalesce((p_payload->>'sellerIsNonResident')::boolean, false) then
    insert into public.checklist_item(deal_id, category, label, is_required)
    values (v_deal_id, 'section_35a', 'Section 35A withholding-tax assessment', true);
  end if;
  if coalesce((p_payload->>'isSectionalTitle')::boolean, false) then
    insert into public.checklist_item(deal_id, category, label, is_required)
    values
      (v_deal_id, 'levy_clearance', 'Body corporate levy statement and clearance', true),
      (v_deal_id, 'body_corporate_consent', 'Body corporate information and required consents', true);
  end if;
  if coalesce((p_payload->>'bondAmountCents')::bigint, 0) > 0 then
    insert into public.checklist_item(deal_id, category, label, is_required)
    values (v_deal_id, 'bond_grant_letter', 'Formal bond grant letter', true);
  end if;
  if exists (
    select 1
    from jsonb_array_elements((p_payload->'sellers') || (p_payload->'purchasers')) party
    where party->>'maritalStatus' = 'Married in Community of Property'
  ) then
    insert into public.checklist_item(deal_id, category, label, is_required)
    values (v_deal_id, 'spousal_consent', 'Spousal participation or consent evidence', true);
  end if;
  if coalesce((p_payload->>'isVatSale')::boolean, false) then
    insert into public.checklist_item(deal_id, category, label, is_required)
    values (v_deal_id, 'vat_registration', 'VAT registration and transaction tax evidence', true);
  end if;

  insert into public.deal_stage_history(deal_id, to_stage, changed_by, reason)
  values (v_deal_id, 'otp_signed', v_actor_id, 'Deal created from signed agreement');
  insert into public.audit_log(agency_id, actor_id, entity_type, entity_id, action, after_json)
  values (
    v_agency_id, v_actor_id, 'deal', v_deal_id, 'create',
    jsonb_build_object(
      'reference', v_reference, 'stage', 'otp_signed', 'seller_count', v_seller_count,
      'purchaser_count', v_purchaser_count, 'capture_version', 2
    )
  );

  return v_deal_id;
end;
$$;

revoke all on function public.create_deal(jsonb) from public, anon;
grant execute on function public.create_deal(jsonb) to authenticated;
