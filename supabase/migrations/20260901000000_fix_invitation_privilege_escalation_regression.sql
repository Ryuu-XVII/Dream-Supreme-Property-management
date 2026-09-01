-- SECURITY FIX (regression): privilege escalation via create_user_invitation.
--
-- 20260817000010_fix_invitation_privilege_escalation.sql fixed this exact bug:
-- the authorization guard only rejected a caller when they already had a
-- user_account row (v_user_account_id is not null). Any caller with no
-- matching user_account — including an authenticated-but-not-yet-onboarded
-- signup, since auth.signup is enabled — has a null account id, so the guard
-- was skipped entirely, letting the caller mint a valid 'admin' invitation
-- token and walk it through accept_user_invitation() to provision a full
-- admin account.
--
-- 20260818000005_property24_agent_sync.sql redefined create_user_invitation
-- the next day (to add p_property24_url) by copying the pre-fix body,
-- silently reverting the fix. 20260821060000_revoke_anon_execute_on_
-- authenticated_only_rpcs.sql later revoked EXECUTE from anon, which closes
-- the fully-unauthenticated path, but an authenticated caller with no
-- user_account row (v_user_account_id still null) remains unauthorized to
-- self-grant 'admin' via this RPC. Restoring the bootstrap-aware guard here.
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
  v_has_accounts boolean := exists (select 1 from public.user_account);
begin
  if not public.check_rate_limit('create_user_invitation:' || lower(trim(p_email)), 10, interval '1 hour') then
    raise exception 'Too many invitation attempts for this address. Please try again later.';
  end if;

  if p_role not in ('agent', 'admin', 'admin_agent') then
    raise exception 'Invalid role for invitation.';
  end if;

  -- Authorization: an authenticated admin/admin_agent is required to invite.
  -- The only exception is true first-run bootstrap (no accounts exist yet).
  if v_has_accounts then
    if v_user_account_id is null or v_role not in ('admin', 'admin_agent') then
      raise exception 'Only managers can invite users.';
    end if;
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
