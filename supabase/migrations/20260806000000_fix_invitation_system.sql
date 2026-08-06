-- Fix invitation system: restore auth, add RLS, add orphan cleanup, add conflict guard
-- Addresses audit issues #1, #5, #6, #7, #8

---------------------------------------------------------------------------
-- 3a + 3b: Restore authorization + add duplicate-prevention in create_user_invitation
---------------------------------------------------------------------------
create or replace function public.create_user_invitation(p_email text, p_role public.user_role default 'agent')
returns text
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_agency_id uuid := public.get_current_agency_id();
  v_user_account_id uuid := public.get_current_user_account_id();
begin
  -- Authorization: only principals and admins may invite
  if public.get_current_role() not in ('principal', 'admin') then
    raise exception 'Only managers can invite users.';
  end if;

  -- Only a principal may invite another principal
  if p_role = 'principal' and public.get_current_role() <> 'principal' then
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

  -- Issue #7: Clean up any prior unaccepted invitations for this email
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

-- Issue #6: Revoke anon access — only authenticated users should create invitations
revoke all on function public.create_user_invitation(text, public.user_role) from public, anon;
grant execute on function public.create_user_invitation(text, public.user_role) to authenticated;

---------------------------------------------------------------------------
-- 3c: Add missing RLS policies for INSERT and DELETE on user_invitation
---------------------------------------------------------------------------
do $$ begin
  create policy "Managers delete invitations" on public.user_invitation for delete
    using (agency_id = public.get_current_agency_id()
      and public.get_current_role() in ('principal', 'admin'));
  exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Managers insert invitations" on public.user_invitation for insert
    with check (agency_id = public.get_current_agency_id()
      and public.get_current_role() in ('principal', 'admin'));
  exception when duplicate_object then null;
end $$;

---------------------------------------------------------------------------
-- 3d: New RPC — prepare_invited_registration (orphan auth user cleanup)
-- This runs BEFORE the client calls supabase.auth.signUp()
---------------------------------------------------------------------------
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
    -- Check if they already have a completed user_account profile
    select exists(select 1 from public.user_account where auth_user_id = v_existing_auth_id)
      into v_has_account;

    if v_has_account then
      return jsonb_build_object('valid', false, 'reason',
        'An account is already registered with this email address. Please sign in instead.');
    end if;

    -- Orphan auth user without a user_account — delete it so signUp can proceed cleanly
    delete from auth.users where id = v_existing_auth_id;
  end if;

  return jsonb_build_object('valid', true, 'role', v_invite.role::text);
end;
$$;

-- Callable by unauthenticated users (they don't have an account yet)
grant execute on function public.prepare_invited_registration(text, text) to anon, authenticated;

---------------------------------------------------------------------------
-- 3e: Add ON CONFLICT guard to accept_user_invitation
---------------------------------------------------------------------------
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

  if v_invite.id is null or lower(v_invite.email) <> v_auth_email then
    raise exception 'Invitation is invalid or expired.';
  end if;

  -- Issue #8: ON CONFLICT guard — if a user_account already exists, update it
  insert into public.user_account(auth_user_id, agency_id, email, full_name, role, mobile, avatar_key)
  values (auth.uid(), v_invite.agency_id, v_invite.email, trim(p_full_name), v_invite.role, p_mobile, p_avatar_key)
  on conflict (auth_user_id) do update set
    full_name = excluded.full_name,
    mobile = excluded.mobile,
    avatar_key = coalesce(excluded.avatar_key, public.user_account.avatar_key),
    role = excluded.role,
    status = 'active'
  returning id into v_account_id;

  update public.user_invitation set accepted_at = now() where id = v_invite.id;

  return v_account_id;
end;
$$;
