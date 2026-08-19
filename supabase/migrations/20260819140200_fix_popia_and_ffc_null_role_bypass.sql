-- Same NULL-role bypass class as 20260819140000/20260819140100, found by
-- scanning the live database for every function still using the raw
-- `public.get_current_role() not in (...)` form (a NULL role -- a suspended
-- agent whose JWT is still valid, or an unaccepted registration -- makes the
-- comparison NULL, not true, so the guard silently fell through). These four
-- functions are the POPIA subject-data lookup/export/erase RPCs and the FFC
-- certificate writer; all four are meant to be admin/admin_agent-only. Only
-- the guard line changes in each; the rest of each body is unchanged from
-- what is live today.

create or replace function public.popia_erase_party_data(
  p_party_id uuid
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_party public.party%rowtype;
begin
  if coalesce(public.get_current_role()::text, '') not in ('admin', 'admin_agent') then
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
$$;

create or replace function public.popia_export_party_data(
  p_party_id uuid
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_party public.party%rowtype;
  v_result jsonb;
begin
  if coalesce(public.get_current_role()::text, '') not in ('admin', 'admin_agent') then
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
$$;

create or replace function public.popia_lookup_party(
  p_search text
)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_result jsonb;
begin
  if coalesce(public.get_current_role()::text, '') not in ('admin', 'admin_agent') then
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
)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_document_id uuid;
  v_certificate_id uuid;
begin
  if coalesce(public.get_current_role()::text, '') not in ('admin', 'admin_agent') then
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
$$;
