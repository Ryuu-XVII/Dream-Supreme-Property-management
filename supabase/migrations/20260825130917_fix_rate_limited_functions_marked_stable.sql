-- Migration: Fix STABLE anon RPCs broken by their own rate-limit guard
-- Description: 20260817000000_rate_limiting.sql added a public.check_rate_limit(...)
-- call -- which INSERTs into public.rate_limit_hit -- to the top of several
-- functions, but three of them (get_current_transfer_duty_brackets,
-- get_status_request, validate_user_invitation) were still declared STABLE.
-- PostgREST opens a read-only transaction for any STABLE/IMMUTABLE function,
-- so every call through the real REST API (the only way the app or an
-- end user ever calls these) has been failing outright with "cannot execute
-- INSERT in a read-only transaction" (Postgres error 25006, surfaced as
-- HTTP 405) since that migration landed -- confirmed live against production
-- while stress-testing the new rate limiting. This broke the public Transfer
-- Duty Calculator, the public deal-status lookup page, and invited-agent
-- registration's invite-token validation, for every caller, unconditionally
-- (not just under load). Direct SQL and the Postgres wire protocol don't hit
-- this path, which is why it went unnoticed until testing over the real
-- REST API. Fix: drop the STABLE marker so these match what they now
-- actually are -- functions with a side effect -- with no other change to
-- behavior. Bodies are otherwise identical to their current live definitions.

create or replace function public.get_current_transfer_duty_brackets()
returns jsonb
language plpgsql security definer
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

create or replace function public.get_status_request(p_token text)
returns jsonb
language plpgsql security definer
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

create or replace function public.validate_user_invitation(p_token text, p_email text)
returns boolean
language plpgsql security definer
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
