-- SECURITY FIX: privilege escalation via create_user_invitation.
--
-- The previous authorization guard was:
--
--   if v_user_account_id is not null and v_role not in ('admin','admin_agent')
--   then raise exception 'Only managers can invite users.'; end if;
--
-- It only rejected the caller when they had an account (v_user_account_id is not
-- null). An UNAUTHENTICATED caller — anyone holding the public anon key, which
-- ships in the browser bundle — has a null account id, so the guard was skipped
-- entirely. That let an anonymous attacker mint a valid `admin` invitation token
-- and then walk it through the public /register flow to provision a full admin
-- account in the agency. Verified exploitable against the live project.
--
-- The corrected policy: only an authenticated admin / admin_agent may create an
-- invitation. The single, deliberately narrow exception is genuine first-run
-- bootstrap — when the system has zero user_accounts — so an initial admin can
-- still be provisioned on a brand-new deployment. Once any account exists, an
-- authenticated manager is always required.

create or replace function public.create_user_invitation(
  p_email text,
  p_role public.user_role default 'agent'::public.user_role,
  p_seniority public.agent_seniority default 'junior'::public.agent_seniority
)
returns text
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_agency_id uuid := public.get_current_agency_id();
  v_user_account_id uuid := public.get_current_user_account_id();
  v_role public.user_role := public.get_current_role();
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

  insert into public.user_invitation(agency_id, email, role, seniority, token_hash, invited_by)
  values (
    v_agency_id, lower(trim(p_email)), p_role, p_seniority,
    encode(digest(v_token, 'sha256'), 'hex'), v_user_account_id
  );
  return v_token;
end;
$function$;
