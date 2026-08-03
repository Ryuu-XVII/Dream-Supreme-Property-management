-- =============================================================================
-- MODULE 2: AGENCY BACK-OFFICE & STOCK CONTROL SCHEMA
-- Migration: 20260803000005_agency_stock_and_syndication_schema.sql
-- Portal Syndication Feeds, Buyer-Property Matching, Conveyancing Pipeline, Mandate Expiry Warnings
-- =============================================================================

-- 1. Portal Syndication Config & Log Tables
create table if not exists public.portal_syndication_feed (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete cascade,
  portal_name text not null,
  feed_type text not null check (feed_type in ('xml', 'json_api', 'ftp')),
  feed_url text,
  is_enabled boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.portal_syndication_feed enable row level security;

create policy "Portal feeds viewable by agency" on public.portal_syndication_feed
  for select using (agency_id = public.get_current_agency_id());

create policy "Portal feeds manageable by agency admins" on public.portal_syndication_feed
  for all using (agency_id = public.get_current_agency_id() and public.get_current_role() in ('principal', 'admin'));

-- 2. Buyer Criteria Profile for Automated Matching
create table if not exists public.buyer_criteria_profile (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete cascade,
  party_id uuid not null references public.party(id) on delete cascade,
  min_price_cents bigint default 0,
  max_price_cents bigint not null,
  preferred_suburbs text[],
  property_types text[],
  min_bedrooms smallint default 1,
  min_bathrooms smallint default 1,
  created_at timestamptz not null default now()
);

alter table public.buyer_criteria_profile enable row level security;

create policy "Buyer criteria viewable by agency" on public.buyer_criteria_profile
  for select using (agency_id = public.get_current_agency_id());

create policy "Buyer criteria manageable by agency users" on public.buyer_criteria_profile
  for all using (agency_id = public.get_current_agency_id());

-- 3. Conveyancing Stage Legal Milestone Tracker
create table if not exists public.conveyancing_stage_tracker (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete cascade,
  deal_id uuid not null references public.deal(id) on delete cascade,
  stage_name text not null,
  stage_status text not null check (stage_status in ('pending', 'in_progress', 'completed', 'delayed')) default 'pending',
  attorney_notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.conveyancing_stage_tracker enable row level security;

create policy "Conveyancing stage viewable by agency" on public.conveyancing_stage_tracker
  for select using (agency_id = public.get_current_agency_id());

create policy "Conveyancing stage manageable by agency users" on public.conveyancing_stage_tracker
  for all using (agency_id = public.get_current_agency_id());

-- 4. Automated Buyer Matching RPC Procedure
create or replace function public.match_buyers_for_mandate(
  p_mandate_id uuid
) returns table (
  buyer_party_id uuid,
  buyer_name text,
  match_score integer
)
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_price_cents bigint;
  v_bedrooms smallint;
  v_property_type text;
begin
  select m.listing_price_cents, p.bedrooms, p.property_type::text
  into v_price_cents, v_bedrooms, v_property_type
  from public.mandate m
  join public.property p on p.id = m.property_id
  where m.id = p_mandate_id and m.agency_id = v_agency_id;

  return query
  select 
    b.party_id as buyer_party_id,
    pt.full_name as buyer_name,
    case 
      when v_price_cents between b.min_price_cents and b.max_price_cents then 60
      else 20
    end +
    case 
      when v_bedrooms >= coalesce(b.min_bedrooms, 1) then 20
      else 0
    end +
    case 
      when v_property_type = any(coalesce(b.property_types, array[v_property_type])) then 20
      else 0
    end as match_score
  from public.buyer_criteria_profile b
  join public.party pt on pt.id = b.party_id
  where b.agency_id = v_agency_id
    and v_price_cents <= b.max_price_cents;
end;
$$;
