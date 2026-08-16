-- POPIA data-subject-access / erasure workflow for staff use. Internal tool
-- only (never anon-callable). Erasure is a single "anonymize immediately"
-- mode — party.id and every financial/deal/audit-linked foreign key stay
-- intact so FICA/tax-relevant history remains valid; only directly
-- identifying PII columns are scrubbed. No auto-expiry sweep — manual
-- trigger only.

alter type public.audit_action add value if not exists 'popia_export';
alter type public.audit_action add value if not exists 'popia_erasure';

create or replace function public.popia_lookup_party(p_search text)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_result jsonb;
begin
  if public.get_current_role() not in ('principal', 'admin') then
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
revoke all on function public.popia_lookup_party(text) from public, anon;
grant execute on function public.popia_lookup_party(text) to authenticated;

create or replace function public.popia_export_party_data(p_party_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_party public.party%rowtype;
  v_result jsonb;
begin
  if public.get_current_role() not in ('principal', 'admin') then
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
revoke all on function public.popia_export_party_data(uuid) from public, anon;
grant execute on function public.popia_export_party_data(uuid) to authenticated;

create or replace function public.popia_erase_party_data(p_party_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_party public.party%rowtype;
begin
  if public.get_current_role() not in ('principal', 'admin') then
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
revoke all on function public.popia_erase_party_data(uuid) from public, anon;
grant execute on function public.popia_erase_party_data(uuid) to authenticated;
