-- Migration: Real, editable agent seniority label
-- Description: The "seniority" concept in the frontend (src/types/index.ts
-- User.seniority) was never backed by real data -- src/data/operations.ts
-- computed it as a hardcoded `role === 'admin' ? 'Admin' : 'Senior'`, so
-- every single agent showed as "Senior" regardless of reality (visible on
-- the FFC compliance register's "Role" column, which actually renders this
-- fake seniority value, not the account's real role). This adds a genuine,
-- admin-editable seniority label -- Junior / Mid-level / Senior -- settable
-- when inviting a new agent and editable afterward from the admin Team
-- Members screen. Deliberately independent of `public.user_role` (admin/
-- agent/admin_agent): seniority is an informal experience-tier label, not a
-- permissions role, and also independent of `user_account.is_candidate`
-- (the real PPRA/FICA-regulated "candidate agent under supervision" status).

do $$ begin
  create type public.agent_seniority as enum ('junior', 'mid_level', 'senior');
exception when duplicate_object then null;
end $$;

alter table public.user_account
  add column if not exists seniority public.agent_seniority not null default 'junior';

alter table public.user_invitation
  add column if not exists seniority public.agent_seniority not null default 'junior';

-- Recreate create_user_invitation with a new optional p_seniority parameter.
-- CREATE OR REPLACE cannot change a function's parameter list, so the prior
-- two-argument signature is dropped first.
drop function if exists public.create_user_invitation(text, public.user_role);

create or replace function public.create_user_invitation(
  p_email text,
  p_role public.user_role default 'agent',
  p_seniority public.agent_seniority default 'junior'
)
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

  if p_role not in ('agent', 'admin', 'admin_agent') then
    raise exception 'Invalid role for invitation.';
  end if;

  if v_user_account_id is not null and v_role not in ('admin', 'admin_agent') then
    raise exception 'Only managers can invite users.';
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
$$;
grant execute on function public.create_user_invitation(text, public.user_role, public.agent_seniority) to anon, authenticated, service_role;

-- Recreate accept_user_invitation to copy the invitation's seniority onto
-- the new user_account row (and keep it in sync with an existing row, if a
-- prior partial registration already created one -- see the ON CONFLICT
-- handling this function has carried since 20260806000000).
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

  insert into public.user_account(auth_user_id, agency_id, email, full_name, role, seniority, mobile, avatar_key)
  values (auth.uid(), v_invite.agency_id, v_invite.email, trim(p_full_name), v_invite.role, v_invite.seniority, p_mobile, p_avatar_key)
  on conflict (auth_user_id) do update set
    full_name = excluded.full_name,
    mobile = excluded.mobile,
    avatar_key = coalesce(excluded.avatar_key, public.user_account.avatar_key),
    role = excluded.role,
    seniority = excluded.seniority,
    status = 'active'
  returning id into v_account_id;

  update public.user_invitation set accepted_at = now() where id = v_invite.id;

  return v_account_id;
end;
$$;
