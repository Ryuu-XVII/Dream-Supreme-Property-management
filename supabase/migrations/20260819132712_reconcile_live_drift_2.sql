set local check_function_bodies = off;

create or replace function public.accept_user_invitation (
  p_token      text,
  p_full_name  text,
  p_mobile     text,
  p_avatar_key text default null::text
)
  returns uuid
  language plpgsql
  security definer
  set search_path to 'public', 'extensions', 'pg_temp'
  AS $function$
declare
  v_invite public.user_invitation%rowtype;
  v_account_id uuid;
  v_auth_email text := lower(coalesce(auth.jwt()->>'email', ''));
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;

  select * into v_invite from public.user_invitation
    where token_hash = encode(digest(p_token, 'sha256'), 'hex')
      and accepted_at is null and expires_at > now() for update;

  if v_invite.id is null or lower(v_invite.email) <> v_auth_email then
    raise exception 'Invitation is invalid or expired.';
  end if;

  insert into public.user_account(auth_user_id, agency_id, email, full_name, role, seniority, mobile, avatar_key, property24_url)
  values (auth.uid(), v_invite.agency_id, v_invite.email, trim(p_full_name), v_invite.role, v_invite.seniority, p_mobile, p_avatar_key, v_invite.property24_url)
  on conflict (auth_user_id) do update set
    full_name = excluded.full_name,
    mobile = excluded.mobile,
    avatar_key = coalesce(excluded.avatar_key, public.user_account.avatar_key),
    role = excluded.role,
    seniority = excluded.seniority,
    property24_url = coalesce(excluded.property24_url, public.user_account.property24_url),
    status = 'active'
  returning id into v_account_id;

  update public.user_invitation set accepted_at = now() where id = v_invite.id;

  return v_account_id;
end;
$function$;

create or replace function public.assign_lead_round_robin (
  p_lead_id uuid
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
  AS $function$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_agent_id uuid;
begin
  select u.id into v_agent_id
  from public.user_account u
  left join public.lead_capture l on l.assigned_agent_id = u.id and l.agency_id = v_agency_id
  where u.agency_id = v_agency_id
    and u.status = 'active'
    and u.role in ('agent', 'admin', 'admin_agent')
  group by u.id
  order by count(l.id) asc, u.created_at asc
  limit 1;

  if v_agent_id is not null then
    update public.lead_capture
    set assigned_agent_id = v_agent_id,
        status = 'contacted'
    where id = p_lead_id and agency_id = v_agency_id;
  end if;

  return jsonb_build_object('lead_id', p_lead_id, 'assigned_agent_id', v_agent_id);
end;
$function$;

create or replace function public.bootstrap_principal (
  p_agency_slug  text,
  p_auth_user_id uuid,
  p_email        text,
  p_full_name    text
)
  returns uuid
  language plpgsql
  security definer
  set search_path to 'public', 'auth', 'pg_temp'
  AS $function$
declare
  v_agency_id uuid;
  v_account_id uuid;
begin
  select id into v_agency_id from public.agency where public_slug = p_agency_slug;
  if v_agency_id is null then raise exception 'Agency not found.'; end if;
  if exists (select 1 from public.user_account where agency_id = v_agency_id and role = 'admin') then
    raise exception 'This agency already has an admin account.';
  end if;
  if not exists (
    select 1 from auth.users where id = p_auth_user_id and lower(email) = lower(trim(p_email))
  ) then
    raise exception 'The matching Supabase Auth user does not exist.';
  end if;
  insert into public.user_account(auth_user_id, agency_id, full_name, email, role, status)
  values (p_auth_user_id, v_agency_id, trim(p_full_name), lower(trim(p_email)), 'admin', 'active')
  returning id into v_account_id;
  return v_account_id;
end;
$function$;

create or replace function public.can_access_deal (
  p_deal_id uuid
)
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public', 'pg_temp'
  AS $function$
  select exists (
    select 1
    from public.deal d
    where d.id = p_deal_id
      and d.agency_id = public.get_current_agency_id()
      and (
        public.get_current_role()::text in ('admin', 'admin_agent', 'admin & agent')
        or d.created_by = public.get_current_user_account_id()
        or exists (
          select 1 from public.deal_participant dp
          where dp.deal_id = d.id
            and dp.user_account_id = public.get_current_user_account_id()
        )
      )
  );
$function$;

create or replace function public.can_edit_lease (
  p_lease_id uuid
)
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public', 'pg_temp'
  AS $function$
  select exists (
    select 1 from public.lease l
    where l.id = p_lease_id
      and l.agency_id = public.get_current_agency_id()
      and (l.managed_by = public.get_current_user_account_id() or public.get_current_role() in ('admin', 'admin_agent'))
  );
$function$;

create or replace function public.create_client (
  p_payload jsonb
)
  returns uuid
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
  AS $function$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_actor_id uuid := public.get_current_user_account_id();
  v_party_id uuid;
  v_assigned_to uuid;
  v_roles public.party_type[];
  v_primary_role public.party_type;
  v_entity_type public.entity_type;
  v_start_fica boolean := coalesce((p_payload->>'startFica')::boolean, false);
  v_marketing_consent boolean := coalesce((p_payload->>'directMarketingConsent')::boolean, false);
  v_channels text[];
begin
  if v_agency_id is null or v_actor_id is null then
    raise exception 'An active company account is required.';
  end if;

  select coalesce(array_agg(value::public.party_type), '{}'::public.party_type[])
  into v_roles from jsonb_array_elements_text(coalesce(p_payload->'roles', '[]'::jsonb));
  select coalesce(array_agg(value), '{}'::text[])
  into v_channels from jsonb_array_elements_text(coalesce(p_payload->'directMarketingChannels', '[]'::jsonb));

  if nullif(trim(p_payload->>'name'), '') is null then
    raise exception 'Full legal name or registered entity name is required.';
  end if;
  if cardinality(v_roles) = 0 then raise exception 'Select at least one client role.'; end if;
  if nullif(trim(p_payload->>'email'), '') is null and nullif(trim(p_payload->>'mobile'), '') is null then
    raise exception 'An email address or mobile number is required.';
  end if;
  if not coalesce((p_payload->>'privacyNoticeDelivered')::boolean, false) then
    raise exception 'Confirm that the POPIA privacy notice was delivered to the client.';
  end if;
  if (p_payload->>'preferredContactChannel') = 'email' and nullif(trim(p_payload->>'email'), '') is null then
    raise exception 'An email address is required when email is the preferred contact method.';
  end if;
  if (p_payload->>'preferredContactChannel') in ('phone', 'whatsapp')
     and nullif(trim(p_payload->>'mobile'), '') is null then
    raise exception 'A mobile number is required for phone or WhatsApp contact.';
  end if;
  if v_marketing_consent and cardinality(v_channels) = 0 then
    raise exception 'Select at least one consented direct-marketing channel.';
  end if;
  if exists (
    select 1 from unnest(v_channels) channel
    where channel <> all(array['email', 'sms', 'whatsapp', 'phone']::text[])
  ) then
    raise exception 'An invalid direct-marketing channel was supplied.';
  end if;
  if coalesce(p_payload->>'processingBasis', '') not in ('requested_service', 'mandate_contract', 'legal_obligation', 'consent') then
    raise exception 'Select a valid reason for processing the client information.';
  end if;

  v_entity_type := coalesce(nullif(p_payload->>'entityType', '')::public.entity_type, 'natural_person');
  if v_start_fica then
    if nullif(trim(p_payload->>'idNumber'), '') is null then
      raise exception 'ID, passport, trust, or registration number is required.';
    end if;
    if nullif(trim(p_payload->>'addressLine'), '') is null
       or nullif(trim(p_payload->>'city'), '') is null
       or nullif(trim(p_payload->>'province'), '') is null then
      raise exception 'Residential or registered address, city, and province are required for FICA.';
    end if;
    if not coalesce((p_payload->>'sanctionsScreened')::boolean, false) then
      raise exception 'Targeted-financial-sanctions screening must be completed at client take-on.';
    end if;
    if not coalesce((p_payload->>'prominentPersonScreened')::boolean, false) then
      raise exception 'Domestic/foreign prominent-person screening must be completed at client take-on.';
    end if;
    if v_entity_type = 'natural_person' then
      if nullif(p_payload->>'dateOfBirth', '') is null or nullif(trim(p_payload->>'nationality'), '') is null then
        raise exception 'Natural persons require date of birth and nationality.';
      end if;
      if not coalesce((p_payload->>'isSaResident')::boolean, true)
         and (nullif(trim(p_payload->>'passportNumber'), '') is null
           or nullif(trim(p_payload->>'passportCountry'), '') is null) then
        raise exception 'Non-residents require passport number and issuing country.';
      end if;
    else
      if nullif(trim(p_payload->>'representativeName'), '') is null
         or nullif(trim(p_payload->>'representativeCapacity'), '') is null
         or nullif(trim(p_payload->>'beneficialOwnerDetails'), '') is null then
        raise exception 'Entities require an authorised representative, capacity, and beneficial-owner details.';
      end if;
    end if;
    if 'purchaser' = any(v_roles) and nullif(trim(p_payload->>'sourceOfFunds'), '') is null then
      raise exception 'Source of funds is required when onboarding a purchaser.';
    end if;
  end if;

  if nullif(trim(p_payload->>'idNumber'), '') is not null and exists (
    select 1 from public.party
    where agency_id = v_agency_id and archived_at is null
      and lower(trim(id_or_reg_number)) = lower(trim(p_payload->>'idNumber'))
  ) then
    raise exception 'A client with this identity or registration number already exists.';
  end if;

  v_assigned_to := coalesce(nullif(p_payload->>'assignedTo', '')::uuid, v_actor_id);
  if not public.is_manager() and v_assigned_to <> v_actor_id then
    raise exception 'Only a manager may assign a client to another practitioner.';
  end if;
  if not exists (
    select 1 from public.user_account
    where id = v_assigned_to and agency_id = v_agency_id and status = 'active'
      and role in ('admin', 'agent', 'admin_agent')
  ) then
    raise exception 'The selected practitioner is not active in this company.';
  end if;

  v_primary_role := v_roles[1];
  insert into public.party (
    agency_id, party_type, client_roles, entity_type, full_name, id_or_reg_number,
    email, mobile, assigned_to, preferred_contact_channel, contact_language,
    acquisition_source, processing_basis, privacy_notice_delivered_at,
    direct_marketing_consent_at, direct_marketing_channels, onboarding_notes,
    address_line, suburb, city, province, postal_code, tax_number, date_of_birth,
    marital_status, nationality, is_sa_resident, passport_number, passport_country,
    representative_name, representative_capacity, beneficial_owner_details,
    source_of_funds, sanctions_screened_at, risk_rating, prominent_person_screened_at,
    is_prominent_person, fica_status
  ) values (
    v_agency_id, v_primary_role, v_roles, v_entity_type, trim(p_payload->>'name'),
    nullif(trim(p_payload->>'idNumber'), ''), nullif(lower(trim(p_payload->>'email')), ''),
    nullif(trim(p_payload->>'mobile'), ''), v_assigned_to,
    nullif(p_payload->>'preferredContactChannel', ''), nullif(trim(p_payload->>'contactLanguage'), ''),
    nullif(trim(p_payload->>'acquisitionSource'), ''), p_payload->>'processingBasis', now(),
    case when v_marketing_consent then now() end,
    case when v_marketing_consent then v_channels else '{}'::text[] end,
    nullif(trim(p_payload->>'onboardingNotes'), ''), nullif(trim(p_payload->>'addressLine'), ''),
    nullif(trim(p_payload->>'suburb'), ''), nullif(trim(p_payload->>'city'), ''),
    nullif(trim(p_payload->>'province'), ''), nullif(trim(p_payload->>'postalCode'), ''),
    nullif(trim(p_payload->>'taxNumber'), ''), nullif(p_payload->>'dateOfBirth', '')::date,
    nullif(trim(p_payload->>'maritalStatus'), ''), nullif(trim(p_payload->>'nationality'), ''),
    coalesce((p_payload->>'isSaResident')::boolean, true), nullif(trim(p_payload->>'passportNumber'), ''),
    nullif(trim(p_payload->>'passportCountry'), ''), nullif(trim(p_payload->>'representativeName'), ''),
    nullif(trim(p_payload->>'representativeCapacity'), ''), nullif(trim(p_payload->>'beneficialOwnerDetails'), ''),
    nullif(trim(p_payload->>'sourceOfFunds'), ''), case when v_start_fica then now() end,
    case when v_start_fica then coalesce(nullif(p_payload->>'riskRating', ''), 'medium') end,
    case when v_start_fica then now() end,
    coalesce((p_payload->>'isProminentPerson')::boolean, false),
    case when v_start_fica then 'partial'::public.fica_status else 'not_started'::public.fica_status end
  ) returning id into v_party_id;

  insert into public.audit_log(agency_id, actor_id, entity_type, entity_id, action, after_json)
  values (
    v_agency_id, v_actor_id, 'party', v_party_id, 'create',
    jsonb_build_object(
      'roles', to_jsonb(v_roles), 'entity_type', v_entity_type,
      'fica_started', v_start_fica, 'marketing_consent', v_marketing_consent,
      'assigned_to', v_assigned_to, 'capture_version', 2
    )
  );

  return v_party_id;
end;
$function$;

create or replace function public.create_deal (
  p_payload jsonb
)
  returns uuid
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
  AS $function$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_actor_id uuid := public.get_current_user_account_id();
  v_source_mandate_id uuid := nullif(p_payload->>'sourceMandateId', '')::uuid;
  v_source_mandate public.mandate%rowtype;
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
      and role in ('agent', 'admin', 'admin_agent')
  ) then
    raise exception 'The selected lead practitioner is not an active agency practitioner.';
  end if;

  if v_source_mandate_id is not null then
    select * into v_source_mandate from public.mandate
    where id = v_source_mandate_id and agency_id = v_agency_id;
    if v_source_mandate.id is null then
      raise exception 'The source mandate could not be found in this agency.';
    end if;
  end if;

  if v_source_mandate.id is not null then
    v_property_id := v_source_mandate.property_id;
    update public.property set
      address_line = trim(p_payload->>'address'), suburb = trim(p_payload->>'suburb'),
      city = trim(p_payload->>'city'), province = p_payload->>'province',
      postal_code = p_payload->>'postalCode', erf_number = p_payload->>'erfNumber',
      title_deed_number = trim(p_payload->>'titleDeedNumber'),
      property_type = (p_payload->>'propertyType')::public.property_type,
      is_sectional_title = coalesce((p_payload->>'isSectionalTitle')::boolean, false),
      bedrooms = coalesce((p_payload->>'bedrooms')::int, 0),
      bathrooms = coalesce((p_payload->>'bathrooms')::int, 0),
      garages = coalesce((p_payload->>'garages')::int, 0),
      erf_size_sqm = coalesce((p_payload->>'erfSizeSqm')::numeric, 0),
      floor_size_sqm = coalesce((p_payload->>'floorSizeSqm')::numeric, 0),
      legal_description = trim(p_payload->>'legalDescription'),
      deeds_office = nullif(trim(p_payload->>'deedsOffice'), ''),
      property_use = nullif(trim(p_payload->>'propertyUse'), ''),
      is_improved = coalesce((p_payload->>'isImproved')::boolean, true),
      seller_acquired_on = nullif(p_payload->>'sellerAcquiredOn', '')::date,
      seller_original_purchase_price_cents = nullif(p_payload->>'sellerOriginalPurchasePriceCents', '')::bigint
    where id = v_property_id;
  else
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
  end if;

  if v_source_mandate.id is not null then
    v_mandate_id := v_source_mandate.id;
    update public.mandate set
      mandate_type = (p_payload->>'mandateType')::public.mandate_type,
      listing_price_cents = (p_payload->>'listingPriceCents')::bigint,
      commission_rate_bps = (p_payload->>'commissionRateBps')::int,
      signed_on = (p_payload->>'mandateSignedOn')::date,
      expires_on = (p_payload->>'mandateExpiresOn')::date,
      status = 'active'
    where id = v_mandate_id;
  else
    insert into public.mandate (
      agency_id, property_id, mandate_type, listing_price_cents,
      commission_rate_bps, signed_on, expires_on, status
    ) values (
      v_agency_id, v_property_id, (p_payload->>'mandateType')::public.mandate_type,
      (p_payload->>'listingPriceCents')::bigint, (p_payload->>'commissionRateBps')::int,
      (p_payload->>'mandateSignedOn')::date, (p_payload->>'mandateExpiresOn')::date, 'active'
    ) returning id into v_mandate_id;
  end if;

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
      'purchaser_count', v_purchaser_count, 'capture_version', 2,
      'source_mandate_id', v_source_mandate_id
    )
  );

  return v_deal_id;
end;
$function$;

create or replace function public.create_mandate (
  p_payload jsonb
)
  returns uuid
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
  AS $function$
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
      and role in ('agent', 'admin', 'admin_agent')
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
$function$;

create or replace function public.create_user_invitation (
  p_email          text,
  p_role           public.user_role       default 'agent'::public.user_role,
  p_seniority      public.agent_seniority default 'junior'::public.agent_seniority,
  p_property24_url text                   default null::text
)
  returns text
  language plpgsql
  security definer
  set search_path to 'public', 'extensions', 'pg_temp'
  AS $function$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_agency_id uuid := public.get_current_agency_id();
  v_user_account_id uuid := public.get_current_user_account_id();
  v_role public.user_role := public.get_current_role();
  v_p24 text := nullif(trim(coalesce(p_property24_url, '')), '');
begin
  if not public.check_rate_limit('create_user_invitation:' || lower(trim(p_email)), 10, interval '1 hour') then
    raise exception 'Too many invitation attempts for this address. Please try again later.';
  end if;

  if p_role not in ('agent', 'admin', 'admin_agent') then
    raise exception 'Invalid role for invitation.';
  end if;

  if v_user_account_id is not null and v_role not in ('admin', 'admin_agent') then
    raise exception 'Only managers can invite users.';
  end if;

  if v_p24 is not null
     and v_p24 !~ '^https://(www\.)?property24\.com/estate-agents/[^/]+/[^/]+/\d+$' then
    raise exception 'Property24 URL must look like https://www.property24.com/estate-agents/{agency}/{agent}/{id}.';
  end if;

  if v_agency_id is null then
    select id into v_agency_id from public.agency limit 1;
  end if;

  if v_agency_id is null then
    insert into public.agency (name)
    values ('Dream Supreme Properties')
    returning id into v_agency_id;
  end if;

  delete from public.user_invitation
    where email = lower(trim(p_email)) and accepted_at is null;

  insert into public.user_invitation(agency_id, email, role, seniority, property24_url, token_hash, invited_by)
  values (
    v_agency_id, lower(trim(p_email)), p_role, p_seniority, v_p24,
    encode(digest(v_token, 'sha256'), 'hex'), v_user_account_id
  );
  return v_token;
end;
$function$;

create or replace function public.is_manager()
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public', 'pg_temp'
  AS $function$
  select exists (
    select 1 from public.user_account
    where auth_user_id = auth.uid()
      and status = 'active'
      and role::text in ('admin', 'admin_agent', 'admin & agent')
  );
$function$;

create or replace function public.notify_agency_admins()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
  AS $function$
declare
  v_deal_id uuid;
  v_agency_id uuid;
  v_deal_ref text;
  v_property_address text;
  v_subject text;
  v_body text;
  v_link text;
  v_admin_record record;
  v_event_type text := 'deal_update';
begin
  if TG_TABLE_NAME = 'deal' then
    v_deal_id := NEW.id;
    v_agency_id := NEW.agency_id;
    v_deal_ref := NEW.reference;
    v_link := '/deals/' || v_deal_id;

    select address_line into v_property_address from public.property where id = NEW.property_id;

    if NEW.stage = 'registered' and (OLD is null or OLD.stage <> 'registered') then
      v_subject := '🎉 Deal Registered & Closed: ' || coalesce(v_deal_ref, 'Ref Pending');
      v_body := 'Deal for property at ' || coalesce(v_property_address, 'Property') ||
                ' has been registered and closed. Final sale price: R' ||
                to_char(coalesce(NEW.sale_price_cents, 0) / 100.0, 'FM999,999,990.00');

    elsif NEW.status = 'cancelled' and (OLD is null or OLD.status <> 'cancelled') then
      v_subject := '🚨 Deal Cancelled: ' || coalesce(v_deal_ref, 'Ref Pending');
      v_body := 'Deal at ' || coalesce(v_property_address, 'Property') ||
                ' was cancelled. Reason: ' || coalesce(NEW.cancellation_reason::text, 'Not specified') ||
                case when NEW.cancellation_notes is not null then '. Notes: ' || NEW.cancellation_notes else '' end;

    elsif OLD is not null and OLD.stage <> NEW.stage then
      v_subject := '📈 Deal Stage Updated: ' || coalesce(v_deal_ref, 'Ref Pending');
      v_body := 'Deal at ' || coalesce(v_property_address, 'Property') ||
                ' advanced from ' || OLD.stage || ' to ' || NEW.stage || '.';
    else
      return NEW;
    end if;

  elsif TG_TABLE_NAME = 'audit_log' then
    if NEW.entity_type <> 'deal' then return NEW; end if;
    v_deal_id := NEW.entity_id;
    v_agency_id := NEW.agency_id;
    v_link := '/deals/' || v_deal_id;

    select reference into v_deal_ref from public.deal where id = v_deal_id;

    if NEW.action = 'progress_note_added' then
      v_subject := '📝 Progress Note Added: ' || coalesce(v_deal_ref, 'Deal');
      v_body := 'An operational update note was logged: "' ||
                coalesce(NEW.after_json->>'note', 'Note added') || '"';
    else
      return NEW;
    end if;
  end if;

  -- Broadcast notification to all admins in the agency
  for v_admin_record in
    select id, email
    from public.user_account
    where agency_id = v_agency_id
      and role in ('admin', 'admin_agent')
  loop
    -- In-app notification
    insert into public.notification (
      agency_id,
      user_id,
      user_account_id,
      type,
      subject,
      body,
      link,
      created_at
    ) values (
      v_agency_id,
      v_admin_record.id,
      v_admin_record.id,
      v_event_type,
      v_subject,
      v_body,
      v_link,
      now()
    );

    -- Email Queue Entry
    insert into public.email_queue (
      agency_id,
      recipient_email,
      subject,
      body_html,
      status,
      created_at
    ) values (
      v_agency_id,
      v_admin_record.email,
      v_subject,
      '<div style="font-family: sans-serif; padding: 16px;">' ||
      '<h2>' || v_subject || '</h2>' ||
      '<p>' || v_body || '</p>' ||
      '<p><a href="' || v_link || '" style="color: #2563eb; font-weight: bold;">View Deal Details</a></p>' ||
      '</div>',
      'pending',
      now()
    );
  end loop;

  return NEW;
end;
$function$;

create or replace function public.prevent_hard_delete()
  returns trigger
  language plpgsql
  set search_path to 'public'
  AS $function$
begin
  raise exception 'Hard deletes are disabled. Archive the record instead.' using errcode = 'P0001';
end;
$function$;

create or replace function public.process_monthly_section_86_4_interest_allocation (
  p_agency_id   uuid default null::uuid,
  p_period_date date default CURRENT_DATE
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
  AS $function$
declare
  v_rec record;
  v_processed_count integer := 0;
  v_total_gross_cents bigint := 0;
  v_total_client_cents bigint := 0;
  v_total_ppra_cents bigint := 0;
  v_client_interest_cents bigint;
  v_ppra_levy_cents bigint;
  v_ref_number text;
  v_principal_id uuid;
begin
  for v_rec in (
    select
      t.agency_id,
      t.deal_id,
      t.lease_id,
      sum(case when t.transaction_type = 'deposit_inflow' then t.amount_cents else 0 end) -
      sum(case when t.transaction_type = 'refund_outflow' then t.amount_cents else 0 end) as net_balance_cents,
      coalesce(avg(t.interest_split_client_pct), 95.00) as client_pct,
      coalesce(avg(t.interest_split_ppra_pct), 5.00) as ppra_pct
    from public.trust_account_ledger t
    where t.account_type = 'section_86_4_investment'
      and (p_agency_id is null or t.agency_id = p_agency_id)
    group by t.agency_id, t.deal_id, t.lease_id
    having (
      sum(case when t.transaction_type = 'deposit_inflow' then t.amount_cents else 0 end) -
      sum(case when t.transaction_type = 'refund_outflow' then t.amount_cents else 0 end)
    ) > 0
  ) loop
    -- Find a designated agency administrator for approval attribution
    select id into v_principal_id
    from public.user_account
    where agency_id = v_rec.agency_id and role in ('admin', 'admin_agent')
    limit 1;

    v_client_interest_cents := round(v_rec.net_balance_cents * (v_rec.client_pct / 100.0) * 0.005);
    v_ppra_levy_cents := round(v_rec.net_balance_cents * (v_rec.ppra_pct / 100.0) * 0.005);

    if v_client_interest_cents > 0 then
      v_ref_number := 'INT-' || to_char(p_period_date, 'YYYYMM') || '-' || substring(gen_random_uuid()::text from 1 for 8);

      insert into public.trust_account_ledger (
        agency_id, deal_id, lease_id, account_type, transaction_type,
        amount_cents, reference_number, bank_statement_date, payer_payee_name,
        interest_split_client_pct, interest_split_ppra_pct,
        approved_by_principal, approved_at
      ) values (
        v_rec.agency_id, v_rec.deal_id, v_rec.lease_id, 'section_86_4_investment', 'interest_credit',
        v_client_interest_cents, v_ref_number || '-CLI', p_period_date, 'Client Statutory Interest (95%)',
        v_rec.client_pct, v_rec.ppra_pct,
        v_principal_id, now()
      );

      if v_ppra_levy_cents > 0 then
        insert into public.trust_account_ledger (
          agency_id, deal_id, lease_id, account_type, transaction_type,
          amount_cents, reference_number, bank_statement_date, payer_payee_name,
          interest_split_client_pct, interest_split_ppra_pct,
          approved_by_principal, approved_at
        ) values (
          v_rec.agency_id, v_rec.deal_id, v_rec.lease_id, 'section_86_4_investment', 'ppra_levy_deduction',
          v_ppra_levy_cents, v_ref_number || '-PPA', p_period_date, 'PPRA Statutory Levy (5%)',
          v_rec.client_pct, v_rec.ppra_pct,
          v_principal_id, now()
        );
      end if;

      insert into public.audit_log (
        agency_id, actor_id, entity_type, entity_id, action, after_json
      ) values (
        v_rec.agency_id, v_principal_id, 'trust_account_ledger', gen_random_uuid(), 'create',
        jsonb_build_object(
          'type', 'monthly_interest_allocation',
          'period', to_char(p_period_date, 'YYYY-MM'),
          'client_interest_cents', v_client_interest_cents,
          'ppra_levy_cents', v_ppra_levy_cents
        )
      );

      if v_principal_id is not null then
        insert into public.notification (
          agency_id, user_id, type, link
        ) values (
          v_rec.agency_id, v_principal_id, 'system', '/trust'
        );
      end if;

      v_processed_count := v_processed_count + 1;
      v_total_client_cents := v_total_client_cents + v_client_interest_cents;
      v_total_ppra_cents := v_total_ppra_cents + v_ppra_levy_cents;
      v_total_gross_cents := v_total_gross_cents + (v_client_interest_cents + v_ppra_levy_cents);
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'period', to_char(p_period_date, 'YYYY-MM'),
    'accounts_processed', v_processed_count,
    'total_gross_interest_cents', v_total_gross_cents,
    'total_client_interest_cents', v_total_client_cents,
    'total_ppra_levy_cents', v_total_ppra_cents
  );
end;
$function$;

create or replace function public.protect_user_account_sensitive_fields()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
  AS $function$
declare
  v_caller_role text;
begin
  if coalesce(current_setting('app.admin_override', true), '') = 'true'
     or coalesce(current_setting('app.workflow_change', true), '') = 'allowed'
     or current_setting('role', true) in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  v_caller_role := lower(coalesce(public.get_current_user_role(), ''));

  if v_caller_role like '%admin%' or public.is_manager() then
    return new;
  end if;

  if new.role is distinct from old.role or
     new.status is distinct from old.status or
     new.agency_id is distinct from old.agency_id or
     new.commission_pct is distinct from old.commission_pct or
     new.auth_user_id is distinct from old.auth_user_id then
       raise exception 'You do not have permission to modify restricted fields.';
  end if;

  return new;
end;
$function$;

create or replace function public.record_trust_transaction (
  p_deal_id                   uuid                          default null::uuid,
  p_lease_id                  uuid                          default null::uuid,
  p_account_type              public.trust_account_type     default 'section_86_4_investment'::public.trust_account_type,
  p_transaction_type          public.trust_transaction_type default 'deposit_inflow'::public.trust_transaction_type,
  p_amount_cents              bigint                        default 0,
  p_reference_number          text                          default ''::text,
  p_bank_statement_date       date                          default CURRENT_DATE,
  p_payer_payee_name          text                          default ''::text,
  p_interest_split_client_pct numeric                       default 95.00,
  p_interest_split_ppra_pct   numeric                       default 5.00
)
  returns uuid
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
  AS $function$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_actor_id uuid := public.get_current_user_account_id();
  v_role public.user_role := public.get_current_role();
  v_ledger_id uuid;
begin
  if v_agency_id is null or v_actor_id is null then
    raise exception 'An active authenticated user session is required.';
  end if;

  if v_role not in ('admin', 'admin_agent') then
    raise exception 'Only an administrator can authorize trust account transactions.';
  end if;

  if p_amount_cents <= 0 then
    raise exception 'Trust transaction amount must be greater than zero.';
  end if;

  if nullif(trim(p_reference_number), '') is null or nullif(trim(p_payer_payee_name), '') is null then
    raise exception 'Reference number and payer/payee details are required.';
  end if;

  -- Single-Principal Approval & Insertion
  insert into public.trust_account_ledger (
    agency_id, deal_id, lease_id, account_type, transaction_type,
    amount_cents, reference_number, bank_statement_date, payer_payee_name,
    interest_split_client_pct, interest_split_ppra_pct,
    approved_by_principal, approved_at
  ) values (
    v_agency_id, p_deal_id, p_lease_id, p_account_type, p_transaction_type,
    p_amount_cents, trim(p_reference_number), p_bank_statement_date, trim(p_payer_payee_name),
    p_interest_split_client_pct, p_interest_split_ppra_pct,
    v_actor_id, now()
  ) returning id into v_ledger_id;

  -- Automated Audit Logging
  insert into public.audit_log (
    agency_id, actor_id, entity_type, entity_id, action, after_json
  ) values (
    v_agency_id, v_actor_id, 'trust_account_ledger', v_ledger_id, 'create',
    jsonb_build_object(
      'summary', 'Single-Principal Trust Transaction Approved',
      'account_type', p_account_type,
      'transaction_type', p_transaction_type,
      'amount_cents', p_amount_cents,
      'reference_number', p_reference_number,
      'payer_payee', p_payer_payee_name,
      'approved_by_principal', v_actor_id,
      'approved_at', now()
    )
  );

  return v_ledger_id;
end;
$function$;

create or replace function public.review_compliance_item (
  p_checklist_id    uuid,
  p_status          text,
  p_rejection_notes text default null::text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
  AS $function$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_actor_id uuid := public.get_current_user_account_id();
  v_role public.user_role := public.get_current_role();
begin
  if v_agency_id is null or v_actor_id is null then
    raise exception 'An active authenticated session is required.';
  end if;

  if v_role not in ('admin', 'admin_agent') then
    raise exception 'Only an administrator can perform compliance reviews.';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Status must be approved or rejected.';
  end if;

  update public.compliance_review_queue
  set status = p_status,
      rejection_notes = p_rejection_notes,
      reviewed_by = v_actor_id,
      reviewed_at = now()
  where id = p_checklist_id and agency_id = v_agency_id;

  return jsonb_build_object('success', true, 'checklist_id', p_checklist_id, 'status', p_status);
end;
$function$;

create or replace function public.run_daily_sweeps()
  returns integer
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
  AS $function$
declare
  v_count integer := 0;
  v_inserted integer := 0;
begin
  insert into public.notification(agency_id, user_account_id, channel, subject, body, related_entity_type, related_entity_id, scheduled_for)
  select distinct d.agency_id, recipient.id, 'in_app',
    case when c.due_on < current_date then 'Condition overdue' else 'Condition deadline approaching' end,
    d.reference || ': ' || coalesce(c.description, c.condition_type::text) || ' is due ' || to_char(c.due_on, 'DD Mon YYYY'),
    'suspensive_condition', c.id, now()
  from public.suspensive_condition c
  join public.deal d on d.id = c.deal_id
  join public.user_account recipient on recipient.agency_id = d.agency_id and recipient.status = 'active'
  where c.status in ('pending', 'extended')
    and (c.due_on - current_date in (14, 7, 3, 1) or c.due_on < current_date)
    and (recipient.role in ('admin', 'admin_agent') or exists (
      select 1 from public.deal_participant dp where dp.deal_id = d.id and dp.user_account_id = recipient.id
    ))
    and not exists (
      select 1 from public.notification n where n.user_account_id = recipient.id
        and n.related_entity_id = c.id and n.subject = case when c.due_on < current_date then 'Condition overdue' else 'Condition deadline approaching' end
        and n.created_at >= current_date
    );
  get diagnostics v_count = row_count;

  insert into public.notification(agency_id, user_account_id, channel, subject, body, related_entity_type, related_entity_id, scheduled_for)
  select distinct d.agency_id, recipient.id, 'in_app',
    case when m.expires_on < current_date then 'Mandate expired' else 'Mandate expiry approaching' end,
    d.reference || ': mandate expires ' || to_char(m.expires_on, 'DD Mon YYYY'),
    'mandate', m.id, now()
  from public.mandate m
  join public.deal d on d.mandate_id = m.id and d.status = 'active'
  join public.user_account recipient on recipient.agency_id = d.agency_id and recipient.status = 'active'
  where m.status = 'active'
    and (m.expires_on - current_date in (30, 14, 7, 3, 1) or m.expires_on < current_date)
    and (recipient.role in ('admin', 'admin_agent') or exists (
      select 1 from public.deal_participant dp where dp.deal_id = d.id and dp.user_account_id = recipient.id
    ))
    and not exists (
      select 1 from public.notification n where n.user_account_id = recipient.id
        and n.related_entity_id = m.id
        and n.subject = case when m.expires_on < current_date then 'Mandate expired' else 'Mandate expiry approaching' end
        and n.created_at >= current_date
    );
  get diagnostics v_inserted = row_count;
  v_count := v_count + v_inserted;

  insert into public.notification(agency_id, user_account_id, channel, subject, body, related_entity_type, related_entity_id, scheduled_for)
  select u.agency_id, recipient.id, 'in_app',
    case when f.expires_on < current_date then 'FFC expired' else 'FFC expiry approaching' end,
    u.full_name || ': FFC ' || f.certificate_number || ' expires ' || to_char(f.expires_on, 'DD Mon YYYY'),
    'ffc_certificate', f.id, now()
  from public.ffc_certificate f
  join public.user_account u on u.id = f.user_account_id and u.status = 'active'
  join public.user_account recipient on recipient.agency_id = u.agency_id and recipient.status = 'active'
  where (f.expires_on - current_date in (60, 30, 14, 7, 3, 1) or f.expires_on < current_date)
    and (recipient.id = u.id or recipient.role in ('admin', 'admin_agent'))
    and not exists (
      select 1 from public.notification n where n.user_account_id = recipient.id
        and n.related_entity_id = f.id
        and n.subject = case when f.expires_on < current_date then 'FFC expired' else 'FFC expiry approaching' end
        and n.created_at >= current_date
    );
  get diagnostics v_inserted = row_count;
  v_count := v_count + v_inserted;
  return v_count;
end;
$function$;

revoke all on function "public"."accept_user_invitation"(text, text, text, text) from "service_role";

grant execute on function "public"."accept_user_invitation"(text, text, text, text) to "service_role";

revoke all on function "public"."adjust_user_storage_usage"(uuid, bigint) from "anon";

grant execute on function "public"."adjust_user_storage_usage"(uuid, bigint) to "anon";

revoke all on function "public"."adjust_user_storage_usage"(uuid, bigint) from "service_role";

grant execute on function "public"."adjust_user_storage_usage"(uuid, bigint) to "service_role";

revoke all on function "public"."admin_archive_old_deals"(uuid) from "service_role";

grant execute on function "public"."admin_archive_old_deals"(uuid) to "service_role";

revoke all on function "public"."admin_bulk_reset_commission"(uuid[]) from "service_role";

grant execute on function "public"."admin_bulk_reset_commission"(uuid[]) to "service_role";

revoke all on function "public"."admin_bulk_retire_users"(uuid[]) from "service_role";

grant execute on function "public"."admin_bulk_retire_users"(uuid[]) to "service_role";

revoke all on function "public"."admin_deactivate_idle_agents"(uuid) from "service_role";

grant execute on function "public"."admin_deactivate_idle_agents"(uuid) to "service_role";

revoke all on function "public"."admin_empty_recycle_bin"(uuid) from "service_role";

grant execute on function "public"."admin_empty_recycle_bin"(uuid) to "service_role";

revoke all on function "public"."approve_maintenance_work_order"(uuid, bigint) from "anon";

grant execute on function "public"."approve_maintenance_work_order"(uuid, bigint) to "anon";

revoke all on function "public"."approve_maintenance_work_order"(uuid, bigint) from "authenticated";

grant execute on function "public"."approve_maintenance_work_order"(uuid, bigint) to "authenticated";

revoke all on function "public"."approve_maintenance_work_order"(uuid, bigint) from "service_role";

grant execute on function "public"."approve_maintenance_work_order"(uuid, bigint) to "service_role";

revoke all on function "public"."assign_lead_round_robin"(uuid) from "anon";

grant execute on function "public"."assign_lead_round_robin"(uuid) to "anon";

revoke all on function "public"."assign_lead_round_robin"(uuid) from "authenticated";

grant execute on function "public"."assign_lead_round_robin"(uuid) to "authenticated";

revoke all on function "public"."assign_lead_round_robin"(uuid) from "service_role";

grant execute on function "public"."assign_lead_round_robin"(uuid) to "service_role";

revoke all on function "public"."calculate_deal_commission"(uuid, uuid) from "service_role";

grant execute on function "public"."calculate_deal_commission"(uuid, uuid) to "service_role";

revoke all on function "public"."calculate_deal_commission"(uuid, uuid, boolean) from "service_role";

grant execute on function "public"."calculate_deal_commission"(uuid, uuid, boolean) to "service_role";

revoke all on function "public"."can_access_deal"(uuid) from "anon";

grant execute on function "public"."can_access_deal"(uuid) to "anon";

revoke all on function "public"."can_access_deal"(uuid) from "authenticated";

grant execute on function "public"."can_access_deal"(uuid) to "authenticated";

revoke all on function "public"."can_access_deal"(uuid) from "service_role";

grant execute on function "public"."can_access_deal"(uuid) to "service_role";

revoke all on function "public"."can_edit_lease"(uuid) from "anon";

grant execute on function "public"."can_edit_lease"(uuid) to "anon";

revoke all on function "public"."can_edit_lease"(uuid) from "authenticated";

grant execute on function "public"."can_edit_lease"(uuid) to "authenticated";

revoke all on function "public"."can_edit_lease"(uuid) from "service_role";

grant execute on function "public"."can_edit_lease"(uuid) to "service_role";

revoke all on function "public"."cancel_deal"(uuid, public.cancellation_reason, text) from "service_role";

grant execute on function "public"."cancel_deal"(uuid, public.cancellation_reason, text) to "service_role";

revoke all on function "public"."check_rate_limit"(text, integer, interval) from "service_role";

grant execute on function "public"."check_rate_limit"(text, integer, interval) to "service_role";

revoke all on function "public"."create_client"(jsonb) from "service_role";

grant execute on function "public"."create_client"(jsonb) to "service_role";

revoke all on function "public"."create_deal"(jsonb) from "service_role";

grant execute on function "public"."create_deal"(jsonb) to "service_role";

revoke all
  on function
    "public"."create_deal_full"(text, text, text, public.property_type, smallint, smallint, smallint, numeric, numeric, public.mandate_type, bigint, integer, text, text, text,
    public.fica_status, text, text, text, public.fica_status, bigint, date, date, text, uuid, bigint, date, date)
  from "anon";

grant execute
  on function
    "public"."create_deal_full"(text, text, text, public.property_type, smallint, smallint, smallint, numeric, numeric, public.mandate_type, bigint, integer, text, text, text,
    public.fica_status, text, text, text, public.fica_status, bigint, date, date, text, uuid, bigint, date, date)
  to "anon";

revoke all
  on function
    "public"."create_deal_full"(text, text, text, public.property_type, smallint, smallint, smallint, numeric, numeric, public.mandate_type, bigint, integer, text, text, text,
    public.fica_status, text, text, text, public.fica_status, bigint, date, date, text, uuid, bigint, date, date)
  from "authenticated";

grant execute
  on function
    "public"."create_deal_full"(text, text, text, public.property_type, smallint, smallint, smallint, numeric, numeric, public.mandate_type, bigint, integer, text, text, text,
    public.fica_status, text, text, text, public.fica_status, bigint, date, date, text, uuid, bigint, date, date)
  to "authenticated";

revoke all
  on function
    "public"."create_deal_full"(text, text, text, public.property_type, smallint, smallint, smallint, numeric, numeric, public.mandate_type, bigint, integer, text, text, text,
    public.fica_status, text, text, text, public.fica_status, bigint, date, date, text, uuid, bigint, date, date)
  from "service_role";

grant execute
  on function
    "public"."create_deal_full"(text, text, text, public.property_type, smallint, smallint, smallint, numeric, numeric, public.mandate_type, bigint, integer, text, text, text,
    public.fica_status, text, text, text, public.fica_status, bigint, date, date, text, uuid, bigint, date, date)
  to "service_role";

revoke all
  on function
    "public"."create_deal_full"(text, text, text, text, integer, integer, integer, numeric, numeric, text, bigint, integer, text, text, text, text, text, text, text, text, bigint,
    date, date, text, text, bigint, date, date)
  from "anon";

grant execute
  on function
    "public"."create_deal_full"(text, text, text, text, integer, integer, integer, numeric, numeric, text, bigint, integer, text, text, text, text, text, text, text, text, bigint,
    date, date, text, text, bigint, date, date)
  to "anon";

revoke all
  on function
    "public"."create_deal_full"(text, text, text, text, integer, integer, integer, numeric, numeric, text, bigint, integer, text, text, text, text, text, text, text, text, bigint,
    date, date, text, text, bigint, date, date)
  from "authenticated";

grant execute
  on function
    "public"."create_deal_full"(text, text, text, text, integer, integer, integer, numeric, numeric, text, bigint, integer, text, text, text, text, text, text, text, text, bigint,
    date, date, text, text, bigint, date, date)
  to "authenticated";

revoke all
  on function
    "public"."create_deal_full"(text, text, text, text, integer, integer, integer, numeric, numeric, text, bigint, integer, text, text, text, text, text, text, text, text, bigint,
    date, date, text, text, bigint, date, date)
  from "service_role";

grant execute
  on function
    "public"."create_deal_full"(text, text, text, text, integer, integer, integer, numeric, numeric, text, bigint, integer, text, text, text, text, text, text, text, text, bigint,
    date, date, text, text, bigint, date, date)
  to "service_role";

revoke all on function "public"."create_esign_envelope_recipient"(uuid, text, text, integer) from "service_role";

grant execute on function "public"."create_esign_envelope_recipient"(uuid, text, text, integer) to "service_role";

revoke all on function "public"."create_lease_onboarding"(jsonb) from "service_role";

grant execute on function "public"."create_lease_onboarding"(jsonb) to "service_role";

revoke all on function "public"."create_mandate"(jsonb) from "service_role";

grant execute on function "public"."create_mandate"(jsonb) to "service_role";

revoke all on function "public"."create_status_request"(uuid, text, integer) from "service_role";

grant execute on function "public"."create_status_request"(uuid, text, integer) to "service_role";

revoke all on function "public"."decline_esign_envelope"(text, text) from "service_role";

grant execute on function "public"."decline_esign_envelope"(text, text) to "service_role";

revoke all on function "public"."enforce_deal_workflow"() from "anon";

grant execute on function "public"."enforce_deal_workflow"() to "anon";

revoke all on function "public"."enforce_deal_workflow"() from "authenticated";

grant execute on function "public"."enforce_deal_workflow"() to "authenticated";

revoke all on function "public"."enforce_deal_workflow"() from "service_role";

grant execute on function "public"."enforce_deal_workflow"() to "service_role";

revoke all on function "public"."generate_daily_notification_digests"() from "authenticated";

grant execute on function "public"."generate_daily_notification_digests"() to "authenticated";

revoke all on function "public"."generate_daily_notification_digests"() from "service_role";

grant execute on function "public"."generate_daily_notification_digests"() to "service_role";

revoke all on function "public"."generate_document_from_template"(uuid, uuid, uuid) from "service_role";

grant execute on function "public"."generate_document_from_template"(uuid, uuid, uuid) to "service_role";

revoke all on function "public"."get_current_agency_id"() from "anon";

grant execute on function "public"."get_current_agency_id"() to "anon";

revoke all on function "public"."get_current_agency_id"() from "authenticated";

grant execute on function "public"."get_current_agency_id"() to "authenticated";

revoke all on function "public"."get_current_agency_id"() from "service_role";

grant execute on function "public"."get_current_agency_id"() to "service_role";

revoke all on function "public"."get_current_role"() from "anon";

grant execute on function "public"."get_current_role"() to "anon";

revoke all on function "public"."get_current_role"() from "authenticated";

grant execute on function "public"."get_current_role"() to "authenticated";

revoke all on function "public"."get_current_role"() from "service_role";

grant execute on function "public"."get_current_role"() to "service_role";

revoke all on function "public"."get_current_transfer_duty_brackets"() from "service_role";

grant execute on function "public"."get_current_transfer_duty_brackets"() to "service_role";

revoke all on function "public"."get_current_user_account_id"() from "anon";

grant execute on function "public"."get_current_user_account_id"() to "anon";

revoke all on function "public"."get_current_user_account_id"() from "authenticated";

grant execute on function "public"."get_current_user_account_id"() to "authenticated";

revoke all on function "public"."get_current_user_account_id"() from "service_role";

grant execute on function "public"."get_current_user_account_id"() to "service_role";

revoke all on function "public"."get_current_user_role"() from "anon";

grant execute on function "public"."get_current_user_role"() to "anon";

revoke all on function "public"."get_current_user_role"() from "authenticated";

grant execute on function "public"."get_current_user_role"() to "authenticated";

revoke all on function "public"."get_current_user_role"() from "service_role";

grant execute on function "public"."get_current_user_role"() to "service_role";

revoke all on function "public"."get_esign_envelope_for_signing"(text, text) from "service_role";

grant execute on function "public"."get_esign_envelope_for_signing"(text, text) to "service_role";

revoke all on function "public"."get_status_request"(text) from "service_role";

grant execute on function "public"."get_status_request"(text) to "service_role";

revoke all on function "public"."get_vat_rate"() from "anon";

grant execute on function "public"."get_vat_rate"() to "anon";

revoke all on function "public"."get_vat_rate"() from "authenticated";

grant execute on function "public"."get_vat_rate"() to "authenticated";

revoke all on function "public"."get_vat_rate"() from "service_role";

grant execute on function "public"."get_vat_rate"() to "service_role";

revoke all on function "public"."is_manager"() from "anon";

grant execute on function "public"."is_manager"() to "anon";

revoke all on function "public"."is_manager"() from "authenticated";

grant execute on function "public"."is_manager"() to "authenticated";

revoke all on function "public"."is_manager"() from "service_role";

grant execute on function "public"."is_manager"() to "service_role";

revoke all on function "public"."log_audit_event"(text, uuid, text, text, jsonb) from "anon";

grant execute on function "public"."log_audit_event"(text, uuid, text, text, jsonb) to "anon";

revoke all on function "public"."log_audit_event"(text, uuid, text, text, jsonb) from "authenticated";

grant execute on function "public"."log_audit_event"(text, uuid, text, text, jsonb) to "authenticated";

revoke all on function "public"."log_audit_event"(text, uuid, text, text, jsonb) from "service_role";

grant execute on function "public"."log_audit_event"(text, uuid, text, text, jsonb) to "service_role";

revoke all on function "public"."notify_agency_admins"() from "anon";

grant execute on function "public"."notify_agency_admins"() to "anon";

revoke all on function "public"."notify_agency_admins"() from "authenticated";

grant execute on function "public"."notify_agency_admins"() to "authenticated";

revoke all on function "public"."notify_agency_admins"() from "service_role";

grant execute on function "public"."notify_agency_admins"() to "service_role";

revoke all on function "public"."popia_erase_party_data"(uuid) from "service_role";

grant execute on function "public"."popia_erase_party_data"(uuid) to "service_role";

revoke all on function "public"."popia_export_party_data"(uuid) from "service_role";

grant execute on function "public"."popia_export_party_data"(uuid) to "service_role";

revoke all on function "public"."popia_lookup_party"(text) from "service_role";

grant execute on function "public"."popia_lookup_party"(text) to "service_role";

revoke all on function "public"."prepare_invited_registration"(text, text) from "service_role";

grant execute on function "public"."prepare_invited_registration"(text, text) to "service_role";

revoke all on function "public"."prevent_hard_delete"() from "anon";

grant execute on function "public"."prevent_hard_delete"() to "anon";

revoke all on function "public"."prevent_hard_delete"() from "authenticated";

grant execute on function "public"."prevent_hard_delete"() to "authenticated";

revoke all on function "public"."prevent_hard_delete"() from "service_role";

grant execute on function "public"."prevent_hard_delete"() to "service_role";

revoke all on function "public"."process_monthly_section_86_4_interest_allocation"(uuid, date) from "authenticated";

grant execute on function "public"."process_monthly_section_86_4_interest_allocation"(uuid, date) to "authenticated";

revoke all on function "public"."process_monthly_section_86_4_interest_allocation"(uuid, date) from "service_role";

grant execute on function "public"."process_monthly_section_86_4_interest_allocation"(uuid, date) to "service_role";

revoke all on function "public"."protect_user_account_sensitive_fields"() from "anon";

grant execute on function "public"."protect_user_account_sensitive_fields"() to "anon";

revoke all on function "public"."protect_user_account_sensitive_fields"() from "authenticated";

grant execute on function "public"."protect_user_account_sensitive_fields"() to "authenticated";

revoke all on function "public"."protect_user_account_sensitive_fields"() from "service_role";

grant execute on function "public"."protect_user_account_sensitive_fields"() to "service_role";

revoke all
  on function "public"."record_trust_transaction"(uuid, uuid, public.trust_account_type, public.trust_transaction_type, bigint, text, date, text, numeric, numeric)
  from "service_role";

grant execute
  on function "public"."record_trust_transaction"(uuid, uuid, public.trust_account_type, public.trust_transaction_type, bigint, text, date, text, numeric, numeric)
  to "service_role";

revoke all on function "public"."review_compliance_item"(uuid, text, text) from "anon";

grant execute on function "public"."review_compliance_item"(uuid, text, text) to "anon";

revoke all on function "public"."review_compliance_item"(uuid, text, text) from "authenticated";

grant execute on function "public"."review_compliance_item"(uuid, text, text) to "authenticated";

revoke all on function "public"."review_compliance_item"(uuid, text, text) from "service_role";

grant execute on function "public"."review_compliance_item"(uuid, text, text) to "service_role";

revoke all on function "public"."save_commission_rule_set"(jsonb) from "service_role";

grant execute on function "public"."save_commission_rule_set"(jsonb) to "service_role";

revoke all on function "public"."set_bond_status"(uuid, public.bond_app_status, text) from "service_role";

grant execute on function "public"."set_bond_status"(uuid, public.bond_app_status, text) to "service_role";

revoke all on function "public"."set_condition_status"(uuid, public.condition_status, date, text) from "service_role";

grant execute on function "public"."set_condition_status"(uuid, public.condition_status, date, text) to "service_role";

revoke all on function "public"."submit_conveyancer_status"(text, date) from "service_role";

grant execute on function "public"."submit_conveyancer_status"(text, date) to "service_role";

revoke all on function "public"."submit_esign_signature"(text, text, text, text, text, text) from "service_role";

grant execute on function "public"."submit_esign_signature"(text, text, text, text, text, text) to "service_role";

revoke all on function "public"."submit_public_lead"(text, text, text, text, text, jsonb) from "service_role";

grant execute on function "public"."submit_public_lead"(text, text, text, text, text, jsonb) to "service_role";

revoke all on function "public"."touch_updated_at"() from "anon";

grant execute on function "public"."touch_updated_at"() to "anon";

revoke all on function "public"."touch_updated_at"() from "authenticated";

grant execute on function "public"."touch_updated_at"() to "authenticated";

revoke all on function "public"."touch_updated_at"() from "service_role";

grant execute on function "public"."touch_updated_at"() to "service_role";

revoke all on function "public"."transition_deal"(uuid, public.deal_stage, text, boolean) from "service_role";

grant execute on function "public"."transition_deal"(uuid, public.deal_stage, text, boolean) to "service_role";

revoke all on function "public"."trigger_email_queue_dispatch"() from "service_role";

grant execute on function "public"."trigger_email_queue_dispatch"() to "service_role";

revoke all on function "public"."update_user_storage_quota"(uuid, bigint) from "service_role";

grant execute on function "public"."update_user_storage_quota"(uuid, bigint) to "service_role";

revoke all on function "public"."upsert_ffc_certificate"(uuid, text, date, date, text, text, text, bigint) from "service_role";

grant execute on function "public"."upsert_ffc_certificate"(uuid, text, date, date, text, text, text, bigint) to "service_role";

revoke all on sequence "public"."deal_reference_seq" from "anon";

grant select, update, usage on sequence "public"."deal_reference_seq" to "anon";

revoke all on sequence "public"."deal_reference_seq" from "authenticated";

grant select, update, usage on sequence "public"."deal_reference_seq" to "authenticated";

revoke all on sequence "public"."deal_reference_seq" from "service_role";

grant select, update, usage on sequence "public"."deal_reference_seq" to "service_role";

revoke all on table "public"."agency" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."agency" to "anon";

revoke all on table "public"."agency" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."agency" to "authenticated";

revoke all on table "public"."agency" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."agency" to "service_role";

revoke all on table "public"."agency_system_setting" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."agency_system_setting" to "anon";

revoke all on table "public"."agency_system_setting" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."agency_system_setting" to "authenticated";

revoke all on table "public"."agency_system_setting" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."agency_system_setting" to "service_role";

revoke all on table "public"."agent_property24_listing" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."agent_property24_listing" to "anon";

revoke all on table "public"."agent_property24_listing" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."agent_property24_listing" to "authenticated";

revoke all on table "public"."audit_log" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."audit_log" to "anon";

revoke all on table "public"."audit_log" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."audit_log" to "authenticated";

revoke all on table "public"."audit_log" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."audit_log" to "service_role";

revoke all on table "public"."bond_application" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."bond_application" to "anon";

revoke all on table "public"."bond_application" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."bond_application" to "authenticated";

revoke all on table "public"."bond_application" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."bond_application" to "service_role";

revoke all on table "public"."branch" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."branch" to "anon";

revoke all on table "public"."branch" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."branch" to "authenticated";

revoke all on table "public"."branch" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."branch" to "service_role";

revoke all on table "public"."checklist_item" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."checklist_item" to "anon";

revoke all on table "public"."checklist_item" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."checklist_item" to "authenticated";

revoke all on table "public"."checklist_item" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."checklist_item" to "service_role";

revoke all on table "public"."commission_advance" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."commission_advance" to "anon";

revoke all on table "public"."commission_advance" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."commission_advance" to "authenticated";

revoke all on table "public"."commission_advance" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."commission_advance" to "service_role";

revoke all on table "public"."commission_allocation" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."commission_allocation" to "anon";

revoke all on table "public"."commission_allocation" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."commission_allocation" to "authenticated";

revoke all on table "public"."commission_allocation" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."commission_allocation" to "service_role";

revoke all on table "public"."commission_calculation" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."commission_calculation" to "anon";

revoke all on table "public"."commission_calculation" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."commission_calculation" to "authenticated";

revoke all on table "public"."commission_calculation" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."commission_calculation" to "service_role";

revoke all on table "public"."commission_clawback" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."commission_clawback" to "anon";

revoke all on table "public"."commission_clawback" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."commission_clawback" to "authenticated";

revoke all on table "public"."commission_clawback" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."commission_clawback" to "service_role";

revoke all on table "public"."commission_rule_line" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."commission_rule_line" to "anon";

revoke all on table "public"."commission_rule_line" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."commission_rule_line" to "authenticated";

revoke all on table "public"."commission_rule_line" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."commission_rule_line" to "service_role";

revoke all on table "public"."commission_rule_set" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."commission_rule_set" to "anon";

revoke all on table "public"."commission_rule_set" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."commission_rule_set" to "authenticated";

revoke all on table "public"."commission_rule_set" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."commission_rule_set" to "service_role";

revoke all on table "public"."compliance_review_queue" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."compliance_review_queue" to "anon";

revoke all on table "public"."compliance_review_queue" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."compliance_review_queue" to "authenticated";

revoke all on table "public"."compliance_review_queue" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."compliance_review_queue" to "service_role";

revoke all on table "public"."config_transfer_duty" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."config_transfer_duty" to "anon";

revoke all on table "public"."config_transfer_duty" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."config_transfer_duty" to "authenticated";

revoke all on table "public"."config_transfer_duty" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."config_transfer_duty" to "service_role";

revoke all on table "public"."contact_activity_timeline" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."contact_activity_timeline" to "anon";

revoke all on table "public"."contact_activity_timeline" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."contact_activity_timeline" to "authenticated";

revoke all on table "public"."contact_activity_timeline" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."contact_activity_timeline" to "service_role";

revoke all on table "public"."conveyancer_firm" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."conveyancer_firm" to "anon";

revoke all on table "public"."conveyancer_firm" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."conveyancer_firm" to "authenticated";

revoke all on table "public"."conveyancer_firm" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."conveyancer_firm" to "service_role";

revoke all on table "public"."conveyancing_stage_tracker" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."conveyancing_stage_tracker" to "anon";

revoke all on table "public"."conveyancing_stage_tracker" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."conveyancing_stage_tracker" to "authenticated";

revoke all on table "public"."conveyancing_stage_tracker" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."conveyancing_stage_tracker" to "service_role";

revoke all on table "public"."deal" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."deal" to "anon";

revoke all on table "public"."deal" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."deal" to "authenticated";

revoke all on table "public"."deal" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."deal" to "service_role";

revoke all on table "public"."deal_contingency_tracker" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."deal_contingency_tracker" to "anon";

revoke all on table "public"."deal_contingency_tracker" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."deal_contingency_tracker" to "authenticated";

revoke all on table "public"."deal_contingency_tracker" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."deal_contingency_tracker" to "service_role";

revoke all on table "public"."deal_participant" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."deal_participant" to "anon";

revoke all on table "public"."deal_participant" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."deal_participant" to "authenticated";

revoke all on table "public"."deal_participant" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."deal_participant" to "service_role";

revoke all on table "public"."deal_party" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."deal_party" to "anon";

revoke all on table "public"."deal_party" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."deal_party" to "authenticated";

revoke all on table "public"."deal_party" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."deal_party" to "service_role";

revoke all on table "public"."deal_stage_history" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."deal_stage_history" to "anon";

revoke all on table "public"."deal_stage_history" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."deal_stage_history" to "authenticated";

revoke all on table "public"."deal_stage_history" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."deal_stage_history" to "service_role";

revoke all on table "public"."deposit_ledger" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."deposit_ledger" to "anon";

revoke all on table "public"."deposit_ledger" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."deposit_ledger" to "authenticated";

revoke all on table "public"."deposit_ledger" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."deposit_ledger" to "service_role";

revoke all on table "public"."document" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."document" to "anon";

revoke all on table "public"."document" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."document" to "authenticated";

revoke all on table "public"."document" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."document" to "service_role";

revoke all on table "public"."document_template" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."document_template" to "anon";

revoke all on table "public"."document_template" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."document_template" to "authenticated";

revoke all on table "public"."document_template" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."document_template" to "service_role";

revoke all on table "public"."email_queue" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."email_queue" to "anon";

revoke all on table "public"."email_queue" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."email_queue" to "authenticated";

revoke all on table "public"."email_queue" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."email_queue" to "service_role";

revoke all on table "public"."esign_audit_log" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."esign_audit_log" to "anon";

revoke all on table "public"."esign_audit_log" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."esign_audit_log" to "authenticated";

revoke all on table "public"."esign_audit_log" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."esign_audit_log" to "service_role";

revoke all on table "public"."esign_envelope" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."esign_envelope" to "anon";

revoke all on table "public"."esign_envelope" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."esign_envelope" to "authenticated";

revoke all on table "public"."esign_envelope" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."esign_envelope" to "service_role";

revoke all on table "public"."esign_envelope_recipient" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."esign_envelope_recipient" to "anon";

revoke all on table "public"."esign_envelope_recipient" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."esign_envelope_recipient" to "authenticated";

revoke all on table "public"."esign_envelope_recipient" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."esign_envelope_recipient" to "service_role";

revoke all on table "public"."ffc_certificate" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."ffc_certificate" to "anon";

revoke all on table "public"."ffc_certificate" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."ffc_certificate" to "authenticated";

revoke all on table "public"."ffc_certificate" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."ffc_certificate" to "service_role";

revoke all on table "public"."inspection" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."inspection" to "anon";

revoke all on table "public"."inspection" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."inspection" to "authenticated";

revoke all on table "public"."inspection" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."inspection" to "service_role";

revoke all on table "public"."landlord_statement" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."landlord_statement" to "anon";

revoke all on table "public"."landlord_statement" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."landlord_statement" to "authenticated";

revoke all on table "public"."landlord_statement" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."landlord_statement" to "service_role";

revoke all on table "public"."lead" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."lead" to "anon";

revoke all on table "public"."lead" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."lead" to "authenticated";

revoke all on table "public"."lead" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."lead" to "service_role";

revoke all on table "public"."lead_capture" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."lead_capture" to "anon";

revoke all on table "public"."lead_capture" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."lead_capture" to "authenticated";

revoke all on table "public"."lead_capture" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."lead_capture" to "service_role";

revoke all on table "public"."lease" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."lease" to "anon";

revoke all on table "public"."lease" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."lease" to "authenticated";

revoke all on table "public"."lease" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."lease" to "service_role";

revoke all on table "public"."lease_escalation_schedule" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."lease_escalation_schedule" to "anon";

revoke all on table "public"."lease_escalation_schedule" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."lease_escalation_schedule" to "authenticated";

revoke all on table "public"."lease_escalation_schedule" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."lease_escalation_schedule" to "service_role";

revoke all on table "public"."lease_invoice" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."lease_invoice" to "anon";

revoke all on table "public"."lease_invoice" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."lease_invoice" to "authenticated";

revoke all on table "public"."lease_invoice" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."lease_invoice" to "service_role";

revoke all on table "public"."maintenance_job" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."maintenance_job" to "anon";

revoke all on table "public"."maintenance_job" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."maintenance_job" to "authenticated";

revoke all on table "public"."maintenance_job" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."maintenance_job" to "service_role";

revoke all on table "public"."maintenance_ticket" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."maintenance_ticket" to "anon";

revoke all on table "public"."maintenance_ticket" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."maintenance_ticket" to "authenticated";

revoke all on table "public"."maintenance_ticket" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."maintenance_ticket" to "service_role";

revoke all on table "public"."mandate" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."mandate" to "anon";

revoke all on table "public"."mandate" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."mandate" to "authenticated";

revoke all on table "public"."mandate" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."mandate" to "service_role";

revoke all on table "public"."notification" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."notification" to "anon";

revoke all on table "public"."notification" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."notification" to "authenticated";

revoke all on table "public"."notification" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."notification" to "service_role";

revoke all on table "public"."notification_preference" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."notification_preference" to "anon";

revoke all on table "public"."notification_preference" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."notification_preference" to "authenticated";

revoke all on table "public"."notification_preference" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."notification_preference" to "service_role";

revoke all on table "public"."offer" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."offer" to "anon";

revoke all on table "public"."offer" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."offer" to "authenticated";

revoke all on table "public"."offer" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."offer" to "service_role";

revoke all on table "public"."party" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."party" to "anon";

revoke all on table "public"."party" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."party" to "authenticated";

revoke all on table "public"."party" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."party" to "service_role";

revoke all on table "public"."property" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."property" to "anon";

revoke all on table "public"."property" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."property" to "authenticated";

revoke all on table "public"."property" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."property" to "service_role";

revoke all on table "public"."rate_limit_hit" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."rate_limit_hit" to "anon";

revoke all on table "public"."rate_limit_hit" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."rate_limit_hit" to "authenticated";

revoke all on table "public"."rate_limit_hit" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."rate_limit_hit" to "service_role";

revoke all on table "public"."signature_record" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."signature_record" to "anon";

revoke all on table "public"."signature_record" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."signature_record" to "authenticated";

revoke all on table "public"."signature_record" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."signature_record" to "service_role";

revoke all on table "public"."status_request_token" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."status_request_token" to "anon";

revoke all on table "public"."status_request_token" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."status_request_token" to "authenticated";

revoke all on table "public"."status_request_token" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."status_request_token" to "service_role";

revoke all on table "public"."suspensive_condition" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."suspensive_condition" to "anon";

revoke all on table "public"."suspensive_condition" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."suspensive_condition" to "authenticated";

revoke all on table "public"."suspensive_condition" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."suspensive_condition" to "service_role";

revoke all on table "public"."trust_account_ledger" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."trust_account_ledger" to "anon";

revoke all on table "public"."trust_account_ledger" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."trust_account_ledger" to "authenticated";

revoke all on table "public"."trust_account_ledger" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."trust_account_ledger" to "service_role";

revoke all on table "public"."user_account" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."user_account" to "anon";

revoke all on table "public"."user_account" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."user_account" to "authenticated";

revoke all on table "public"."user_account" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."user_account" to "service_role";

revoke all on table "public"."user_invitation" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."user_invitation" to "anon";

revoke all on table "public"."user_invitation" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."user_invitation" to "authenticated";

revoke all on table "public"."user_invitation" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."user_invitation" to "service_role";

revoke all on table "public"."user_notification_preference" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."user_notification_preference" to "anon";

revoke all on table "public"."user_notification_preference" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."user_notification_preference" to "authenticated";

revoke all on table "public"."user_notification_preference" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."user_notification_preference" to "service_role";

revoke all on table "public"."user_setting" from "anon";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."user_setting" to "anon";

revoke all on table "public"."user_setting" from "authenticated";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."user_setting" to "authenticated";

revoke all on table "public"."user_setting" from "service_role";

grant delete, insert, maintain, references, select, trigger, truncate, update on table "public"."user_setting" to "service_role";
