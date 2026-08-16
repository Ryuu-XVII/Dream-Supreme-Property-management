-- Click-to-sign e-signature flow. esign_envelope/esign_audit_log already
-- have full agency-scoped RLS, but those policies gate on an authenticated
-- agency user — a signer opening /sign?token=... has no Supabase Auth
-- session at all, so none of that RLS lets them do anything. This migration
-- adds a per-recipient anonymous-access token (mirroring the existing
-- status_request_token pattern) and the SECURITY DEFINER RPCs a signer needs.

create table if not exists public.esign_envelope_recipient (
  id uuid primary key default gen_random_uuid(),
  envelope_id uuid not null references public.esign_envelope(id) on delete cascade,
  recipient_email text not null,
  signer_role text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  signed_at timestamptz,
  declined_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists esign_envelope_recipient_envelope_idx on public.esign_envelope_recipient(envelope_id);

alter table public.esign_envelope_recipient enable row level security;
create policy "Envelope recipients viewable by agency" on public.esign_envelope_recipient
  for select using (
    exists (
      select 1 from public.esign_envelope e
      where e.id = esign_envelope_recipient.envelope_id and e.agency_id = public.get_current_agency_id()
    )
  );

-- signature_record intentionally has no insert/update policy for any role:
-- every write goes through submit_esign_signature() below, a SECURITY
-- DEFINER function that bypasses RLS by design. This is not an oversight.

create or replace function public.create_esign_envelope_recipient(
  p_envelope_id uuid,
  p_recipient_email text,
  p_signer_role text,
  p_expires_in_hours int default 168
) returns text
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_envelope public.esign_envelope%rowtype;
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  select * into v_envelope from public.esign_envelope
  where id = p_envelope_id and agency_id = public.get_current_agency_id();
  if v_envelope.id is null then raise exception 'Envelope not found.'; end if;
  if nullif(trim(p_recipient_email), '') is null then raise exception 'Recipient email is required.'; end if;

  insert into public.esign_envelope_recipient(envelope_id, recipient_email, signer_role, token_hash, expires_at)
  values (
    p_envelope_id, lower(trim(p_recipient_email)), p_signer_role,
    encode(digest(v_token, 'sha256'), 'hex'), now() + make_interval(hours => p_expires_in_hours)
  );

  if v_envelope.status = 'draft' then
    update public.esign_envelope set status = 'sent' where id = p_envelope_id;
  end if;

  insert into public.esign_audit_log(envelope_id, recipient_email, signer_role, action)
  values (p_envelope_id, lower(trim(p_recipient_email)), p_signer_role, 'sent');

  return v_token;
end;
$$;
revoke all on function public.create_esign_envelope_recipient(uuid, text, text, int) from public, anon;
grant execute on function public.create_esign_envelope_recipient(uuid, text, text, int) to authenticated;

create or replace function public.get_esign_envelope_for_signing(p_token text, p_user_agent text default null)
returns jsonb
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_recipient public.esign_envelope_recipient%rowtype;
  v_envelope public.esign_envelope%rowtype;
  v_document public.document%rowtype;
  v_result jsonb;
begin
  if not public.check_rate_limit('get_esign_envelope_for_signing:' || p_token, 20, interval '1 hour') then
    raise exception 'Too many attempts. Please try again later.';
  end if;

  select * into v_recipient from public.esign_envelope_recipient
  where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  if v_recipient.id is null or v_recipient.expires_at <= now() then
    raise exception 'This signing link is invalid or has expired.';
  end if;
  if v_recipient.signed_at is not null or v_recipient.declined_at is not null then
    raise exception 'This document has already been signed or declined.';
  end if;

  select * into v_envelope from public.esign_envelope where id = v_recipient.envelope_id;
  select * into v_document from public.document where id = v_envelope.document_id;

  insert into public.esign_audit_log(envelope_id, recipient_email, signer_role, action, user_agent)
  values (v_envelope.id, v_recipient.recipient_email, v_recipient.signer_role, 'viewed', p_user_agent);

  v_result := jsonb_build_object(
    'envelopeStatus', v_envelope.status,
    'recipientEmail', v_recipient.recipient_email,
    'signerRole', v_recipient.signer_role,
    'documentFilename', v_document.filename,
    'payloadSha256', v_envelope.payload_sha256
  );
  return v_result;
end;
$$;
revoke all on function public.get_esign_envelope_for_signing(text, text) from public;
grant execute on function public.get_esign_envelope_for_signing(text, text) to anon, authenticated;

create or replace function public.submit_esign_signature(
  p_token text,
  p_typed_name text,
  p_signature_svg text,
  p_document_hash text,
  p_signature_image_key text default null,
  p_user_agent text default null
) returns jsonb
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_recipient public.esign_envelope_recipient%rowtype;
  v_envelope public.esign_envelope%rowtype;
  v_remaining int;
begin
  if not public.check_rate_limit('submit_esign_signature:' || p_token, 10, interval '1 hour') then
    raise exception 'Too many attempts. Please try again later.';
  end if;
  if nullif(trim(p_typed_name), '') is null then raise exception 'Typed name is required.'; end if;
  if nullif(trim(p_signature_svg), '') is null then raise exception 'A drawn signature is required.'; end if;

  select * into v_recipient from public.esign_envelope_recipient
  where token_hash = encode(digest(p_token, 'sha256'), 'hex') for update;
  if v_recipient.id is null or v_recipient.expires_at <= now() then
    raise exception 'This signing link is invalid or has expired.';
  end if;
  if v_recipient.signed_at is not null or v_recipient.declined_at is not null then
    raise exception 'This document has already been signed or declined.';
  end if;

  select * into v_envelope from public.esign_envelope where id = v_recipient.envelope_id for update;
  if p_document_hash is null or p_document_hash <> v_envelope.payload_sha256 then
    raise exception 'Document integrity check failed. The document may have changed since it was sent.';
  end if;

  insert into public.signature_record(
    document_id, signer_email, signature_image_key, ip_address, user_agent, document_hash
  ) values (
    v_envelope.document_id, v_recipient.recipient_email, p_signature_image_key, null, p_user_agent, p_document_hash
  );

  update public.esign_envelope_recipient set signed_at = now() where id = v_recipient.id;

  insert into public.esign_audit_log(envelope_id, recipient_email, signer_role, action, user_agent, signature_svg)
  values (v_envelope.id, v_recipient.recipient_email, v_recipient.signer_role, 'signed', p_user_agent, p_signature_svg);

  select count(*) into v_remaining from public.esign_envelope_recipient
  where envelope_id = v_envelope.id and signed_at is null and declined_at is null;

  if v_remaining = 0 then
    update public.esign_envelope set status = 'completed', completed_at = now() where id = v_envelope.id;
  else
    update public.esign_envelope set status = 'partially_signed' where id = v_envelope.id;
  end if;

  return jsonb_build_object('status', case when v_remaining = 0 then 'completed' else 'partially_signed' end);
end;
$$;
revoke all on function public.submit_esign_signature(text, text, text, text, text, text) from public;
grant execute on function public.submit_esign_signature(text, text, text, text, text, text) to anon, authenticated;

create or replace function public.decline_esign_envelope(p_token text, p_reason text default null)
returns void
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_recipient public.esign_envelope_recipient%rowtype;
begin
  if not public.check_rate_limit('decline_esign_envelope:' || p_token, 10, interval '1 hour') then
    raise exception 'Too many attempts. Please try again later.';
  end if;

  select * into v_recipient from public.esign_envelope_recipient
  where token_hash = encode(digest(p_token, 'sha256'), 'hex') for update;
  if v_recipient.id is null or v_recipient.expires_at <= now() then
    raise exception 'This signing link is invalid or has expired.';
  end if;
  if v_recipient.signed_at is not null or v_recipient.declined_at is not null then
    raise exception 'This document has already been signed or declined.';
  end if;

  update public.esign_envelope_recipient set declined_at = now() where id = v_recipient.id;
  update public.esign_envelope set status = 'declined' where id = v_recipient.envelope_id;

  insert into public.esign_audit_log(envelope_id, recipient_email, signer_role, action)
  values (v_recipient.envelope_id, v_recipient.recipient_email, v_recipient.signer_role, 'declined');
end;
$$;
revoke all on function public.decline_esign_envelope(text, text) from public;
grant execute on function public.decline_esign_envelope(text, text) to anon, authenticated;
