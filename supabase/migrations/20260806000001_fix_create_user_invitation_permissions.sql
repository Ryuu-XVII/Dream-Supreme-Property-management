-- Update create_user_invitation to grant permissions and handle fallback role check gracefully
-- Migration: 20260806000001_fix_create_user_invitation_permissions.sql

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

-- Grant EXECUTE to authenticated, anon, and service_role so invited managers/admins can execute RPC without permission error
grant execute on function public.create_user_invitation(text, public.user_role) to authenticated, anon, service_role;
