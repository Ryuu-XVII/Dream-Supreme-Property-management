-- Production workflow, tenancy, audit, and data-integrity hardening.

alter table public.agency add column if not exists public_slug text;
alter table public.deal add column if not exists lodged_on date;
alter table public.config_transfer_duty enable row level security;
update public.agency
set public_slug = lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'))
where public_slug is null;
create unique index if not exists agency_public_slug_key on public.agency(public_slug);

create table if not exists public.user_invitation (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete restrict,
  email text not null,
  role public.user_role not null default 'agent',
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  invited_by uuid references public.user_account(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.user_invitation enable row level security;

create table if not exists public.notification_preference (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete cascade,
  event_type text not null,
  email_enabled boolean not null default true,
  in_app_enabled boolean not null default true,
  recipient_roles public.user_role[] not null default array['agent', 'principal']::public.user_role[],
  updated_at timestamptz not null default now(),
  unique(agency_id, event_type)
);
alter table public.notification_preference enable row level security;

-- Storage policies below depend on these helpers, so define them before the
-- policies are parsed. They are repeated later with the same definitions to
-- keep the workflow/RLS section self-contained.
create or replace function public.get_current_role()
returns public.user_role
language sql stable security definer
set search_path = public, pg_temp
as $$
  select role from public.user_account
  where auth_user_id = auth.uid() and status = 'active'
  limit 1;
$$;

create or replace function public.can_access_deal(p_deal_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.deal d
    where d.id = p_deal_id
      and d.agency_id = public.get_current_agency_id()
      and (
        public.get_current_role() in ('principal', 'admin')
        or d.created_by = public.get_current_user_account_id()
        or exists (
          select 1 from public.deal_participant dp
          where dp.deal_id = d.id
            and dp.user_account_id = public.get_current_user_account_id()
        )
      )
  );
$$;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values (
  'mandate-documents', 'mandate-documents', false, 26214400,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg', 'image/png', 'image/webp', 'text/csv']
)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Authenticated users upload mandate files" on storage.objects;
create policy "Authenticated users upload mandate files" on storage.objects for insert to authenticated
with check (bucket_id = 'mandate-documents' and (storage.foldername(name))[1] in (auth.uid()::text, public.get_current_agency_id()::text));
drop policy if exists "Users read own mandate files" on storage.objects;
create policy "Users read own mandate files" on storage.objects for select to authenticated
using (
  bucket_id = 'mandate-documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.document doc
      where doc.storage_key = name and doc.agency_id = public.get_current_agency_id()
        and (
          public.get_current_role() in ('principal', 'admin')
          or doc.uploaded_by = public.get_current_user_account_id()
          or doc.user_account_id = public.get_current_user_account_id()
          or (doc.deal_id is not null and public.can_access_deal(doc.deal_id))
        )
    )
  )
);
drop policy if exists "Users delete own mandate files" on storage.objects;
create policy "Users delete own mandate files" on storage.objects for delete to authenticated
using (
  bucket_id = 'mandate-documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.document doc
      where doc.storage_key = name and doc.agency_id = public.get_current_agency_id()
        and (doc.uploaded_by = public.get_current_user_account_id() or public.get_current_role() in ('principal', 'admin'))
    )
  )
);

create or replace function public.get_current_role()
returns public.user_role
language sql stable security definer
set search_path = public, pg_temp
as $$
  select role from public.user_account
  where auth_user_id = auth.uid() and status = 'active'
  limit 1;
$$;

create or replace function public.can_access_deal(p_deal_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.deal d
    where d.id = p_deal_id
      and d.agency_id = public.get_current_agency_id()
      and (
        public.get_current_role() in ('principal', 'admin')
        or d.created_by = public.get_current_user_account_id()
        or exists (
          select 1 from public.deal_participant dp
          where dp.deal_id = d.id
            and dp.user_account_id = public.get_current_user_account_id()
        )
      )
  );
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'agency', 'branch', 'user_account', 'property', 'party', 'mandate',
    'conveyancer_firm', 'deal', 'suspensive_condition', 'bond_application',
    'offer', 'commission_rule_set', 'commission_advance', 'lead'
  ] loop
    execute format('drop trigger if exists touch_updated_at on public.%I', table_name);
    execute format(
      'create trigger touch_updated_at before update on public.%I for each row execute function public.touch_updated_at()',
      table_name
    );
  end loop;
end $$;

create or replace function public.prevent_hard_delete()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('app.workflow_change', true), '') = 'allowed' then
    return old;
  end if;
  raise exception 'Hard deletes are disabled. Archive the record instead.' using errcode = 'P0001';
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'agency', 'branch', 'user_account', 'property', 'party', 'mandate',
    'conveyancer_firm', 'deal', 'document'
  ] loop
    execute format('drop trigger if exists prevent_hard_delete on public.%I', table_name);
    execute format(
      'create trigger prevent_hard_delete before delete on public.%I for each row execute function public.prevent_hard_delete()',
      table_name
    );
  end loop;
end $$;

create or replace function public.enforce_deal_workflow()
returns trigger language plpgsql as $$
begin
  if (old.stage, old.status, old.cancellation_reason, old.cancelled_on)
     is distinct from
     (new.stage, new.status, new.cancellation_reason, new.cancelled_on)
     and coalesce(current_setting('app.workflow_change', true), '') <> 'allowed'
  then
    raise exception 'Use the deal workflow functions to transition or cancel a deal.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_deal_workflow on public.deal;
create trigger enforce_deal_workflow
before update on public.deal
for each row execute function public.enforce_deal_workflow();

-- Replace broad policies with role-aware, operation-specific policies.
drop policy if exists "Users can view and manage deals in their agency" on public.deal;
drop policy if exists "Deal role based access" on public.deal;
create policy "Accessible deals are readable" on public.deal for select
using (public.can_access_deal(id));
create policy "Agency users can create own deals" on public.deal for insert
with check (
  agency_id = public.get_current_agency_id()
  and created_by = public.get_current_user_account_id()
);
create policy "Accessible deals are editable" on public.deal for update
using (public.can_access_deal(id))
with check (agency_id = public.get_current_agency_id());

drop policy if exists "Users can view and manage properties in their agency" on public.property;
create policy "Agency properties are readable" on public.property for select
using (agency_id = public.get_current_agency_id());
create policy "Agency users can create properties" on public.property for insert
with check (agency_id = public.get_current_agency_id());
create policy "Managers can update properties" on public.property for update
using (
  agency_id = public.get_current_agency_id()
  and (
    public.get_current_role() in ('principal', 'admin')
    or exists (select 1 from public.deal d where d.property_id = public.property.id and public.can_access_deal(d.id))
  )
)
with check (agency_id = public.get_current_agency_id());

drop policy if exists "Users can view and manage parties in their agency" on public.party;
create policy "Agency parties are readable" on public.party for select
using (agency_id = public.get_current_agency_id());
create policy "Agency users can create parties" on public.party for insert
with check (agency_id = public.get_current_agency_id());
create policy "Managers can update parties" on public.party for update
using (
  agency_id = public.get_current_agency_id()
  and (
    public.get_current_role() in ('principal', 'admin')
    or exists (
      select 1 from public.deal_party dp where dp.party_id = public.party.id and public.can_access_deal(dp.deal_id)
    )
  )
)
with check (agency_id = public.get_current_agency_id());

drop policy if exists "Users can view and manage mandates in their agency" on public.mandate;
create policy "Agency mandates are readable" on public.mandate for select
using (agency_id = public.get_current_agency_id());
create policy "Agency users can create mandates" on public.mandate for insert
with check (agency_id = public.get_current_agency_id());
create policy "Managers can update mandates" on public.mandate for update
using (
  agency_id = public.get_current_agency_id()
  and (
    public.get_current_role() in ('principal', 'admin')
    or exists (select 1 from public.deal d where d.mandate_id = public.mandate.id and public.can_access_deal(d.id))
  )
)
with check (agency_id = public.get_current_agency_id());

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'deal_participant', 'deal_stage_history', 'deal_party', 'suspensive_condition',
    'bond_application', 'offer', 'checklist_item'
  ] loop
    execute format('drop policy if exists "Accessible deal child records" on public.%I', table_name);
    execute format(
      'create policy "Accessible deal child records" on public.%I for select using (public.can_access_deal(deal_id))',
      table_name
    );
    execute format('drop policy if exists "Accessible deal child records insert" on public.%I', table_name);
    execute format(
      'create policy "Accessible deal child records insert" on public.%I for insert with check (public.can_access_deal(deal_id))',
      table_name
    );
    execute format('drop policy if exists "Accessible deal child records update" on public.%I', table_name);
    execute format(
      'create policy "Accessible deal child records update" on public.%I for update using (public.can_access_deal(deal_id)) with check (public.can_access_deal(deal_id))',
      table_name
    );
  end loop;
end $$;

drop policy if exists "Users can view user accounts in their agency" on public.user_account;
create policy "Agency directory is readable" on public.user_account for select
using (agency_id = public.get_current_agency_id());
create policy "Managers can update agency users" on public.user_account for update
using (agency_id = public.get_current_agency_id() and public.get_current_role() in ('principal', 'admin'))
with check (agency_id = public.get_current_agency_id());
create policy "Managers view invitations" on public.user_invitation for select
using (agency_id = public.get_current_agency_id() and public.get_current_role() in ('principal', 'admin'));
create policy "Managers manage notification preferences" on public.notification_preference for all
using (agency_id = public.get_current_agency_id() and public.get_current_role() in ('principal', 'admin'))
with check (agency_id = public.get_current_agency_id() and public.get_current_role() in ('principal', 'admin'));

create policy "Managers update agency profile" on public.agency for update
using (id = public.get_current_agency_id() and public.get_current_role() in ('principal', 'admin'))
with check (id = public.get_current_agency_id());
create policy "Agency users read transfer duty configuration" on public.config_transfer_duty for select
using (public.get_current_agency_id() is not null);
create policy "Principals manage transfer duty configuration" on public.config_transfer_duty for all
using (public.get_current_role() = 'principal')
with check (public.get_current_role() = 'principal');
create policy "Managers create branches" on public.branch for insert
with check (agency_id = public.get_current_agency_id() and public.get_current_role() in ('principal', 'admin'));
create policy "Managers update branches" on public.branch for update
using (agency_id = public.get_current_agency_id() and public.get_current_role() in ('principal', 'admin'))
with check (agency_id = public.get_current_agency_id());

create policy "Agency conveyancers are readable" on public.conveyancer_firm for select
using (agency_id = public.get_current_agency_id());
create policy "Managers create conveyancers" on public.conveyancer_firm for insert
with check (agency_id = public.get_current_agency_id() and public.get_current_role() in ('principal', 'admin'));
create policy "Managers update conveyancers" on public.conveyancer_firm for update
using (agency_id = public.get_current_agency_id() and public.get_current_role() in ('principal', 'admin'))
with check (agency_id = public.get_current_agency_id());

create or replace function public.create_user_invitation(p_email text, p_role public.user_role default 'agent')
returns text
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if public.get_current_role() not in ('principal', 'admin') then raise exception 'Only managers can invite users.'; end if;
  if p_role = 'principal' and public.get_current_role() <> 'principal' then raise exception 'Only a principal can invite another principal.'; end if;
  insert into public.user_invitation(agency_id, email, role, token_hash, invited_by)
  values (
    public.get_current_agency_id(), lower(trim(p_email)), p_role,
    encode(digest(v_token, 'sha256'), 'hex'), public.get_current_user_account_id()
  );
  return v_token;
end;
$$;

create or replace function public.validate_user_invitation(p_token text, p_email text)
returns boolean
language sql stable security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.user_invitation
    where token_hash = encode(digest(p_token, 'sha256'), 'hex')
      and email = lower(trim(p_email)) and accepted_at is null and expires_at > now()
  );
$$;

create or replace function public.accept_user_invitation(
  p_token text,
  p_full_name text,
  p_mobile text,
  p_avatar_key text default null
) returns uuid
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_invite public.user_invitation%rowtype;
  v_account_id uuid;
  v_auth_email text := lower(coalesce(auth.jwt()->>'email', ''));
begin
  if auth.uid() is null then raise exception 'Authentication is required.'; end if;
  select * into v_invite from public.user_invitation
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and accepted_at is null and expires_at > now() for update;
  if v_invite.id is null or lower(v_invite.email) <> v_auth_email then raise exception 'Invitation is invalid or expired.'; end if;
  insert into public.user_account(auth_user_id, agency_id, email, full_name, role, mobile, avatar_key)
  values (auth.uid(), v_invite.agency_id, v_invite.email, trim(p_full_name), v_invite.role, p_mobile, p_avatar_key)
  returning id into v_account_id;
  update public.user_invitation set accepted_at = now() where id = v_invite.id;
  return v_account_id;
end;
$$;

create or replace function public.bootstrap_principal(
  p_agency_slug text,
  p_auth_user_id uuid,
  p_email text,
  p_full_name text
) returns uuid
language plpgsql security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_agency_id uuid;
  v_account_id uuid;
begin
  select id into v_agency_id from public.agency where public_slug = p_agency_slug;
  if v_agency_id is null then raise exception 'Agency not found.'; end if;
  if exists (select 1 from public.user_account where agency_id = v_agency_id and role = 'principal') then
    raise exception 'This agency already has a principal account.';
  end if;
  if not exists (
    select 1 from auth.users where id = p_auth_user_id and lower(email) = lower(trim(p_email))
  ) then
    raise exception 'The matching Supabase Auth user does not exist.';
  end if;
  insert into public.user_account(auth_user_id, agency_id, full_name, email, role, status)
  values (p_auth_user_id, v_agency_id, trim(p_full_name), lower(trim(p_email)), 'principal', 'active')
  returning id into v_account_id;
  return v_account_id;
end;
$$;

create policy "Agency FFCs are readable" on public.ffc_certificate for select
using (
  exists (select 1 from public.user_account u where u.id = user_account_id and u.agency_id = public.get_current_agency_id())
);
create policy "Managers can manage FFCs" on public.ffc_certificate for all
using (
  public.get_current_role() in ('principal', 'admin')
  and exists (select 1 from public.user_account u where u.id = user_account_id and u.agency_id = public.get_current_agency_id())
)
with check (
  public.get_current_role() in ('principal', 'admin')
  and exists (select 1 from public.user_account u where u.id = user_account_id and u.agency_id = public.get_current_agency_id())
);

create policy "Deal commission rules are readable" on public.commission_rule_line for select
using (exists (
  select 1 from public.commission_rule_set rs
  where rs.id = rule_set_id and rs.agency_id = public.get_current_agency_id()
));
create policy "Principals manage commission rules" on public.commission_rule_line for all
using (
  public.get_current_role() = 'principal'
  and exists (select 1 from public.commission_rule_set rs where rs.id = rule_set_id and rs.agency_id = public.get_current_agency_id())
)
with check (
  public.get_current_role() = 'principal'
  and exists (select 1 from public.commission_rule_set rs where rs.id = rule_set_id and rs.agency_id = public.get_current_agency_id())
);

create policy "Principals manage commission rule sets" on public.commission_rule_set for all
using (agency_id = public.get_current_agency_id() and public.get_current_role() = 'principal')
with check (agency_id = public.get_current_agency_id() and public.get_current_role() = 'principal');

create policy "Authorized commission calculations are readable" on public.commission_calculation for select
using (public.can_access_deal(deal_id));
create policy "Managers manage commission calculations" on public.commission_calculation for all
using (public.get_current_role() in ('principal', 'admin') and public.can_access_deal(deal_id))
with check (public.get_current_role() in ('principal', 'admin') and public.can_access_deal(deal_id));

create policy "Authorized allocations are readable" on public.commission_allocation for select
using (
  user_account_id = public.get_current_user_account_id()
  or public.get_current_role() in ('principal', 'admin')
);
create policy "Managers manage allocations" on public.commission_allocation for all
using (public.get_current_role() in ('principal', 'admin'))
with check (public.get_current_role() in ('principal', 'admin'));

create policy "Authorized advances are readable" on public.commission_advance for select
using (
  agency_id = public.get_current_agency_id()
  and (user_account_id = public.get_current_user_account_id() or public.get_current_role() in ('principal', 'admin'))
);
create policy "Managers manage advances" on public.commission_advance for all
using (agency_id = public.get_current_agency_id() and public.get_current_role() in ('principal', 'admin'))
with check (agency_id = public.get_current_agency_id() and public.get_current_role() in ('principal', 'admin'));

create policy "Authorized clawbacks are readable" on public.commission_clawback for select
using (user_account_id = public.get_current_user_account_id() or public.get_current_role() in ('principal', 'admin'));
create policy "Managers manage clawbacks" on public.commission_clawback for all
using (public.get_current_role() in ('principal', 'admin'))
with check (public.get_current_role() in ('principal', 'admin'));

create policy "Signature records are readable by agency" on public.signature_record for select
using (exists (
  select 1 from public.document doc
  where doc.id = document_id and doc.agency_id = public.get_current_agency_id()
));
create policy "Audit records are readable by managers" on public.audit_log for select
using (agency_id = public.get_current_agency_id() and public.get_current_role() in ('principal', 'admin'));
create policy "Agency users update leads" on public.lead for update
using (
  agency_id = public.get_current_agency_id()
  and (assigned_to = public.get_current_user_account_id() or public.get_current_role() in ('principal', 'admin'))
)
with check (agency_id = public.get_current_agency_id());
create policy "Users mark own notifications read" on public.notification for update
using (user_account_id = public.get_current_user_account_id())
with check (user_account_id = public.get_current_user_account_id());

drop policy if exists "Users can manage suspensive conditions for agency deals" on public.suspensive_condition;
drop policy if exists "Users can view and upload documents in their agency" on public.document;
create policy "Accessible documents are readable" on public.document for select
using (
  agency_id = public.get_current_agency_id()
  and (
    public.get_current_role() in ('principal', 'admin')
    or uploaded_by = public.get_current_user_account_id()
    or user_account_id = public.get_current_user_account_id()
    or (deal_id is not null and public.can_access_deal(deal_id))
  )
);
create policy "Agency users upload scoped documents" on public.document for insert
with check (
  agency_id = public.get_current_agency_id()
  and (deal_id is null or public.can_access_deal(deal_id))
  and (
    user_account_id is null
    or user_account_id = public.get_current_user_account_id()
    or public.get_current_role() in ('principal', 'admin')
  )
);
create policy "Managers and uploaders update documents" on public.document for update
using (
  agency_id = public.get_current_agency_id()
  and (uploaded_by = public.get_current_user_account_id() or public.get_current_role() in ('principal', 'admin'))
)
with check (agency_id = public.get_current_agency_id());

drop policy if exists "Anyone can insert a lead from public calculators" on public.lead;
drop policy if exists "Agency users can view agency leads" on public.lead;
create policy "Assigned leads are readable" on public.lead for select
using (
  agency_id = public.get_current_agency_id()
  and (assigned_to = public.get_current_user_account_id() or public.get_current_role() in ('principal', 'admin'))
);

create or replace function public.create_deal(p_payload jsonb)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_actor_id uuid := public.get_current_user_account_id();
  v_property_id uuid;
  v_seller_id uuid;
  v_buyer_id uuid;
  v_mandate_id uuid;
  v_deal_id uuid;
  v_conveyancer_id uuid;
  v_lead_agent_id uuid;
  v_reference text;
  v_condition jsonb;
begin
  if v_agency_id is null or v_actor_id is null then
    raise exception 'An active company account is required.';
  end if;
  if nullif(trim(p_payload->>'address'), '') is null then raise exception 'Property address is required.'; end if;
  if nullif(trim(p_payload#>>'{seller,name}'), '') is null then raise exception 'Seller name is required.'; end if;
  if nullif(trim(p_payload#>>'{purchaser,name}'), '') is null then raise exception 'Purchaser name is required.'; end if;

  v_lead_agent_id := coalesce(nullif(p_payload->>'leadAgentId', '')::uuid, v_actor_id);
  if public.get_current_role() not in ('principal', 'admin') and v_lead_agent_id <> v_actor_id then
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
    garages, erf_size_sqm, floor_size_sqm
  ) values (
    v_agency_id, trim(p_payload->>'address'), trim(p_payload->>'suburb'),
    coalesce(nullif(trim(p_payload->>'city'), ''), 'Johannesburg'), p_payload->>'province',
    p_payload->>'postalCode', p_payload->>'erfNumber', p_payload->>'titleDeedNumber',
    (p_payload->>'propertyType')::public.property_type,
    coalesce((p_payload->>'isSectionalTitle')::boolean, false),
    coalesce((p_payload->>'bedrooms')::int, 0), coalesce((p_payload->>'bathrooms')::int, 0),
    coalesce((p_payload->>'garages')::int, 0), coalesce((p_payload->>'erfSizeSqm')::numeric, 0),
    coalesce((p_payload->>'floorSizeSqm')::numeric, 0)
  ) returning id into v_property_id;

  insert into public.party (
    agency_id, party_type, entity_type, full_name, id_or_reg_number, email,
    mobile, marital_status, is_vat_vendor, fica_status, popia_consent_at
  ) values (
    v_agency_id, 'seller', (p_payload#>>'{seller,entityType}')::public.entity_type,
    trim(p_payload#>>'{seller,name}'), p_payload#>>'{seller,idNumber}', p_payload#>>'{seller,email}',
    p_payload#>>'{seller,mobile}', p_payload#>>'{seller,maritalStatus}',
    coalesce((p_payload#>>'{seller,isVatVendor}')::boolean, false),
    coalesce((p_payload#>>'{seller,ficaStatus}')::public.fica_status, 'not_started'),
    case when coalesce((p_payload#>>'{seller,popiaConsent}')::boolean, false) then now() end
  ) returning id into v_seller_id;

  insert into public.party (
    agency_id, party_type, entity_type, full_name, id_or_reg_number, email,
    mobile, marital_status, is_vat_vendor, fica_status, popia_consent_at
  ) values (
    v_agency_id, 'purchaser', (p_payload#>>'{purchaser,entityType}')::public.entity_type,
    trim(p_payload#>>'{purchaser,name}'), p_payload#>>'{purchaser,idNumber}', p_payload#>>'{purchaser,email}',
    p_payload#>>'{purchaser,mobile}', p_payload#>>'{purchaser,maritalStatus}',
    coalesce((p_payload#>>'{purchaser,isVatVendor}')::boolean, false),
    coalesce((p_payload#>>'{purchaser,ficaStatus}')::public.fica_status, 'not_started'),
    case when coalesce((p_payload#>>'{purchaser,popiaConsent}')::boolean, false) then now() end
  ) returning id into v_buyer_id;

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
    sale_price_cents, otp_signed_on, occupation_date, conveyancer_firm_id,
    conveyancer_reference, is_vat_sale, created_by
  ) values (
    v_agency_id, nullif(p_payload->>'branchId', '')::uuid, v_property_id, v_mandate_id,
    v_reference, 'otp_signed', 'active', (p_payload->>'salePriceCents')::bigint,
    nullif(p_payload->>'otpSignedOn', '')::date, nullif(p_payload->>'occupationDate', '')::date,
    v_conveyancer_id, nullif(p_payload->>'conveyancerReference', ''),
    coalesce((p_payload->>'isVatSale')::boolean, false), v_actor_id
  ) returning id into v_deal_id;

  insert into public.deal_participant(deal_id, user_account_id, role, split_type, split_value)
  values (v_deal_id, v_lead_agent_id, 'listing_agent', 'percentage', 100);
  insert into public.deal_party(deal_id, party_id, role)
  values (v_deal_id, v_seller_id, 'seller'), (v_deal_id, v_buyer_id, 'purchaser');

  for v_condition in select value from jsonb_array_elements(coalesce(p_payload->'conditions', '[]'::jsonb)) loop
    insert into public.suspensive_condition(
      deal_id, condition_type, description, due_on, original_due_on, responsible_party, status
    ) values (
      v_deal_id, (v_condition->>'type')::public.condition_type, v_condition->>'description',
      (v_condition->>'dueOn')::date, (v_condition->>'dueOn')::date,
      v_condition->>'responsibleParty', 'pending'
    );
  end loop;

  insert into public.deal_stage_history(deal_id, to_stage, changed_by, reason)
  values (v_deal_id, 'otp_signed', v_actor_id, 'Deal created');
  insert into public.audit_log(agency_id, actor_id, entity_type, entity_id, action, after_json)
  values (v_agency_id, v_actor_id, 'deal', v_deal_id, 'create', jsonb_build_object('reference', v_reference, 'stage', 'otp_signed'));

  return v_deal_id;
end;
$$;

create sequence if not exists public.deal_reference_seq start 1;

create or replace function public.transition_deal(
  p_deal_id uuid,
  p_to_stage public.deal_stage,
  p_reason text default null,
  p_override boolean default false
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_deal public.deal%rowtype;
  v_actor uuid := public.get_current_user_account_id();
  v_stages public.deal_stage[] := array[
    'mandate_signed', 'listed_marketing', 'offer_received', 'otp_signed',
    'suspensive_conditions_pending', 'conveyancer_instructed', 'compliance_certificates',
    'transfer_duty_vat', 'rates_levy_clearance', 'documents_signed_guarantees',
    'lodged', 'registered', 'commission_released'
  ]::public.deal_stage[];
  v_from_index int;
  v_to_index int;
  v_gate_failure text;
begin
  if not public.can_access_deal(p_deal_id) then raise exception 'Deal not found or access denied.'; end if;
  select * into v_deal from public.deal where id = p_deal_id for update;
  if v_deal.status not in ('active', 'registered') then raise exception 'A closed deal cannot be transitioned.'; end if;
  v_from_index := array_position(v_stages, v_deal.stage);
  v_to_index := array_position(v_stages, p_to_stage);
  if abs(v_to_index - v_from_index) <> 1 and not p_override then
    raise exception 'Deals can move only one stage at a time.';
  end if;
  if v_to_index < v_from_index and nullif(trim(p_reason), '') is null then
    raise exception 'A reason is required when reverting a deal.';
  end if;
  if p_override and public.get_current_role() <> 'principal' then
    raise exception 'Only the principal can override a stage gate.';
  end if;

  if v_to_index > v_from_index then
    case v_deal.stage
      when 'mandate_signed' then
        if not exists (select 1 from public.mandate m where m.id = v_deal.mandate_id and m.signed_on is not null and m.expires_on is not null)
        then v_gate_failure := 'Signed mandate and expiry are required.'; end if;
      when 'offer_received' then
        if not exists (select 1 from public.offer o where o.deal_id = p_deal_id)
        then v_gate_failure := 'At least one offer must be captured.'; end if;
      when 'otp_signed' then
        if v_deal.sale_price_cents <= 0 or v_deal.otp_signed_on is null
        then v_gate_failure := 'Purchase price and OTP date are required.'; end if;
        if not exists (select 1 from public.document doc where doc.deal_id = p_deal_id and doc.category = 'mandate')
          or not exists (select 1 from public.document doc where doc.deal_id = p_deal_id and doc.category = 'otp')
        then v_gate_failure := 'Signed mandate and signed OTP documents are required.'; end if;
      when 'suspensive_conditions_pending' then
        if exists (select 1 from public.suspensive_condition c where c.deal_id = p_deal_id and c.status in ('pending', 'extended'))
        then v_gate_failure := 'All suspensive conditions must be fulfilled or waived.'; end if;
      when 'conveyancer_instructed' then
        if v_deal.conveyancer_firm_id is null
        then v_gate_failure := 'A conveyancer must be appointed.'; end if;
      else null;
    end case;
  end if;
  if v_gate_failure is not null and not p_override then raise exception '%', v_gate_failure; end if;

  perform set_config('app.workflow_change', 'allowed', true);
  update public.deal set
    stage = p_to_stage,
    status = case when p_to_stage = 'registered' then 'registered' else status end,
    registration_date = case when p_to_stage = 'registered' then coalesce(registration_date, current_date) else registration_date end
  where id = p_deal_id;

  insert into public.deal_stage_history(deal_id, from_stage, to_stage, changed_by, reason, is_override)
  values (p_deal_id, v_deal.stage, p_to_stage, v_actor, p_reason, p_override);
  insert into public.audit_log(agency_id, actor_id, entity_type, entity_id, action, before_json, after_json)
  values (
    v_deal.agency_id, v_actor, 'deal', p_deal_id, 'stage_transition',
    jsonb_build_object('stage', v_deal.stage), jsonb_build_object('stage', p_to_stage, 'override', p_override, 'reason', p_reason)
  );
  if p_to_stage = 'registered' then
    perform public.calculate_deal_commission(p_deal_id, null);
  end if;
end;
$$;

create or replace function public.cancel_deal(
  p_deal_id uuid,
  p_reason public.cancellation_reason,
  p_notes text default null
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_deal public.deal%rowtype;
  v_actor uuid := public.get_current_user_account_id();
begin
  if not public.can_access_deal(p_deal_id) then raise exception 'Deal not found or access denied.'; end if;
  select * into v_deal from public.deal where id = p_deal_id for update;
  if p_reason = 'other' and nullif(trim(p_notes), '') is null then raise exception 'Notes are required for Other.'; end if;
  perform set_config('app.workflow_change', 'allowed', true);
  update public.deal set status = 'cancelled', cancellation_reason = p_reason,
    cancellation_notes = p_notes, cancelled_on = current_date where id = p_deal_id;
  insert into public.commission_clawback(calculation_id, user_account_id, amount_cents, reason, raised_on)
  select cc.id, ca.user_account_id, ca.net_payable_cents,
    'Deal cancelled: ' || p_reason::text || coalesce(' - ' || nullif(trim(p_notes), ''), ''), current_date
  from public.commission_calculation cc
  join public.commission_allocation ca on ca.calculation_id = cc.id
  where cc.deal_id = p_deal_id and cc.status = 'confirmed' and ca.user_account_id is not null
    and ca.net_payable_cents > 0
    and cc.calculated_at = (
      select max(latest.calculated_at) from public.commission_calculation latest
      where latest.deal_id = p_deal_id and latest.status = 'confirmed'
    );
  update public.commission_calculation set status = 'reversed'
  where deal_id = p_deal_id and status in ('provisional', 'confirmed');
  insert into public.audit_log(agency_id, actor_id, entity_type, entity_id, action, before_json, after_json)
  values (v_deal.agency_id, v_actor, 'deal', p_deal_id, 'update',
    jsonb_build_object('status', v_deal.status), jsonb_build_object('status', 'cancelled', 'reason', p_reason, 'notes', p_notes));
end;
$$;

create or replace function public.set_condition_status(
  p_condition_id uuid,
  p_status public.condition_status,
  p_new_due_on date default null,
  p_reason text default null
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_condition public.suspensive_condition%rowtype;
  v_agency uuid;
begin
  select c.* into v_condition from public.suspensive_condition c where c.id = p_condition_id for update;
  if v_condition.id is null or not public.can_access_deal(v_condition.deal_id) then raise exception 'Condition not found or access denied.'; end if;
  if p_status = 'extended' and (p_new_due_on is null or nullif(trim(p_reason), '') is null) then
    raise exception 'A new due date and reason are required for an extension.';
  end if;
  update public.suspensive_condition set
    status = p_status,
    due_on = case when p_status = 'extended' then p_new_due_on else due_on end,
    extension_reason = case when p_status = 'extended' then p_reason else extension_reason end,
    fulfilled_on = case when p_status = 'fulfilled' then current_date else fulfilled_on end
  where id = p_condition_id;
  select agency_id into v_agency from public.deal where id = v_condition.deal_id;
  insert into public.audit_log(agency_id, actor_id, entity_type, entity_id, action, before_json, after_json)
  values (v_agency, public.get_current_user_account_id(), 'condition', p_condition_id, 'update',
    to_jsonb(v_condition), jsonb_build_object('status', p_status, 'due_on', coalesce(p_new_due_on, v_condition.due_on), 'reason', p_reason));
end;
$$;

create unique index if not exists bond_application_deal_key on public.bond_application(deal_id);
create or replace function public.set_bond_status(
  p_deal_id uuid,
  p_status public.bond_app_status,
  p_institution text default null
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_access_deal(p_deal_id) then raise exception 'Deal not found or access denied.'; end if;
  insert into public.bond_application(deal_id, institution, status, status_updated_on)
  values (p_deal_id, coalesce(nullif(trim(p_institution), ''), 'Not specified'), p_status, current_date)
  on conflict (deal_id) do update set
    status = excluded.status,
    institution = coalesce(nullif(trim(p_institution), ''), public.bond_application.institution),
    status_updated_on = current_date;
end;
$$;

create or replace function public.upsert_ffc_certificate(
  p_user_account_id uuid,
  p_certificate_number text,
  p_issued_on date,
  p_expires_on date,
  p_filename text,
  p_storage_key text,
  p_mime_type text,
  p_size_bytes bigint
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_document_id uuid;
  v_certificate_id uuid;
begin
  if public.get_current_role() not in ('principal', 'admin') then
    raise exception 'Only a principal or administrator can maintain FFC records.';
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
$$;

create or replace function public.submit_public_lead(
  p_agency_slug text,
  p_source text,
  p_full_name text,
  p_email text,
  p_mobile text,
  p_payload jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid;
  v_id uuid;
begin
  select id into v_agency_id from public.agency where public_slug = p_agency_slug and archived_at is null;
  if v_agency_id is null then raise exception 'Agency not found.'; end if;
  if length(trim(p_full_name)) < 2 then raise exception 'Name is required.'; end if;
  if p_email is null or p_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'A valid email is required.'; end if;
  insert into public.lead(agency_id, source, full_name, email, mobile, calculator_payload_json)
  values (v_agency_id, lower(p_source), trim(p_full_name), lower(trim(p_email)), p_mobile, p_payload)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.calculate_deal_commission(
  p_deal_id uuid,
  p_rule_set_id uuid default null
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_deal public.deal%rowtype;
  v_mandate public.mandate%rowtype;
  v_rule public.commission_rule_set%rowtype;
  v_calc_id uuid;
  v_gross bigint;
  v_vat bigint;
  v_net bigint;
  v_pool bigint;
  v_office bigint;
  v_agent_pool bigint;
  v_line public.commission_rule_line%rowtype;
  v_participant public.deal_participant%rowtype;
  v_allocation bigint;
  v_advance bigint;
  v_allocated bigint := 0;
  v_invalid_ffc text;
begin
  if public.get_current_role() not in ('principal', 'admin') then raise exception 'Only the principal or administrator can calculate commission.'; end if;
  if not public.can_access_deal(p_deal_id) then raise exception 'Deal not found or access denied.'; end if;
  select * into v_deal from public.deal where id = p_deal_id;
  select * into v_mandate from public.mandate where id = v_deal.mandate_id;
  if p_rule_set_id is null then
    select * into v_rule from public.commission_rule_set
    where agency_id = v_deal.agency_id and is_default
      and effective_from <= coalesce(v_deal.registration_date, current_date)
      and (effective_to is null or effective_to >= coalesce(v_deal.registration_date, current_date))
    order by effective_from desc limit 1;
  else
    select * into v_rule from public.commission_rule_set where id = p_rule_set_id and agency_id = v_deal.agency_id;
  end if;
  if v_rule.id is null then raise exception 'No applicable commission rule set exists.'; end if;

  select string_agg(u.full_name, ', ') into v_invalid_ffc
  from public.deal_participant dp
  join public.user_account u on u.id = dp.user_account_id
  where dp.deal_id = p_deal_id and not dp.is_external
    and not exists (
      select 1 from public.ffc_certificate f
      where f.user_account_id = u.id
        and f.issued_on <= coalesce(v_deal.registration_date, current_date)
        and f.expires_on >= coalesce(v_deal.registration_date, current_date)
    );
  if v_invalid_ffc is not null then raise exception 'Valid FFC required for: %', v_invalid_ffc; end if;

  if (select coalesce(sum(split_value), 0) from public.deal_participant where deal_id = p_deal_id and split_type = 'percentage') <> 100 then
    raise exception 'Practitioner percentage splits must total 100.';
  end if;

  v_gross := round(v_deal.sale_price_cents::numeric * coalesce(nullif(v_mandate.commission_rate_bps, 0), v_rule.default_commission_rate_bps) / 10000)::bigint;
  if v_rule.vat_treatment = 'inclusive' then
    v_net := round(v_gross::numeric / 1.15)::bigint;
    v_vat := v_gross - v_net;
  elsif v_rule.vat_treatment = 'exclusive' then
    v_net := v_gross;
    v_vat := round(v_gross::numeric * 0.15)::bigint;
  else
    v_net := v_gross;
    v_vat := 0;
  end if;
  v_pool := v_net;
  for v_line in select * from public.commission_rule_line where rule_set_id = v_rule.id and line_type <> 'office_share' order by sequence loop
    v_pool := v_pool - case when v_line.calculation_basis = 'fixed' then v_line.fixed_amount_cents else round(v_net::numeric * v_line.rate_bps / 10000)::bigint end;
  end loop;
  v_office := round(v_pool::numeric * v_rule.office_share_bps / 10000)::bigint;
  v_agent_pool := v_pool - v_office;

  insert into public.commission_calculation(
    deal_id, rule_set_id, calculated_by, gross_cents, vat_cents, net_cents,
    distributable_pool_cents, office_share_cents, agent_pool_cents, input_snapshot_json, status
  ) values (
    p_deal_id, v_rule.id, public.get_current_user_account_id(), v_gross, v_vat, v_net,
    v_pool, v_office, v_agent_pool,
    jsonb_build_object('deal', to_jsonb(v_deal), 'mandate', to_jsonb(v_mandate), 'rule_set', to_jsonb(v_rule),
      'rule_lines', coalesce((select jsonb_agg(to_jsonb(line) order by line.sequence) from public.commission_rule_line line where line.rule_set_id = v_rule.id), '[]'::jsonb)),
    case when v_deal.status = 'registered' then 'confirmed' else 'provisional' end
  ) returning id into v_calc_id;

  for v_participant in select * from public.deal_participant where deal_id = p_deal_id order by created_at, id loop
    v_allocation := round(v_agent_pool::numeric * v_participant.split_value / 100)::bigint;
    v_advance := case when v_participant.user_account_id is null then 0 else coalesce((
      select sum(amount_cents - recovered_cents) from public.commission_advance
      where user_account_id = v_participant.user_account_id and status <> 'fully_recovered'
    ), 0) end;
    insert into public.commission_allocation(
      calculation_id, user_account_id, external_payee_name, allocation_type,
      gross_allocation_cents, advance_recovery_cents, net_payable_cents
    ) values (
      v_calc_id, v_participant.user_account_id, v_participant.external_agency_name,
      v_participant.role::text, v_allocation, least(v_allocation, v_advance),
      v_allocation - least(v_allocation, v_advance)
    );
    v_allocated := v_allocated + v_allocation;
  end loop;
  update public.commission_calculation
  set office_share_cents = office_share_cents + (v_agent_pool - v_allocated)
  where id = v_calc_id;
  insert into public.audit_log(agency_id, actor_id, entity_type, entity_id, action, after_json)
  values (v_deal.agency_id, public.get_current_user_account_id(), 'commission_calculation', v_calc_id, 'calculation',
    jsonb_build_object('deal_id', p_deal_id, 'gross_cents', v_gross, 'agent_pool_cents', v_agent_pool));
  return v_calc_id;
end;
$$;

create or replace function public.save_commission_rule_set(p_payload jsonb)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_rule_set_id uuid;
  v_line jsonb;
begin
  if public.get_current_role() <> 'principal' then raise exception 'Only the principal can change commission rules.'; end if;
  if nullif(trim(p_payload->>'name'), '') is null then raise exception 'Rule-set name is required.'; end if;
  begin
    v_rule_set_id := nullif(p_payload->>'id', '')::uuid;
  exception when invalid_text_representation then
    v_rule_set_id := null;
  end;
  if coalesce((p_payload->>'isDefault')::boolean, false) then
    update public.commission_rule_set set is_default = false where agency_id = v_agency_id;
  end if;
  if v_rule_set_id is null then
    insert into public.commission_rule_set(
      agency_id, name, effective_from, effective_to, is_default, vat_treatment,
      default_commission_rate_bps, office_share_bps, rounding_mode, created_by
    ) values (
      v_agency_id, trim(p_payload->>'name'), (p_payload->>'effectiveFrom')::date,
      nullif(p_payload->>'effectiveTo', '')::date,
      coalesce((p_payload->>'isDefault')::boolean, false),
      case when coalesce((p_payload->>'vatInclusive')::boolean, true) then 'inclusive' else 'exclusive' end,
      (p_payload->>'defaultBps')::int, round((p_payload->>'officeSharePct')::numeric * 100)::int,
      coalesce(nullif(p_payload->>'roundingMode', '')::public.rounding_mode, 'half_up'),
      public.get_current_user_account_id()
    ) returning id into v_rule_set_id;
  else
    update public.commission_rule_set set
      name = trim(p_payload->>'name'), effective_from = (p_payload->>'effectiveFrom')::date,
      effective_to = nullif(p_payload->>'effectiveTo', '')::date,
      is_default = coalesce((p_payload->>'isDefault')::boolean, false),
      vat_treatment = case when coalesce((p_payload->>'vatInclusive')::boolean, true) then 'inclusive' else 'exclusive' end,
      default_commission_rate_bps = (p_payload->>'defaultBps')::int,
      office_share_bps = round((p_payload->>'officeSharePct')::numeric * 100)::int,
      rounding_mode = coalesce(nullif(p_payload->>'roundingMode', '')::public.rounding_mode, 'half_up')
    where id = v_rule_set_id and agency_id = v_agency_id;
    if not found then raise exception 'Commission rule set not found.'; end if;
    delete from public.commission_rule_line where rule_set_id = v_rule_set_id;
  end if;
  for v_line in select value from jsonb_array_elements(coalesce(p_payload->'deductions', '[]'::jsonb)) loop
    insert into public.commission_rule_line(
      rule_set_id, sequence, line_type, calculation_basis, rate_bps,
      fixed_amount_cents, payee_type, description
    ) values (
      v_rule_set_id, coalesce((v_line->>'sequence')::int, 0),
      (v_line->>'lineType')::public.commission_line_type,
      coalesce(v_line->>'basis', 'percentage'), coalesce((v_line->>'rateBps')::int, 0),
      coalesce((v_line->>'fixedCents')::bigint, 0), v_line->>'payee', v_line->>'description'
    );
  end loop;
  insert into public.audit_log(agency_id, actor_id, entity_type, entity_id, action, after_json)
  values (v_agency_id, public.get_current_user_account_id(), 'commission_rule_set', v_rule_set_id,
    'update', jsonb_build_object('name', p_payload->>'name', 'is_default', p_payload->>'isDefault'));
  return v_rule_set_id;
end;
$$;

create or replace function public.run_daily_sweeps()
returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
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
    and (recipient.role in ('principal', 'admin') or exists (
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
    and (recipient.role in ('principal', 'admin') or exists (
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
    and (recipient.id = u.id or recipient.role in ('principal', 'admin'))
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
$$;

create unique index if not exists status_request_token_hash_key
on public.status_request_token(token_hash);

create or replace function public.create_status_request(
  p_deal_id uuid,
  p_recipient_email text,
  p_expires_in_hours integer default 72
) returns text
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if not public.can_access_deal(p_deal_id) then raise exception 'Deal not found or access denied.'; end if;
  if nullif(trim(p_recipient_email), '') is null then raise exception 'Recipient email is required.'; end if;
  if p_expires_in_hours < 1 or p_expires_in_hours > 168 then raise exception 'Expiry must be between 1 and 168 hours.'; end if;
  insert into public.status_request_token(deal_id, recipient_email, token_hash, expires_at)
  values (
    p_deal_id, lower(trim(p_recipient_email)), encode(digest(v_token, 'sha256'), 'hex'),
    now() + make_interval(hours => p_expires_in_hours)
  );
  insert into public.audit_log(agency_id, actor_id, entity_type, entity_id, action, after_json)
  select d.agency_id, public.get_current_user_account_id(), 'status_request_token', d.id, 'create',
    jsonb_build_object('recipient_email', lower(trim(p_recipient_email)), 'expires_in_hours', p_expires_in_hours)
  from public.deal d where d.id = p_deal_id;
  return v_token;
end;
$$;

create or replace function public.get_status_request(p_token text)
returns jsonb
language sql stable security definer
set search_path = public, extensions, pg_temp
as $$
  select jsonb_build_object(
    'dealId', d.id,
    'reference', d.reference,
    'stage', d.stage,
    'address', p.address_line,
    'suburb', p.suburb,
    'expiresAt', token.expires_at
  )
  from public.status_request_token token
  join public.deal d on d.id = token.deal_id
  join public.property p on p.id = d.property_id
  where token.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and token.used_at is null and token.expires_at > now()
  limit 1;
$$;

create or replace function public.submit_conveyancer_status(p_token text, p_lodged_on date)
returns void
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_request public.status_request_token%rowtype;
  v_deal public.deal%rowtype;
begin
  if p_lodged_on is null or p_lodged_on > current_date then
    raise exception 'A valid lodgement date on or before today is required.';
  end if;
  select * into v_request from public.status_request_token
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
  for update;
  if v_request.id is null or v_request.used_at is not null or v_request.expires_at <= now() then
    raise exception 'This status link is invalid, expired, or already used.';
  end if;
  select * into v_deal from public.deal where id = v_request.deal_id for update;
  if v_deal.status <> 'active' then raise exception 'This deal is no longer active.'; end if;
  perform set_config('app.workflow_change', 'allowed', true);
  update public.deal set lodged_on = p_lodged_on,
    stage = case when stage = 'documents_signed_guarantees' then 'lodged' else stage end
  where id = v_deal.id;
  update public.status_request_token set used_at = now() where id = v_request.id;
  if v_deal.stage = 'documents_signed_guarantees' then
    insert into public.deal_stage_history(deal_id, from_stage, to_stage, changed_by_external_email, reason)
    values (v_deal.id, v_deal.stage, 'lodged', v_request.recipient_email, 'Conveyancer confirmed lodgement');
  end if;
  insert into public.audit_log(agency_id, entity_type, entity_id, action, before_json, after_json)
  values (
    v_deal.agency_id, 'deal', v_deal.id, 'stage_transition',
    jsonb_build_object('stage', v_deal.stage),
    jsonb_build_object('stage', case when v_deal.stage = 'documents_signed_guarantees' then 'lodged' else v_deal.stage end,
      'lodged_on', p_lodged_on, 'submitted_by', v_request.recipient_email)
  );
  insert into public.notification(
    agency_id, user_account_id, channel, subject, body, related_entity_type,
    related_entity_id, scheduled_for
  )
  select distinct v_deal.agency_id, recipient.id, 'in_app', 'Conveyancer status received',
    v_deal.reference || ' was confirmed lodged on ' || to_char(p_lodged_on, 'DD Mon YYYY'),
    'deal', v_deal.id, now()
  from public.user_account recipient
  where recipient.agency_id = v_deal.agency_id and recipient.status = 'active'
    and (
      recipient.role in ('principal', 'admin')
      or exists (
        select 1 from public.deal_participant dp
        where dp.deal_id = v_deal.id and dp.user_account_id = recipient.id
      )
    );
end;
$$;

revoke all on function public.create_deal(jsonb) from public, anon;
revoke all on function public.register_new_agent(text, text, text, text) from public, anon, authenticated;
revoke all on function public.create_user_invitation(text, public.user_role) from public, anon;
revoke all on function public.validate_user_invitation(text, text) from public;
revoke all on function public.accept_user_invitation(text, text, text, text) from public, anon;
grant execute on function public.create_user_invitation(text, public.user_role) to authenticated;
grant execute on function public.validate_user_invitation(text, text) to anon, authenticated;
grant execute on function public.accept_user_invitation(text, text, text, text) to authenticated;
revoke all on function public.transition_deal(uuid, public.deal_stage, text, boolean) from public, anon;
revoke all on function public.cancel_deal(uuid, public.cancellation_reason, text) from public, anon;
revoke all on function public.set_condition_status(uuid, public.condition_status, date, text) from public, anon;
revoke all on function public.set_bond_status(uuid, public.bond_app_status, text) from public, anon;
grant execute on function public.create_deal(jsonb) to authenticated;
grant execute on function public.transition_deal(uuid, public.deal_stage, text, boolean) to authenticated;
grant execute on function public.cancel_deal(uuid, public.cancellation_reason, text) to authenticated;
grant execute on function public.set_condition_status(uuid, public.condition_status, date, text) to authenticated;
grant execute on function public.set_bond_status(uuid, public.bond_app_status, text) to authenticated;
revoke all on function public.upsert_ffc_certificate(uuid, text, date, date, text, text, text, bigint) from public, anon;
grant execute on function public.upsert_ffc_certificate(uuid, text, date, date, text, text, text, bigint) to authenticated;
revoke all on function public.submit_public_lead(text, text, text, text, text, jsonb) from public;
revoke all on function public.calculate_deal_commission(uuid, uuid) from public, anon;
revoke all on function public.run_daily_sweeps() from public, anon, authenticated;
grant execute on function public.submit_public_lead(text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.calculate_deal_commission(uuid, uuid) to authenticated;
revoke all on function public.save_commission_rule_set(jsonb) from public, anon;
grant execute on function public.save_commission_rule_set(jsonb) to authenticated;
grant execute on function public.run_daily_sweeps() to service_role;
revoke all on function public.bootstrap_principal(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.bootstrap_principal(text, uuid, text, text) to service_role;
revoke all on function public.create_status_request(uuid, text, integer) from public, anon;
revoke all on function public.get_status_request(text) from public;
revoke all on function public.submit_conveyancer_status(text, date) from public;
grant execute on function public.create_status_request(uuid, text, integer) to authenticated;
grant execute on function public.get_status_request(text) to anon, authenticated;
grant execute on function public.submit_conveyancer_status(text, date) to anon, authenticated;
