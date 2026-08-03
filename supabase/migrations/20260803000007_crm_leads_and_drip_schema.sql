-- =============================================================================
-- MODULE 4: AGENT CRM & PIPELINE TRACKING SCHEMA
-- Migration: 20260803000007_crm_leads_and_drip_schema.sql
-- Omnichannel Lead Capture, Round-Robin Routing, Drip Campaigns & Activity Log
-- =============================================================================

-- 1. Lead Capture & Omnichannel Ingestion Table
create table if not exists public.lead_capture (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete cascade,
  lead_name text not null,
  lead_email text,
  lead_phone text,
  source text not null check (source in ('web_form', 'portal_feed', 'social_ad', 'open_house', 'referral')),
  assigned_agent_id uuid references public.user_account(id) on delete set null,
  status text not null check (status in ('new', 'contacted', 'qualified', 'unqualified', 'converted')) default 'new',
  created_at timestamptz not null default now()
);

alter table public.lead_capture enable row level security;

create policy "Leads viewable by agency" on public.lead_capture
  for select using (agency_id = public.get_current_agency_id());

create policy "Leads manageable by agency users" on public.lead_capture
  for all using (agency_id = public.get_current_agency_id());

-- 2. Drip Nurturing Campaign Tables
create table if not exists public.drip_campaign (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete cascade,
  campaign_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.drip_campaign enable row level security;

create policy "Drip campaign viewable by agency" on public.drip_campaign
  for select using (agency_id = public.get_current_agency_id());

create policy "Drip campaign manageable by agency admins" on public.drip_campaign
  for all using (agency_id = public.get_current_agency_id() and public.get_current_role() in ('principal', 'admin'));

create table if not exists public.drip_campaign_step (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.drip_campaign(id) on delete cascade,
  step_number smallint not null,
  delay_days smallint not null default 1,
  channel text not null check (channel in ('email', 'sms', 'notification')),
  subject text,
  body_template text not null,
  created_at timestamptz not null default now()
);

alter table public.drip_campaign_step enable row level security;

create policy "Drip step viewable by agency" on public.drip_campaign_step
  for select using (
    exists (
      select 1 from public.drip_campaign c
      where c.id = drip_campaign_step.campaign_id
        and c.agency_id = public.get_current_agency_id()
    )
  );

-- 3. Centralized Contact Activity Timeline
create table if not exists public.contact_activity_timeline (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agency(id) on delete cascade,
  party_id uuid not null references public.party(id) on delete cascade,
  activity_type text not null check (activity_type in ('call', 'sms', 'email', 'meeting', 'property_view', 'note')),
  summary text not null,
  details text,
  performed_by uuid references public.user_account(id) on delete set null,
  occurred_at timestamptz not null default now()
);

alter table public.contact_activity_timeline enable row level security;

create policy "Activity timeline viewable by agency" on public.contact_activity_timeline
  for select using (agency_id = public.get_current_agency_id());

create policy "Activity timeline insertable by agency users" on public.contact_activity_timeline
  for insert with check (agency_id = public.get_current_agency_id());

-- 4. Round-Robin Lead Assignment RPC Procedure
create or replace function public.assign_lead_round_robin(
  p_lead_id uuid
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_agency_id uuid := public.get_current_agency_id();
  v_agent_id uuid;
begin
  -- Select active agent in agency with lowest lead count
  select u.id into v_agent_id
  from public.user_account u
  left join public.lead_capture l on l.assigned_agent_id = u.id and l.agency_id = v_agency_id
  where u.agency_id = v_agency_id
    and u.status = 'active'
    and u.role in ('agent', 'principal', 'admin')
  group by u.id
  order by count(l.id) asc, u.created_at asc
  limit 1;

  if v_agent_id is not null then
    update public.lead_capture
    set assigned_agent_id = v_agent_id,
        status = 'contacted'
    where id = p_lead_id and agency_id = v_agency_id;
  end if;

  return jsonb_build_object('lead_id', p_lead_id, 'assigned_agent_id', v_agent_id);
end;
$$;
