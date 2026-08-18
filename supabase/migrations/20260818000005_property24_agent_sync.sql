-- Migration: Property24 agent profile sync
-- Description: Lets an admin paste an agent's public Property24 estate-agent
-- profile URL into the invitation dialog. The URL rides along on the
-- invitation exactly the way `seniority` does (see 20260817000008), lands on
-- the new user_account row when the agent accepts, and is then used by the
-- `property24-sync` edge function to fetch that agent's public profile blurb
-- and their live sale/rental listings for display on their own profile page.
--
-- Nothing here scrapes anything: Postgres only stores the URL and the cached
-- result. All fetching happens in the edge function, which holds the service
-- role key -- hence the write policies below deliberately admit service_role
-- only. Agents and admins read; nobody writes from the browser.

-- ─── 1. The URL itself, carried invitation → account ────────────────────────

alter table public.user_account
  add column if not exists property24_url text,
  add column if not exists property24_profile jsonb,
  add column if not exists property24_synced_at timestamptz,
  add column if not exists property24_sync_error text;

alter table public.user_invitation
  add column if not exists property24_url text;

-- Shape check only (host + /estate-agents/{agency}/{agent}/{numeric id}); the
-- edge function re-validates before it fetches, so this is a data-hygiene
-- guard, not the security boundary.
do $$ begin
  alter table public.user_account
    add constraint user_account_property24_url_shape
    check (
      property24_url is null
      or property24_url ~ '^https://(www\.)?property24\.com/estate-agents/[^/]+/[^/]+/\d+$'
    );
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.user_invitation
    add constraint user_invitation_property24_url_shape
    check (
      property24_url is null
      or property24_url ~ '^https://(www\.)?property24\.com/estate-agents/[^/]+/[^/]+/\d+$'
    );
exception when duplicate_object then null;
end $$;

-- ─── 2. Cached listings ─────────────────────────────────────────────────────

do $$ begin
  create type public.property24_purpose as enum ('sale', 'rent');
exception when duplicate_object then null;
end $$;

create table if not exists public.agent_property24_listing (
  id                uuid primary key default gen_random_uuid(),
  agency_id         uuid not null references public.agency(id) on delete cascade,
  user_account_id   uuid not null references public.user_account(id) on delete cascade,
  listing_number    text not null,
  purpose           public.property24_purpose not null,
  url               text not null,
  title             text,
  location          text,
  excerpt           text,
  price_zar         numeric(14,2),
  price_label       text,
  image_url         text,
  bedrooms          numeric(4,1),
  bathrooms         numeric(4,1),
  parking           numeric(4,1),
  size_label        text,
  size_kind         text,
  agency_name       text,
  first_seen_at     timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

-- One row per listing per agent. Property24 can surface the same listing
-- number under both the sale and rental feeds for dual-mandate stock, so the
-- purpose is NOT part of the key -- the later feed simply updates the row.
create unique index if not exists idx_agent_p24_listing_unique
  on public.agent_property24_listing(user_account_id, listing_number);
create index if not exists idx_agent_p24_listing_account
  on public.agent_property24_listing(user_account_id);
create index if not exists idx_agent_p24_listing_agency
  on public.agent_property24_listing(agency_id);

alter table public.agent_property24_listing enable row level security;

-- Listings are public data on Property24 to begin with, so every member of the
-- agency may read them -- an admin reviewing an agent's stock needs this just
-- as much as the agent does.
drop policy if exists "Agency members view Property24 listings" on public.agent_property24_listing;
create policy "Agency members view Property24 listings" on public.agent_property24_listing
  for select using (agency_id = public.get_current_agency_id());

grant select on public.agent_property24_listing to authenticated;
grant all on public.agent_property24_listing to service_role;

-- ─── 3. Invitation RPCs carry the URL ───────────────────────────────────────

-- CREATE OR REPLACE cannot change a parameter list, so the prior three-argument
-- signature from 20260817000008 is dropped first.
drop function if exists public.create_user_invitation(text, public.user_role, public.agent_seniority);

create or replace function public.create_user_invitation(
  p_email text,
  p_role public.user_role default 'agent',
  p_seniority public.agent_seniority default 'junior',
  p_property24_url text default null
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
  v_p24 text := nullif(trim(coalesce(p_property24_url, '')), '');
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
$$;
grant execute on function public.create_user_invitation(text, public.user_role, public.agent_seniority, text) to anon, authenticated, service_role;

-- Copy the invitation's Property24 URL onto the new account, alongside the
-- seniority handling this function has carried since 20260817000008.
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

  insert into public.user_account(auth_user_id, agency_id, email, full_name, role, seniority, mobile, avatar_key, property24_url)
  values (auth.uid(), v_invite.agency_id, v_invite.email, trim(p_full_name), v_invite.role, v_invite.seniority, p_mobile, p_avatar_key, v_invite.property24_url)
  on conflict (auth_user_id) do update set
    full_name = excluded.full_name,
    mobile = excluded.mobile,
    avatar_key = coalesce(excluded.avatar_key, public.user_account.avatar_key),
    role = excluded.role,
    seniority = excluded.seniority,
    property24_url = coalesce(excluded.property24_url, public.user_account.property24_url),
    status = 'active'
  returning id into v_account_id;

  update public.user_invitation set accepted_at = now() where id = v_invite.id;

  return v_account_id;
end;
$$;
