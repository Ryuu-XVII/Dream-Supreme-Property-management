-- Migration: Reconcile live database drift into source control
-- Description: These object definitions existed ONLY in the production
-- database, not in any migration. They were applied directly (dashboard or
-- ad-hoc SQL) at some point, so `supabase db diff --linked` reported them as
-- differences and a fresh `db reset` would NOT have reproduced production.
--
-- Critically, the live versions are the *more hardened* ones -- several are
-- authorization logic (is_manager, can_access_deal, can_edit_lease,
-- protect_user_account_sensitive_fields, prevent_hard_delete). Leaving them
-- undeclared meant any future `create or replace` written against the repo
-- copy would have silently reverted a security fix.
--
-- This migration therefore captures PRODUCTION as the source of truth. It is
-- a no-op against the live database (every statement restates what is already
-- there) and exists so that a fresh environment matches production.
--
-- Generated from `supabase db diff --linked --schema public`. The ~530
-- revoke/grant statements that diff also emitted were omitted deliberately:
-- each was a `revoke all ...` immediately followed by a `grant` of the same
-- privileges, i.e. a restatement of current state rather than a real change.
--
-- Functions captured here:
--   * assign_lead_round_robin
--   * bootstrap_principal
--   * can_access_deal
--   * can_edit_lease
--   * create_client
--   * create_deal
--   * create_mandate
--   * is_manager
--   * notify_agency_admins
--   * popia_erase_party_data
--   * popia_export_party_data
--   * popia_lookup_party
--   * prevent_hard_delete
--   * process_monthly_section_86_4_interest_allocation
--   * protect_user_account_sensitive_fields
--   * record_trust_transaction
--   * review_compliance_item
--   * run_daily_sweeps
--   * upsert_ffc_certificate

alter default privileges for role "postgres" in schema "public" revoke all on sequences from "anon";

alter default privileges for role "postgres" in schema "public" revoke all on sequences from "authenticated";

alter default privileges for role "postgres" in schema "public" revoke all on sequences from "service_role";

alter default privileges for role "postgres" in schema "public" revoke all on tables from "anon";

alter default privileges for role "postgres" in schema "public" revoke all on tables from "authenticated";

alter default privileges for role "postgres" in schema "public" revoke all on tables from "service_role";

alter default privileges for role "postgres" in schema "public" grant select, update, usage on sequences to "anon";

alter default privileges for role "postgres" in schema "public" grant select, update, usage on sequences to "authenticated";

alter default privileges for role "postgres" in schema "public" grant select, update, usage on sequences to "service_role";

alter default privileges for role "postgres" in schema "public" grant execute on FUNCTIONS to "anon";

alter default privileges for role "postgres" in schema "public" grant execute on FUNCTIONS to "authenticated";

alter default privileges for role "postgres" in schema "public" grant execute on FUNCTIONS to "service_role";

alter default privileges for role "postgres" in schema "public" grant delete, insert, maintain, references, select, trigger, truncate, update on tables to "anon";

alter default privileges for role "postgres" in schema "public" grant delete, insert, maintain, references, select, trigger, truncate, update on tables to "authenticated";

alter default privileges for role "postgres" in schema "public" grant delete, insert, maintain, references, select, trigger, truncate, update on tables to "service_role";

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

create or replace function public.popia_erase_party_data (
  p_party_id uuid
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
  AS $function$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_party public.party%rowtype;
begin
  if public.get_current_role() not in ('admin', 'admin_agent') then
    raise exception 'Only managers can erase POPIA subject data.';
  end if;

  select * into v_party from public.party where id = p_party_id and agency_id = v_agency_id for update;
  if v_party.id is null then raise exception 'Party not found in this agency.'; end if;

  update public.party set
    full_name = 'REDACTED',
    email = null,
    mobile = null,
    id_or_reg_number = null
  where id = p_party_id;

  insert into public.audit_log(agency_id, actor_id, entity_type, entity_id, action, before_json, after_json)
  values (
    v_agency_id, public.get_current_user_account_id(), 'party', p_party_id, 'popia_erasure',
    jsonb_build_object('full_name', v_party.full_name, 'email', v_party.email),
    jsonb_build_object('erased_at', now())
  );

  return jsonb_build_object('erased', true);
end;
$function$;

create or replace function public.popia_export_party_data (
  p_party_id uuid
)
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
  AS $function$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_party public.party%rowtype;
  v_result jsonb;
begin
  if public.get_current_role() not in ('admin', 'admin_agent') then
    raise exception 'Only managers can export POPIA subject data.';
  end if;

  select * into v_party from public.party where id = p_party_id and agency_id = v_agency_id;
  if v_party.id is null then raise exception 'Party not found in this agency.'; end if;

  select jsonb_build_object(
    'party', to_jsonb(v_party),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'category', d.category, 'filename', d.filename, 'uploadedAt', d.uploaded_at
      )) from public.document d where d.party_id = p_party_id
    ), '[]'::jsonb),
    'signatures', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sr.id, 'signerEmail', sr.signer_email, 'signedAt', sr.signed_at
      ))
      from public.signature_record sr where sr.signer_party_id = p_party_id
    ), '[]'::jsonb),
    'leads', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id, 'source', l.source, 'message', l.message, 'createdAt', l.created_at
      ))
      from public.lead l where l.email is not distinct from v_party.email and l.agency_id = v_agency_id
    ), '[]'::jsonb)
  ) into v_result;

  insert into public.audit_log(agency_id, actor_id, entity_type, entity_id, action, after_json)
  values (v_agency_id, public.get_current_user_account_id(), 'party', p_party_id, 'popia_export',
    jsonb_build_object('exported_at', now()));

  return v_result;
end;
$function$;

create or replace function public.popia_lookup_party (
  p_search text
)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path to 'public', 'pg_temp'
  AS $function$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_result jsonb;
begin
  if public.get_current_role() not in ('admin', 'admin_agent') then
    raise exception 'Only managers can look up POPIA subject data.';
  end if;
  if nullif(trim(p_search), '') is null then raise exception 'A search term is required.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'fullName', p.full_name,
    'email', p.email,
    'mobile', p.mobile,
    'idOrRegNumber', p.id_or_reg_number,
    'documentCount', (select count(*) from public.document d where d.party_id = p.id),
    'signatureCount', (select count(*) from public.signature_record sr where sr.signer_party_id = p.id),
    'leadCount', (select count(*) from public.lead l where l.email is not distinct from p.email and l.agency_id = v_agency_id)
  )), '[]'::jsonb) into v_result
  from public.party p
  where p.agency_id = v_agency_id
    and (
      p.full_name ilike '%' || p_search || '%'
      or p.email ilike '%' || p_search || '%'
      or p.id_or_reg_number ilike '%' || p_search || '%'
    )
  limit 50;

  return v_result;
end;
$function$;

create or replace function public.prevent_hard_delete()
  returns trigger
  language plpgsql
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

create or replace function public.upsert_ffc_certificate (
  p_user_account_id    uuid,
  p_certificate_number text,
  p_issued_on          date,
  p_expires_on         date,
  p_filename           text,
  p_storage_key        text,
  p_mime_type          text,
  p_size_bytes         bigint
)
  returns uuid
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
  AS $function$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_document_id uuid;
  v_certificate_id uuid;
begin
  if public.get_current_role() not in ('admin', 'admin_agent') then
    raise exception 'Only an administrator can maintain FFC records.';
  end if;
  if not exists (
    select 1 from public.user_account where id = p_user_account_id and agency_id = v_agency_id
  ) then raise exception 'Practitioner not found in this agency.'; end if;
  if nullif(trim(p_certificate_number), '') is null or p_issued_on is null or p_expires_on is null then
    raise exception 'Certificate number and dates are required.';
  end if;
  if p_expires_on < p_issued_on then raise exception 'Expiry date cannot precede issue date.'; end if;
  insert into public.document(
    agency_id, user_account_id, category, filename, storage_key, mime_type,
    size_bytes, uploaded_by
  ) values (
    v_agency_id, p_user_account_id, 'ffc_certificate', p_filename, p_storage_key,
    p_mime_type, p_size_bytes, public.get_current_user_account_id()
  ) returning id into v_document_id;
  select id into v_certificate_id from public.ffc_certificate
  where user_account_id = p_user_account_id order by created_at desc limit 1 for update;
  if v_certificate_id is null then
    insert into public.ffc_certificate(
      user_account_id, certificate_number, issued_on, expires_on, document_id
    ) values (
      p_user_account_id, trim(p_certificate_number), p_issued_on, p_expires_on, v_document_id
    ) returning id into v_certificate_id;
  else
    update public.ffc_certificate set certificate_number = trim(p_certificate_number),
      issued_on = p_issued_on, expires_on = p_expires_on, document_id = v_document_id
    where id = v_certificate_id;
  end if;
  insert into public.audit_log(agency_id, actor_id, entity_type, entity_id, action, after_json)
  values (v_agency_id, public.get_current_user_account_id(), 'ffc_certificate', v_certificate_id,
    'update', jsonb_build_object('user_account_id', p_user_account_id, 'expires_on', p_expires_on));
  return v_certificate_id;
end;
$function$;
