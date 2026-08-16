-- Rate limiting for anon-callable public RPCs. This nginx tier serves static
-- assets only and never proxies to Supabase (see nginx.conf), so the only
-- place that can actually see repeated abuse of these RPCs is Postgres itself.
-- PostgREST does not forward caller IP into these functions, so limits are
-- keyed by the identity already present in each call's own parameters
-- (email/token) rather than IP; IP-level forensics should use Supabase's own
-- request logs instead.

create table if not exists public.rate_limit_hit (
  id uuid primary key default gen_random_uuid(),
  rate_key text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_limit_hit_key_time_idx on public.rate_limit_hit(rate_key, created_at);

-- Default-deny: only SECURITY DEFINER functions touch this table.
alter table public.rate_limit_hit enable row level security;

create or replace function public.check_rate_limit(p_key text, p_max_attempts int, p_window interval)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.rate_limit_hit
  where rate_key = p_key and created_at > now() - p_window;
  if v_count >= p_max_attempts then
    return false;
  end if;
  insert into public.rate_limit_hit(rate_key) values (p_key);
  return true;
end;
$$;

revoke all on function public.check_rate_limit(text, int, interval) from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'prune_rate_limit_hit',
      '0 3 * * *',
      $cron$delete from public.rate_limit_hit where created_at < now() - interval '1 day'$cron$
    );
  end if;
end $$;

---------------------------------------------------------------------------
-- Wrap anon-callable RPCs with rate limiting. Each is re-declared with its
-- existing body (per the latest migration that touched it) plus a guard.
---------------------------------------------------------------------------

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
  if p_email is null or p_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'A valid email is required.'; end if;
  if not public.check_rate_limit('submit_public_lead:' || lower(trim(p_email)), 5, interval '1 hour') then
    raise exception 'Too many submissions from this address. Please try again later.';
  end if;
  select id into v_agency_id from public.agency where public_slug = p_agency_slug and archived_at is null;
  if v_agency_id is null then raise exception 'Agency not found.'; end if;
  if length(trim(p_full_name)) < 2 then raise exception 'Name is required.'; end if;
  insert into public.lead(agency_id, source, full_name, email, mobile, calculator_payload_json)
  values (v_agency_id, lower(p_source), trim(p_full_name), lower(trim(p_email)), p_mobile, p_payload)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.get_status_request(p_token text)
returns jsonb
language plpgsql stable security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not public.check_rate_limit('get_status_request:' || p_token, 10, interval '1 hour') then
    raise exception 'Too many attempts. Please try again later.';
  end if;
  select jsonb_build_object(
    'dealId', d.id,
    'reference', d.reference,
    'stage', d.stage,
    'address', p.address_line,
    'suburb', p.suburb,
    'expiresAt', token.expires_at
  ) into v_result
  from public.status_request_token token
  join public.deal d on d.id = token.deal_id
  join public.property p on p.id = d.property_id
  where token.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and token.used_at is null and token.expires_at > now()
  limit 1;
  return v_result;
end;
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
  if not public.check_rate_limit('submit_conveyancer_status:' || p_token, 10, interval '1 hour') then
    raise exception 'Too many attempts. Please try again later.';
  end if;
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
    'Lodgement date ' || p_lodged_on::text || ' submitted for deal ' || v_deal.reference,
    'deal', v_deal.id, now()
  from public.deal_participant recipient
  where recipient.deal_id = v_deal.id;
end;
$$;

create or replace function public.create_user_invitation(p_email text, p_role public.user_role default 'agent')
returns text
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_agency_id uuid := public.get_current_agency_id();
  v_user_account_id uuid := public.get_current_user_account_id();
  v_role public.user_role := public.get_current_role();
begin
  if not public.check_rate_limit('create_user_invitation:' || lower(trim(p_email)), 10, interval '1 hour') then
    raise exception 'Too many invitation attempts for this address. Please try again later.';
  end if;

  -- Authorization check: if an active user_account exists for this auth user, verify manager role.
  -- If no user_account exists yet (e.g., initial setup/bootstrap), allow principal/admin creation.
  if v_user_account_id is not null and v_role not in ('principal', 'admin') then
    raise exception 'Only managers can invite users.';
  end if;

  -- Only a principal may invite another principal
  if p_role = 'principal' and v_role is not null and v_role <> 'principal' then
    raise exception 'Only a principal can invite another principal.';
  end if;

  -- Fallback to default agency if helper returns null
  if v_agency_id is null then
    select id into v_agency_id from public.agency limit 1;
  end if;

  -- Auto-create default agency if new project has no agency records yet
  if v_agency_id is null then
    insert into public.agency (name)
    values ('Dream Supreme Properties')
    returning id into v_agency_id;
  end if;

  -- Clean up any prior unaccepted invitations for this email
  delete from public.user_invitation
    where email = lower(trim(p_email)) and accepted_at is null;

  insert into public.user_invitation(agency_id, email, role, token_hash, invited_by)
  values (
    v_agency_id, lower(trim(p_email)), p_role,
    encode(digest(v_token, 'sha256'), 'hex'), v_user_account_id
  );
  return v_token;
end;
$$;
grant execute on function public.create_user_invitation(text, public.user_role) to anon, authenticated, service_role;

create or replace function public.validate_user_invitation(p_token text, p_email text)
returns boolean
language plpgsql stable security definer
set search_path = public, extensions, pg_temp
as $$
begin
  if not public.check_rate_limit('validate_user_invitation:' || lower(trim(p_email)), 10, interval '1 hour') then
    raise exception 'Too many attempts. Please try again later.';
  end if;
  return exists (
    select 1 from public.user_invitation
    where token_hash = encode(digest(p_token, 'sha256'), 'hex')
      and email = lower(trim(p_email)) and accepted_at is null and expires_at > now()
  );
end;
$$;
grant execute on function public.validate_user_invitation(text, text) to anon, authenticated, service_role;

create or replace function public.prepare_invited_registration(
  p_token text, p_email text
) returns jsonb
language plpgsql security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_invite public.user_invitation%rowtype;
  v_existing_auth_id uuid;
  v_has_account boolean;
begin
  if not public.check_rate_limit('prepare_invited_registration:' || lower(trim(p_email)), 10, interval '1 hour') then
    raise exception 'Too many attempts. Please try again later.';
  end if;

  -- Step 1: Validate the invitation token
  select * into v_invite from public.user_invitation
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
      and email = lower(trim(p_email))
      and accepted_at is null and expires_at > now();

  if v_invite.id is null then
    return jsonb_build_object('valid', false, 'reason', 'This invitation is invalid, expired, or belongs to another email address.');
  end if;

  -- Step 2: Check for orphan auth user (created by a previous failed registration)
  select id into v_existing_auth_id from auth.users
    where lower(email) = lower(trim(p_email));

  if v_existing_auth_id is not null then
    select exists(select 1 from public.user_account where auth_user_id = v_existing_auth_id)
      into v_has_account;

    if v_has_account then
      return jsonb_build_object('valid', false, 'reason',
        'An account is already registered with this email address. Please sign in instead.');
    end if;

    delete from auth.users where id = v_existing_auth_id;
  end if;

  return jsonb_build_object('valid', true, 'role', v_invite.role::text);
end;
$$;
grant execute on function public.prepare_invited_registration(text, text) to anon, authenticated;

create or replace function public.get_current_transfer_duty_brackets()
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if not public.check_rate_limit('get_current_transfer_duty_brackets:global', 60, interval '1 hour') then
    raise exception 'Too many requests. Please try again later.';
  end if;
  return coalesce(
    (
      select brackets_json
      from public.config_transfer_duty
      where effective_from <= current_date
      order by effective_from desc
      limit 1
    ),
    '[]'::jsonb
  );
end;
$$;
revoke all on function public.get_current_transfer_duty_brackets() from public;
grant execute on function public.get_current_transfer_duty_brackets() to anon, authenticated;
