-- Research-backed staged client capture and FICA onboarding.

alter table public.party
  add column if not exists client_roles public.party_type[] not null default '{}'::public.party_type[],
  add column if not exists assigned_to uuid references public.user_account(id) on delete set null,
  add column if not exists preferred_contact_channel text,
  add column if not exists contact_language text,
  add column if not exists acquisition_source text,
  add column if not exists processing_basis text,
  add column if not exists privacy_notice_delivered_at timestamptz,
  add column if not exists direct_marketing_consent_at timestamptz,
  add column if not exists direct_marketing_channels text[] not null default '{}'::text[],
  add column if not exists onboarding_notes text,
  add column if not exists address_line text,
  add column if not exists suburb text,
  add column if not exists city text,
  add column if not exists province text,
  add column if not exists postal_code text;

alter table public.party
  add column if not exists prominent_person_screened_at timestamptz;

update public.party
set client_roles = array[party_type]::public.party_type[]
where cardinality(client_roles) = 0;

do $$ begin
  alter table public.party add constraint party_preferred_contact_channel_valid
    check (preferred_contact_channel is null or preferred_contact_channel in ('email', 'phone', 'whatsapp'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.party add constraint party_processing_basis_valid
    check (processing_basis is null or processing_basis in ('requested_service', 'mandate_contract', 'legal_obligation', 'consent'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.party add constraint party_marketing_channels_valid
    check (direct_marketing_channels <@ array['email', 'sms', 'whatsapp', 'phone']::text[]);
exception when duplicate_object then null; end $$;

create index if not exists party_agency_assigned_idx on public.party(agency_id, assigned_to)
  where archived_at is null;
create index if not exists party_agency_identity_idx on public.party(agency_id, lower(id_or_reg_number))
  where id_or_reg_number is not null and archived_at is null;

create or replace function public.create_client(p_payload jsonb)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
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
  if public.get_current_role() not in ('principal', 'admin') and v_assigned_to <> v_actor_id then
    raise exception 'Only a manager may assign a client to another practitioner.';
  end if;
  if not exists (
    select 1 from public.user_account
    where id = v_assigned_to and agency_id = v_agency_id and status = 'active'
      and role in ('principal', 'admin', 'agent', 'candidate')
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
$$;

revoke all on function public.create_client(jsonb) from public, anon;
grant execute on function public.create_client(jsonb) to authenticated;
